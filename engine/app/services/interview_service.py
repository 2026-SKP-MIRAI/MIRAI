from pathlib import Path
from app.schemas import (
    InterviewStartResponse, InterviewAnswerResponse, FollowupResponse,
    QuestionWithPersona, QueueItem, UsageMetadata,
)
from app.services.llm_client import call_llm as _call_llm, parse_object as _parse_object, UsageInfo

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
PERSONA_LABELS = {"hr": "HR 담당자", "tech_lead": "기술팀장", "executive": "경영진"}
PERSONA_PROMPTS = {
    "hr": "interview_hr_v2.md",
    "tech_lead": "interview_tech_lead_v2.md",
    "executive": "interview_executive_v2.md",
}

MAX_TURNS = 10
MAX_FOLLOWUPS = 2  # 동일 페르소나 꼬리질문 최대 횟수


def _usage_to_metadata(usage: UsageInfo | None, model: str) -> UsageMetadata | None:
    if usage is None:
        return None
    return UsageMetadata(
        prompt_tokens=usage.prompt_tokens,
        completion_tokens=usage.completion_tokens,
        total_tokens=usage.total_tokens,
        model=model,
    )


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
) -> tuple[dict, UsageInfo | None, str]:
    """followup 필요 여부를 LLM으로 판단. (dict, usage, model) 반환."""
    prompt_file = PROMPT_DIR / "interview_followup_v2.md"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    persona_context = PERSONA_LABELS.get(persona, persona)
    prompt = (
        prompt_template
        .replace("{question}", question)
        .replace("{answer}", answer)
        .replace("{persona_context}", persona_context)
        .replace("{resume_text}", resumeText[:16000])
    )
    result = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    return _parse_object(result.content, required_keys=["shouldFollowUp", "followupType", "followupQuestion", "reasoning"]), result.usage, result.model


def start_interview(
    resumeText: str,
    personas: list[str],
    *,
    model: str | None = None,
) -> tuple[InterviewStartResponse, UsageMetadata | None]:
    first_persona = personas[0]
    prompt_file = PROMPT_DIR / PERSONA_PROMPTS[first_persona]
    prompt_template = prompt_file.read_text(encoding="utf-8")
    personas_context = ", ".join(PERSONA_LABELS[p] for p in personas)
    prompt = prompt_template.replace("{resume_text}", resumeText[:16000]).replace("{personas_context}", personas_context)

    result = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    data = _parse_object(result.content, required_keys=["question"])

    first_question = QuestionWithPersona(
        persona=first_persona,
        personaLabel=data.get("personaLabel", PERSONA_LABELS[first_persona]),
        question=data["question"],
        type="main",
    )

    questions_queue = _build_queue(personas, MAX_TURNS)

    return InterviewStartResponse(firstQuestion=first_question, questionsQueue=questions_queue), _usage_to_metadata(result.usage, result.model)


def process_answer(
    resumeText: str,
    history: list,
    questionsQueue: list,
    currentQuestion: str,
    currentPersona: str,
    currentAnswer: str,
    *,
    model: str | None = None,
) -> tuple[InterviewAnswerResponse, UsageMetadata | None]:
    # 1. 턴 제한 또는 큐 비어있으면 즉시 종료 (LLM 호출 없음)
    if len(history) + 1 >= MAX_TURNS or not questionsQueue:
        return InterviewAnswerResponse(
            nextQuestion=None,
            updatedQueue=[],
            sessionComplete=True,
        ), None

    # 2. 꼬리질문 필요 여부 판단 (LLM 1회) — 동일 페르소나 MAX_FOLLOWUPS 초과 시 스킵
    trailing = _count_trailing_persona(history, currentPersona)
    if trailing < MAX_FOLLOWUPS:
        followup_data, followup_raw_usage, followup_model = _check_followup(
            currentQuestion, currentAnswer, currentPersona, resumeText, model=model
        )
    else:
        followup_data, followup_raw_usage, followup_model = {"shouldFollowUp": False}, None, ""

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
        ), _usage_to_metadata(followup_raw_usage, followup_model)

    # 3. 꼬리질문 불필요 → 큐에서 다음 질문 생성 (LLM 1회)
    next_item = questionsQueue[0]
    persona = next_item.persona

    prompt_file = PROMPT_DIR / PERSONA_PROMPTS[persona]
    prompt_template = prompt_file.read_text(encoding="utf-8")
    personas_context = PERSONA_LABELS[persona]
    prompt = prompt_template.replace("{resume_text}", resumeText[:16000]).replace("{personas_context}", personas_context)

    result = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    data = _parse_object(result.content, required_keys=["question"])

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
    ), _usage_to_metadata(result.usage, result.model)


def generate_followup(
    question: str,
    answer: str,
    persona: str,
    resumeText: str,
    *,
    model: str | None = None,
) -> tuple[FollowupResponse, UsageMetadata | None]:
    data, raw_usage, llm_model = _check_followup(question, answer, persona, resumeText, model=model)

    return FollowupResponse(
        followupType=data["followupType"],
        followupQuestion=data["followupQuestion"],
        reasoning=data["reasoning"],
    ), _usage_to_metadata(raw_usage, llm_model)
