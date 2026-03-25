import asyncio
import json
import logging
from pathlib import Path

from app.analyzers import analyze
from app.analyzers.pressure_controller import classify_pressure
from app.analyzers.answer_signals import format_persona_signals
from app.schemas import (
    FollowupType,
    InterviewStartResponse, InterviewAnswerResponse, FollowupResponse,
    QuestionWithPersona, QueueItem, UsageMetadata,
)
from app.services.llm_client import call_llm as _call_llm, parse_object as _parse_object, call_llm_stream, UsageInfo
from app.services.embedding_service import get_embeddings
from app.analyzers.followup_validator import validate_followup_overlap

logger = logging.getLogger(__name__)

PROMPT_DIR = Path(__file__).parent.parent / "prompts"
PERSONA_LABELS = {"hr": "HR 담당자", "tech_lead": "기술팀장", "executive": "경영진"}
PERSONA_PROMPTS = {
    "hr": "interview_hr_v2.md",
    "tech_lead": "interview_tech_lead_v2.md",
    "executive": "interview_executive_v2.md",
}
PERSONA_FOLLOWUP_PROMPTS = {
    "hr": "interview_followup_hr_v3.md",
    "tech_lead": "interview_followup_tech_lead_v3.md",
    "executive": "interview_followup_executive_v3.md",
}

MAX_TURNS = 10
MAX_FOLLOWUPS = 2  # 동일 페르소나 꼬리질문 최대 횟수


