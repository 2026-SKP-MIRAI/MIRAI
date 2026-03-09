import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return fake


def make_mock_llm_side_effect(contents: list[str]):
    fake = MagicMock()
    fake.chat.completions.create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=c))]) for c in contents
    ]
    return fake


# ── 사이클 1: 스키마 유효성 ─────────────────────────────────────────────────

def test_interview_start_request_valid():
    from app.schemas import InterviewStartRequest
    req = InterviewStartRequest(resumeText="이력서", personas=["hr", "tech_lead"])
    assert req.resumeText == "이력서"
    assert req.mode == "panel"


def test_interview_start_request_empty_resume_text():
    from app.schemas import InterviewStartRequest
    with pytest.raises(ValidationError):
        InterviewStartRequest(resumeText="", personas=["hr"])


def test_answer_request_valid():
    from app.schemas import InterviewAnswerRequest, HistoryItem, QueueItem
    req = InterviewAnswerRequest(
        resumeText="이력서",
        history=[HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")],
        questionsQueue=[QueueItem(persona="tech_lead", type="main")],
        currentQuestion="현재 질문",
        currentPersona="hr",
        currentAnswer="내 답변",
    )
    assert req.currentAnswer == "내 답변"
    assert req.currentQuestion == "현재 질문"
    assert req.currentPersona == "hr"


def test_answer_request_missing_fields():
    from app.schemas import InterviewAnswerRequest
    with pytest.raises(ValidationError):
        InterviewAnswerRequest(history=[], questionsQueue=[], currentAnswer="답변")


def test_followup_request_valid():
    from app.schemas import FollowupRequest
    req = FollowupRequest(question="질문", answer="답변", persona="hr", resumeText="이력서")
    assert req.persona == "hr"


def test_answer_response_next_question_optional():
    from app.schemas import InterviewAnswerResponse
    resp = InterviewAnswerResponse(nextQuestion=None, updatedQueue=[], sessionComplete=True)
    assert resp.nextQuestion is None
    assert resp.sessionComplete is True


# ── 사이클 2: interview_service (LLM mock) ───────────────────────────────────

HR_QUESTION_JSON = '{"question": "팀워크 경험을 말씀해 주세요.", "personaLabel": "HR 담당자"}'
TECH_QUESTION_JSON = '{"question": "기술 스택을 설명해 주세요.", "personaLabel": "기술팀장"}'
EXEC_QUESTION_JSON = '{"question": "5년 후 목표는?", "personaLabel": "경영진"}'
FOLLOWUP_JSON = '{"shouldFollowUp": true, "followupType": "CLARIFY", "followupQuestion": "더 구체적으로 말씀해 주세요.", "reasoning": "답변이 모호합니다."}'
NO_FOLLOWUP_JSON = '{"shouldFollowUp": false, "followupType": "CLARIFY", "followupQuestion": "...", "reasoning": "충분합니다."}'


def test_start_returns_first_hr_question():
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm(HR_QUESTION_JSON)):
        from app.services.interview_service import start_interview
        result = start_interview("이력서 내용", ["hr", "tech_lead", "executive"])
    assert result.firstQuestion.persona == "hr"
    assert result.firstQuestion.personaLabel == "HR 담당자"
    assert "팀워크" in result.firstQuestion.question


def test_start_returns_questions_queue():
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm(HR_QUESTION_JSON)):
        from app.services.interview_service import start_interview
        result = start_interview("이력서", ["hr", "tech_lead", "executive"])
    # MAX_TURNS=10 → 큐 9개
    assert len(result.questionsQueue) == 9
    assert result.questionsQueue[0].persona == "tech_lead"
    assert result.questionsQueue[1].persona == "executive"


def test_process_answer_returns_next_question():
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    # LLM 2회: 1) followup check (shouldFollowUp=false), 2) next question
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm_side_effect([NO_FOLLOWUP_JSON, TECH_QUESTION_JSON])):
        from app.services.interview_service import process_answer
        result = process_answer("이력서", history, queue, "현재 질문", "hr", "내 답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.persona == "tech_lead"
    assert result.sessionComplete is False


def test_process_answer_session_complete_when_queue_empty():
    from app.services.interview_service import process_answer
    result = process_answer("이력서", [], [], "현재 질문", "hr", "마지막 답변")
    assert result.sessionComplete is True
    assert result.nextQuestion is None
    assert result.updatedQueue == []


def test_process_answer_nextQuestion_is_none_when_session_complete():
    from app.services.interview_service import process_answer
    result = process_answer("이력서", [], [], "현재 질문", "hr", "답변")
    assert result.nextQuestion is None


def test_process_answer_returns_followup_when_insufficient():
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main"), QueueItem(persona="executive", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    # LLM 1회: shouldFollowUp=True → 꼬리질문 반환
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm(FOLLOWUP_JSON)):
        from app.services.interview_service import process_answer
        result = process_answer("이력서", history, queue, "현재 질문", "hr", "모호한 답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.type == "follow_up"
    assert result.nextQuestion.persona == "hr"
    # 큐 변경 없음
    assert len(result.updatedQueue) == len(queue)
    assert result.sessionComplete is False


def test_process_answer_skips_followup_at_max_followups():
    """동일 페르소나가 history 끝에 MAX_FOLLOWUPS번 연속이면 꼬리질문 스킵 → 다음 질문 생성."""
    from app.schemas import QueueItem, HistoryItem
    from app.services.interview_service import MAX_FOLLOWUPS
    # history 끝에 hr이 MAX_FOLLOWUPS번 연속
    history = [
        HistoryItem(persona="hr", personaLabel="HR 담당자", question=f"질문{i}", answer=f"답변{i}")
        for i in range(MAX_FOLLOWUPS)
    ]
    queue = [QueueItem(persona="tech_lead", type="main")]
    # LLM 1회만 호출 (followup check 스킵 → next question 생성만)
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm(TECH_QUESTION_JSON)):
        from app.services.interview_service import process_answer
        result = process_answer("이력서", history, queue, "현재 질문", "hr", "답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.type == "main"
    assert result.nextQuestion.persona == "tech_lead"
    assert result.sessionComplete is False


def test_process_answer_session_complete_at_max_turns():
    from app.schemas import QueueItem, HistoryItem
    from app.services.interview_service import MAX_TURNS
    # history 9개 → len(history)+1 = 10 >= MAX_TURNS → 즉시 종료, LLM 호출 없음
    history = [
        HistoryItem(persona="hr", personaLabel="HR 담당자", question=f"질문{i}", answer=f"답변{i}")
        for i in range(MAX_TURNS - 1)
    ]
    queue = [QueueItem(persona="tech_lead", type="main")]
    from app.services.interview_service import process_answer
    result = process_answer("이력서", history, queue, "현재 질문", "hr", "답변")
    assert result.sessionComplete is True
    assert result.nextQuestion is None


@pytest.mark.parametrize("followup_type", ["CLARIFY", "CHALLENGE", "EXPLORE"])
def test_followup_type_parses_llm_output(followup_type):
    followup_json = f'{{"shouldFollowUp": true, "followupType": "{followup_type}", "followupQuestion": "꼬리질문", "reasoning": "이유"}}'
    with patch("app.services.interview_service.OpenAI", return_value=make_mock_llm(followup_json)):
        from app.services.interview_service import generate_followup
        result = generate_followup("질문", "답변", "hr", "이력서")
    assert result.followupType == followup_type
    assert result.followupQuestion == "꼬리질문"
    assert result.reasoning == "이유"
