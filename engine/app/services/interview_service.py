from pathlib import Path
from app.schemas import (
    InterviewStartResponse, InterviewAnswerResponse, FollowupResponse,
    QuestionWithPersona, QueueItem,
)
from app.services.llm_client import call_llm as _call_llm, parse_object as _parse_object

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
PERSONA_LABELS = {"hr": "HR 담당자", "tech_lead": "기술팀장", "executive": "경영진"}
PERSONA_PROMPTS = {
    "hr": "interview_hr_v1.md",
    "tech_lead": "interview_tech_lead_v1.md",
    "executive": "interview_executive_v1.md",
}

MAX_TURNS = 10
MAX_FOLLOWUPS = 2  # 동일 페르소나 꼬리질문 최대 횟수


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
    raw = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
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

    raw = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
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

    raw = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
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