def _classify_followup_type(answer: str) -> FollowupType:
    signals = analyze(answer)
    return classify_pressure(signals)


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
    signals: object | None = None,
) -> tuple[dict, UsageInfo | None, str]:
    """followup 필요 여부를 LLM으로 판단. (dict, usage, model) 반환."""
    if signals is None:
        signals = analyze(answer)
    pressure_type = classify_pressure(signals)
    persona_signals_text = format_persona_signals(answer, signals, persona)
    followup_prompt_name = PERSONA_FOLLOWUP_PROMPTS.get(persona, "interview_followup_v2.md")
    prompt_file = PROMPT_DIR / followup_prompt_name
    prompt_template = prompt_file.read_text(encoding="utf-8")
    prompt = (
        prompt_template
        .replace("{question}", question)
        .replace("{answer}", answer)
        .replace("{persona_signals}", persona_signals_text)
        .replace("{pressure_type}", pressure_type)
        .replace("{resume_text}", resumeText[:16000])
    )
    result = _call_llm(prompt, model=model, error_message="면접 진행 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.")
    return _parse_object(result.content, required_keys=["shouldFollowUp"]), result.usage, result.model


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

    raw_question = data["question"]
    if isinstance(raw_question, dict):
        # LLM이 question 필드에 nested object를 반환한 경우 — 첫 번째 문자열 값을 추출
        question_text = next(
            (v if isinstance(v, str) else v[0] if isinstance(v, list) and v else str(v)
             for v in raw_question.values()),
            "면접 질문을 생성할 수 없습니다."
        )
    else:
        question_text = str(raw_question)

    first_question = QuestionWithPersona(
        persona=first_persona,
        personaLabel=data.get("personaLabel", PERSONA_LABELS[first_persona]),
        question=question_text,
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
        signals = analyze(currentAnswer)
        followup_type = classify_pressure(signals)
        followup_data, followup_raw_usage, followup_model = _check_followup(
            currentQuestion, currentAnswer, currentPersona, resumeText, model=model, signals=signals
        )
    else:
        followup_data, followup_raw_usage, followup_model = {"shouldFollowUp": False}, None, ""

    if followup_data["shouldFollowUp"]:
        reasoning = followup_data.get("reasoning", "")
        weak_part = reasoning.strip() or currentAnswer

        initial_fr = FollowupResponse(
            followupType=followup_type,
            followupQuestion=followup_data.get("followupQuestion", ""),
            reasoning=reasoning,
        )
        initial_usage = _usage_to_metadata(followup_raw_usage, followup_model)

        def _regenerate_followup():
            d, u, m = _check_followup(
                currentQuestion, currentAnswer, currentPersona, resumeText, model=model, signals=signals
            )
            return FollowupResponse(
                followupType=followup_type,
                followupQuestion=d.get("followupQuestion", ""),
                reasoning=d.get("reasoning", ""),
            ), _usage_to_metadata(u, m)

        validated_fr, validated_usage = validate_followup_overlap(
            followup_question=initial_fr.followupQuestion,
            weak_part=weak_part,
            generate_fn=_regenerate_followup,
            get_embeddings_fn=get_embeddings,
            initial_response=(initial_fr, initial_usage),
        )

        logger.info(
            "process_answer overlap 검증 완료: followupQuestion=%s",
            validated_fr.followupQuestion,
        )

        # 꼬리질문 반환 — 큐는 변경하지 않음
        return InterviewAnswerResponse(
            nextQuestion=QuestionWithPersona(
                persona=currentPersona,
                personaLabel=PERSONA_LABELS[currentPersona],
                question=validated_fr.followupQuestion,
                type="follow_up",
            ),
            updatedQueue=list(questionsQueue),
            sessionComplete=False,
        ), validated_usage

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


def _sse_token(text: str) -> str:
    return f"data: {json.dumps({'type': 'token', 'text': text}, ensure_ascii=False)}\n\n"


def _sse_meta(persona: str, persona_label: str) -> str:
    return f"data: {json.dumps({'type': 'meta', 'persona': persona, 'personaLabel': persona_label}, ensure_ascii=False)}\n\n"


def _sse_error(message: str) -> str:
    return f"data: {json.dumps({'type': 'error', 'message': message}, ensure_ascii=False)}\n\n"


def _sse_done(response: "InterviewAnswerResponse") -> str:
    payload = {
        "type": "done",
        "nextQuestion": response.nextQuestion.model_dump() if response.nextQuestion else None,
        "updatedQueue": [q.model_dump() for q in response.updatedQueue],
        "sessionComplete": response.sessionComplete,
    }
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def _stream_words(text: str):
    """단어 단위로 SSE token 이벤트를 yield (word-by-word 스트리밍)."""
    for i, word in enumerate(text.split()):
        yield _sse_token(word if i == 0 else " " + word)
        await asyncio.sleep(0.07)


async def process_answer_stream(
    resumeText: str,
    history: list,
    questionsQueue: list,
    currentQuestion: str,
    currentPersona: str,
    currentAnswer: str,
    *,
    model: str | None = None,
):
    """SSE 스트리밍 버전. token* + done 이벤트를 yield."""
    try:
        # Path A: 턴 제한 또는 큐 비어있음 → 즉시 done
        if len(history) + 1 >= MAX_TURNS or not questionsQueue:
            yield _sse_done(InterviewAnswerResponse(
                nextQuestion=None, updatedQueue=[], sessionComplete=True
            ))
            return

        # Path B/C: 꼬리질문 판단 (동기 LLM #1 → asyncio.to_thread)
        trailing = _count_trailing_persona(history, currentPersona)
        if trailing < MAX_FOLLOWUPS:
            followup_data, _, _ = await asyncio.to_thread(
                _check_followup, currentQuestion, currentAnswer, currentPersona, resumeText, model=model
            )
        else:
            followup_data = {"shouldFollowUp": False}

        followup_question = followup_data.get("followupQuestion", "").strip()
        if followup_data["shouldFollowUp"] and followup_question:
            # Path B: 꼬리질문 — 페르소나 메타 먼저 전송 후 단어 단위 token 스트리밍
            yield _sse_meta(currentPersona, PERSONA_LABELS[currentPersona])
            async for chunk in _stream_words(followup_question):
                yield chunk
            yield _sse_done(InterviewAnswerResponse(
                nextQuestion=QuestionWithPersona(
                    persona=currentPersona,
                    personaLabel=PERSONA_LABELS[currentPersona],
                    question=followup_question,
                    type="follow_up",
                ),
                updatedQueue=list(questionsQueue),
                sessionComplete=False,
            ))
            return

        # Path C: 다음 질문 생성 — LLM #2 silent 수집 후 텍스트만 스트리밍
        next_item = questionsQueue[0]
        persona = next_item.persona
        prompt_file = PROMPT_DIR / PERSONA_PROMPTS[persona]
        prompt_template = prompt_file.read_text(encoding="utf-8")
        personas_context = PERSONA_LABELS[persona]
        prompt = prompt_template.replace("{resume_text}", resumeText[:16000]).replace("{personas_context}", personas_context)

        # LLM 출력(JSON) silent 수집
        chunks: list[str] = []
        async for token in call_llm_stream(prompt, model=model, timeout=50.0):
            chunks.append(token)
        collected_text = "".join(chunks)

        if not collected_text.strip():
            raise Exception("면접 질문 생성에 실패했습니다. 다시 시도해 주세요.")

        # JSON 파싱 후 사용자 노출 텍스트만 단어 단위로 스트리밍
        data = _parse_object(collected_text, required_keys=["question"])
        question_text = data["question"]
        next_persona_label = data.get("personaLabel", PERSONA_LABELS[persona])
        yield _sse_meta(persona, next_persona_label)
        async for chunk in _stream_words(question_text):
            yield chunk
        yield _sse_done(InterviewAnswerResponse(
            nextQuestion=QuestionWithPersona(
                persona=persona,
                personaLabel=data.get("personaLabel", PERSONA_LABELS[persona]),
                question=data["question"],
                type=next_item.type,
            ),
            updatedQueue=list(questionsQueue[1:]),
            sessionComplete=False,
        ))

    except Exception as e:
        yield _sse_error(str(e) if str(e) else "면접 진행 중 오류가 발생했습니다.")


def generate_followup(
    question: str,
    answer: str,
    persona: str,
    resumeText: str,
    *,
    model: str | None = None,
) -> tuple[FollowupResponse, UsageMetadata | None]:
    # 1. 규칙 기반 유형 분류 (결정론적) — signals를 _check_followup과 공유해 analyze() 중복 호출 방지
    signals = analyze(answer)
    followup_type = classify_pressure(signals)

    # 2. LLM: 후속 질문 텍스트 생성
    data, raw_usage, llm_model = _check_followup(question, answer, persona, resumeText, model=model, signals=signals)

    initial_response = FollowupResponse(
        followupType=followup_type,
        followupQuestion=data.get("followupQuestion", ""),
        reasoning=data.get("reasoning", ""),
    )
    initial_usage = _usage_to_metadata(raw_usage, llm_model)

    # 3. weak_part 추출: reasoning.strip() → fallback answer 전체
    reasoning = data.get("reasoning", "")
    weak_part = reasoning.strip() or answer

    # 4. 재생성 클로저 정의
    def _regenerate() -> tuple[FollowupResponse, UsageMetadata | None]:
        d, u, m = _check_followup(question, answer, persona, resumeText, model=model)
        return FollowupResponse(
            followupType=followup_type,
            followupQuestion=d.get("followupQuestion", ""),
            reasoning=d.get("reasoning", ""),
        ), _usage_to_metadata(u, m)

    # 5. overlap 검증 루프 (OVERLAP_THRESHOLD 미달 시 최대 MAX_REGENERATION_ATTEMPTS회 재생성)
    return validate_followup_overlap(
        followup_question=initial_response.followupQuestion,
        weak_part=weak_part,
        generate_fn=_regenerate,
        get_embeddings_fn=get_embeddings,
        initial_response=(initial_response, initial_usage),
    )
