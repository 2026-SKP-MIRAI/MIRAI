import json
from openai import OpenAI
from pathlib import Path
from app.config import settings
from app.parsers.exceptions import LLMError
from app.schemas import (
    InterviewStartResponse, InterviewAnswerResponse, FollowupResponse,
    QuestionWithPersona, QueueItem,
)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
PERSONA_LABELS = {"hr": "HR 담당자", "tech_lead": "기술팀장", "executive": "경영진"}
PERSONA_PROMPTS = {
    "hr": "interview_hr_v1.md",
    "tech_lead": "interview_tech_lead_v1.md",
    "executive": "interview_executive_v1.md",
}

MAX_TURNS = 10
MAX_FOLLOWUPS = 2  # 동일 페르소나 꼬리질문 최대 횟수


def _strip_code_block(raw: str) -> str:
    s = raw.strip()
    if s.startswith("```"):
        s = s[s.index("\n") + 1:]
    if s.endswith("```"):
        s = s[:s.rfind("```")]
    return s.strip()


def _parse_object(raw: str, required_keys: list[str] | None = None) -> dict:
    """JSON 파싱 후 dict 반환. 배열로 반환된 경우 첫 번째 원소 사용."""
    try:
        data = json.loads(_strip_code_block(raw))
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM 응답이 유효한 JSON이 아닙니다: {e}") from e
    if isinstance(data, list):
        if not data:
            raise LLMError("LLM 응답 배열이 비어 있습니다")
        data = data[0]
    if not isinstance(data, dict):
        raise LLMError("LLM 응답이 객체가 아닙니다")
    if required_keys:
        missing = [k for k in required_keys if k not in data]
        if missing:
            raise LLMError(f"LLM 응답에 필수 키가 없습니다: {missing}")
    return data


def _call_llm(prompt: str, *, model: str | None = None, timeout: float = 30.0) -> str:
    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=settings.openrouter_api_key)
    resolved_model = model or settings.openrouter_model
    try:
        response = client.chat.completions.create(
            model=resolved_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
            timeout=timeout,
        )
        return response.choices[0].message.content
    except Exception as e:
        raise LLMError("면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.") from e


def _count_trailing_persona(history: list, persona: str) -> int:
    """history 끝에서 동일 페르소나가 연속으로 등장한 횟수."""
    count = 0
    for item in reversed(history):
        if item.persona == persona:
            count += 1
        else:
            break
    return count


def _build_queue(personas: list[str], total_turns: int) -> list[QueueItem]:
    """round-robin으로 (total_turns-1)개 QueueItem 생성."""
    count = total_turns - 1  # 첫 질문은 이미 생성됨
    return [QueueItem(persona=personas[(1 + i) % len(personas)], type="main") for i in range(count)]


def _check_followup(
    question: str,
    answer: str,
    persona: str,
    resumeText: str,
    *,
    model: str | None = None,
) -> dict:
    """followup 필요 여부를 LLM으로 판단. dict 반환."""
    prompt_file = PROMPT_DIR / "interview_followup_v1.md"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    persona_context = PERSONA_LABELS.get(persona, persona)
    prompt = (
        prompt_template
        .replace("{question}", question)
        .replace("{answer}", answer)
        .replace("{persona_context}", persona_context)
        .replace("{resume_text}", resumeText[:16000])
    )
    raw = _call_llm(prompt, model=model)
    return _parse_object(raw, required_keys=["shouldFollowUp", "followupType", "followupQuestion", "reasoning"])


def start_interview(
    resumeText: str,
    personas: list[str],
    *,
    model: str | None = None,
) -> InterviewStartResponse:
    first_persona = personas[0]
    prompt_file = PROMPT_DIR / PERSONA_PROMPTS[first_persona]
    prompt_template = prompt_file.read_text(encoding="utf-8")
    personas_context = ", ".join(PERSONA_LABELS[p] for p in personas)
    prompt = prompt_template.replace("{resume_text}", resumeText[:16000]).replace("{personas_context}", personas_context)

    raw = _call_llm(prompt, model=model)
    data = _parse_object(raw, required_keys=["question"])

    first_question = QuestionWithPersona(
        persona=first_persona,
        personaLabel=data.get("personaLabel", PERSONA_LABELS[first_persona]),
        question=data["question"],
        type="main",
    )

    questions_queue = _build_queue(personas, MAX_TURNS)

    return InterviewStartResponse(firstQuestion=first_question, questionsQueue=questions_queue)


def process_answer(
    resumeText: str,
    history: list,
    questionsQueue: list,
    currentQuestion: str,
    currentPersona: str,
    currentAnswer: str,
    *,
    model: str | None = None,
) -> InterviewAnswerResponse:
    # 1. 턴 제한 또는 큐 비어있으면 즉시 종료 (LLM 호출 없음)
    if len(history) + 1 >= MAX_TURNS or not questionsQueue:
        return InterviewAnswerResponse(
            nextQuestion=None,
            updatedQueue=[],
            sessionComplete=True,
        )

    # 2. 꼬리질문 필요 여부 판단 (LLM 1회) — 동일 페르소나 MAX_FOLLOWUPS 초과 시 스킵
    trailing = _count_trailing_persona(history, currentPersona)
    followup_data = _check_followup(currentQuestion, currentAnswer, currentPersona, resumeText, model=model) \
        if trailing < MAX_FOLLOWUPS else {"shouldFollowUp": False}

    if followup_data["shouldFollowUp"]:
        # 꼬리질문 반환 — 큐는 변경하지 않음
        return InterviewAnswerResponse(
            nextQuestion=QuestionWithPersona(
                persona=currentPersona,
                personaLabel=PERSONA_LABELS[currentPersona],
                question=followup_data["followupQuestion"],
                type="follow_up",
            ),
            updatedQueue=list(questionsQueue),
            sessionComplete=False,
        )

    # 3. 꼬리질문 불필요 → 큐에서 다음 질문 생성 (LLM 1회)
    next_item = questionsQueue[0]
    persona = next_item.persona

    prompt_file = PROMPT_DIR / PERSONA_PROMPTS[persona]
    prompt_template = prompt_file.read_text(encoding="utf-8")
    personas_context = PERSONA_LABELS[persona]
    prompt = prompt_template.replace("{resume_text}", resumeText[:16000]).replace("{personas_context}", personas_context)

    raw = _call_llm(prompt, model=model)
    data = _parse_object(raw, required_keys=["question"])

    next_question = QuestionWithPersona(
        persona=persona,
        personaLabel=data.get("personaLabel", PERSONA_LABELS[persona]),
        question=data["question"],
        type=next_item.type,
    )

    return InterviewAnswerResponse(
        nextQuestion=next_question,
        updatedQueue=list(questionsQueue[1:]),
        sessionComplete=False,
    )


def generate_followup(
    question: str,
    answer: str,
    persona: str,
    resumeText: str,
    *,
    model: str | None = None,
) -> FollowupResponse:
    data = _check_followup(question, answer, persona, resumeText, model=model)

    return FollowupResponse(
        followupType=data["followupType"],
        followupQuestion=data["followupQuestion"],
        reasoning=data["reasoning"],
    )
