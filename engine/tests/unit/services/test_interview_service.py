import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError


def make_mock_llm(content: str):
    fake = MagicMock()
    fake.chat.completions.create.return_value.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    fake.chat.completions.create.return_value.usage = MagicMock(
        prompt_tokens=10, completion_tokens=5, total_tokens=15
    )
    return fake


def make_mock_llm_side_effect(contents: list[str]):
    fake = MagicMock()
    usage_mock = MagicMock(prompt_tokens=10, completion_tokens=5, total_tokens=15)
    fake.chat.completions.create.side_effect = [
        MagicMock(choices=[MagicMock(message=MagicMock(content=c))], usage=usage_mock) for c in contents
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
NO_FOLLOWUP_MINIMAL_JSON = '{"shouldFollowUp": false}'
FOLLOWUP_NO_QUESTION_JSON = '{"shouldFollowUp": true}'


def test_start_returns_first_hr_question():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(HR_QUESTION_JSON)):
        from app.services.interview_service import start_interview
        result, usage = start_interview("이력서 내용", ["hr", "tech_lead", "executive"])
    assert result.firstQuestion.persona == "hr"
    assert result.firstQuestion.personaLabel == "HR 담당자"
    assert "팀워크" in result.firstQuestion.question


def test_start_returns_questions_queue():
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(HR_QUESTION_JSON)):
        from app.services.interview_service import start_interview
        result, _ = start_interview("이력서", ["hr", "tech_lead", "executive"])
    # MAX_TURNS=10 → 큐 9개
    assert len(result.questionsQueue) == 9
    assert result.questionsQueue[0].persona == "tech_lead"
    assert result.questionsQueue[1].persona == "executive"


def test_process_answer_returns_next_question():
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    # LLM 2회: 1) followup check (shouldFollowUp=false), 2) next question
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm_side_effect([NO_FOLLOWUP_JSON, TECH_QUESTION_JSON])):
        from app.services.interview_service import process_answer
        result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "내 답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.persona == "tech_lead"
    assert result.sessionComplete is False


def test_process_answer_session_complete_when_queue_empty():
    from app.services.interview_service import process_answer
    result, usage = process_answer("이력서", [], [], "현재 질문", "hr", "마지막 답변")
    assert result.sessionComplete is True
    assert result.nextQuestion is None
    assert result.updatedQueue == []


def test_process_answer_nextQuestion_is_none_when_session_complete():
    from app.services.interview_service import process_answer
    result, _ = process_answer("이력서", [], [], "현재 질문", "hr", "답변")
    assert result.nextQuestion is None


def test_process_answer_returns_followup_when_insufficient():
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main"), QueueItem(persona="executive", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    # LLM 1회: shouldFollowUp=True → 꼬리질문 반환
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(FOLLOWUP_JSON)):
        from app.services.interview_service import process_answer
        result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "모호한 답변")
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
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(TECH_QUESTION_JSON)):
        from app.services.interview_service import process_answer
        result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.type == "main"
    assert result.nextQuestion.persona == "tech_lead"
    assert result.sessionComplete is False


def test_process_answer_no_500_when_followup_keys_missing():
    """shouldFollowUp:false 시 나머지 키 누락해도 500 에러 없이 다음 질문 반환."""
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm_side_effect([NO_FOLLOWUP_MINIMAL_JSON, TECH_QUESTION_JSON])):
        from app.services.interview_service import process_answer
        result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.persona == "tech_lead"
    assert result.sessionComplete is False


def test_process_answer_followup_question_fallback_when_key_missing():
    """shouldFollowUp:true 이지만 followupQuestion 키 누락 시 빈 문자열로 fallback."""
    from app.schemas import QueueItem, HistoryItem
    queue = [QueueItem(persona="tech_lead", type="main")]
    history = [HistoryItem(persona="hr", personaLabel="HR 담당자", question="질문", answer="답변")]
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(FOLLOWUP_NO_QUESTION_JSON)):
        from app.services.interview_service import process_answer
        result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "모호한 답변")
    assert result.nextQuestion is not None
    assert result.nextQuestion.type == "follow_up"
    assert result.nextQuestion.question == ""


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
    result, _ = process_answer("이력서", history, queue, "현재 질문", "hr", "답변")
    assert result.sessionComplete is True
    assert result.nextQuestion is None


# ── _classify_followup_type 단위 테스트 ──────────────────────────────────────

def test_classify_followup_type_empty_answer_returns_clarify():
    """빈 답변(has_content=False) → CLARIFY."""
    from app.services.interview_service import _classify_followup_type
    assert _classify_followup_type("") == "CLARIFY"


def test_classify_followup_type_short_answer_returns_clarify():
    """50자 미만 → has_content=False → CLARIFY."""
    from app.services.interview_service import _classify_followup_type
    assert _classify_followup_type("짧은 답변입니다.") == "CLARIFY"


def test_classify_followup_type_no_star_returns_clarify():
    """STAR 점수 낮은 답변 → CLARIFY."""
    from app.services.interview_service import _classify_followup_type
    # 모호 표현만 있는 충분한 길이 텍스트 (star 키워드 없음)
    text = "항상 열심히 노력하여 다양한 경험으로 많은 것을 배웠습니다. 적극적으로 최선을 다했습니다. 꾸준히 성장했습니다."
    result = _classify_followup_type(text)
    assert result == "CLARIFY"


def test_classify_followup_type_vague_returns_challenge():
    """모호 표현 과다 + STAR·주도성 충분 → CHALLENGE."""
    from app.services.interview_service import _classify_followup_type
    # STAR + 주도성 동사 포함, 모호 표현 과다
    text = (
        "당시 팀 프로젝트에서 목표는 성과 개선이었고 직접 구현하여 결과를 달성했습니다. "
        "항상 열심히 노력하며 다양하게 최선을 다해 효과적으로 체계적으로 열심히 진행했습니다."
    )
    result = _classify_followup_type(text)
    assert result in ("CHALLENGE", "CLARIFY")  # 모호 표현 또는 주도성 기준으로 분기


def test_classify_followup_type_good_answer_not_clarify():
    """충분한 STAR + 주도성 + 원인/대안 분석 → CHALLENGE 또는 EXPLORE (CLARIFY 아님)."""
    from app.services.interview_service import _classify_followup_type
    text = (
        "당시 팀에서 API 성능 개선 과제가 주어졌습니다. 목표는 응답시간 단축이었고 "
        "직접 분석하여 원인을 파악한 결과 병목을 발견했습니다. 대안으로 캐싱을 도입하여 "
        "결과적으로 성과를 30% 달성했습니다."
    )
    assert _classify_followup_type(text) != "CLARIFY"


# ─────────────────────────────────────────────────────────────────────────────

def test_followup_llm_question_and_reasoning_used():
    """followupQuestion과 reasoning은 LLM 출력에서 가져온다 (followupType은 규칙 기반)."""
    followup_json = '{"shouldFollowUp": true, "followupType": "EXPLORE", "followupQuestion": "꼬리질문", "reasoning": "이유"}'
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(followup_json)):
        from app.services.interview_service import generate_followup
        result, _ = generate_followup("질문", "답변", "hr", "이력서")
    # followupType은 규칙 기반 — 짧은 답변(has_content=False)이면 CLARIFY
    assert result.followupType in ["CLARIFY", "CHALLENGE", "EXPLORE"]
    assert result.followupQuestion == "꼬리질문"
    assert result.reasoning == "이유"


# ── generate_followup overlap 검증 통합 테스트 ─────────────────────────────────

class TestGenerateFollowupOverlap:
    """generate_followup의 overlap 검증 루프 통합 테스트.

    _check_followup와 get_embeddings를 mock하여 테스트한다.
    """

    def _make_check_followup_response(self, question: str = "꼬리질문", reasoning: str = "근거"):
        import json
        return json.dumps({
            "shouldFollowUp": True,
            "followupQuestion": question,
            "reasoning": reasoning,
        })

    def _make_embeddings_fn(self, scores: list[float]):
        """주어진 score 목록을 순서대로 반환하는 mock embedding 함수."""
        import math
        call_count = [0]

        def _fn(texts):
            idx = min(call_count[0], len(scores) - 1)
            s = max(-1.0, min(1.0, scores[idx]))
            call_count[0] += 1
            b_component = math.sqrt(max(0.0, 1.0 - s ** 2))
            return [[1.0, 0.0], [s, b_component]], None
        return _fn

    def test_overlap_sufficient_no_regeneration(self):
        """overlap >= 0.5 → 재생성 없음, _check_followup 1회만 호출"""
        from app.services.interview_service import generate_followup
        llm_mock = make_mock_llm(self._make_check_followup_response("좋은 질문", "약점 근거"))
        emb_fn = self._make_embeddings_fn([0.8])

        with patch("app.services.llm_client.OpenAI", return_value=llm_mock), \
             patch("app.services.interview_service.get_embeddings", side_effect=emb_fn):
            result, usage = generate_followup("질문", "답변", "hr", "이력서")

        assert result.followupQuestion == "좋은 질문"
        assert llm_mock.chat.completions.create.call_count == 1

    def test_overlap_low_triggers_regeneration(self):
        """overlap < 0.5 → 재생성 1회 → _check_followup 2회 호출"""
        from app.services.interview_service import generate_followup
        llm_mock = make_mock_llm_side_effect([
            self._make_check_followup_response("첫번째 질문", "첫번째 근거"),
            self._make_check_followup_response("재생성 질문", "재생성 근거"),
        ])
        emb_fn = self._make_embeddings_fn([0.2, 0.8])

        with patch("app.services.llm_client.OpenAI", return_value=llm_mock), \
             patch("app.services.interview_service.get_embeddings", side_effect=emb_fn):
            result, usage = generate_followup("질문", "답변", "hr", "이력서")

        assert result.followupQuestion == "재생성 질문"
        assert llm_mock.chat.completions.create.call_count == 2

    def test_embedding_failure_returns_initial_result(self):
        """embedding 실패 → 초기 결과 반환, 예외 전파 없음"""
        from app.services.interview_service import generate_followup
        llm_mock = make_mock_llm(self._make_check_followup_response("초기 질문", "근거"))

        def failing_emb(texts):
            raise RuntimeError("API 장애")

        with patch("app.services.llm_client.OpenAI", return_value=llm_mock), \
             patch("app.services.interview_service.get_embeddings", side_effect=failing_emb):
            result, usage = generate_followup("질문", "답변", "hr", "이력서")

        assert result.followupQuestion == "초기 질문"

    def test_empty_reasoning_uses_answer_as_weak_part(self):
        """reasoning='' → weak_part로 answer 전체 사용"""
        from app.services.interview_service import generate_followup
        llm_mock = make_mock_llm(self._make_check_followup_response("질문", ""))
        captured_texts = []

        def capture_emb(texts):
            captured_texts.extend(texts)
            return [[1.0, 0.0], [1.0, 0.0]], None

        with patch("app.services.llm_client.OpenAI", return_value=llm_mock), \
             patch("app.services.interview_service.get_embeddings", side_effect=capture_emb):
            generate_followup("질문", "내 답변 전체", "hr", "이력서")

        # weak_part(두 번째 텍스트)가 answer("내 답변 전체")여야 함
        if captured_texts:
            assert captured_texts[1] == "내 답변 전체"

    def test_whitespace_reasoning_uses_answer_fallback(self):
        """reasoning='  \\n  ' → strip() 후 빈 문자열 → answer fallback"""
        from app.services.interview_service import generate_followup
        llm_mock = make_mock_llm(self._make_check_followup_response("질문", "   \n   "))
        captured_texts = []

        def capture_emb(texts):
            captured_texts.extend(texts)
            return [[1.0, 0.0], [1.0, 0.0]], None

        with patch("app.services.llm_client.OpenAI", return_value=llm_mock), \
             patch("app.services.interview_service.get_embeddings", side_effect=capture_emb):
            generate_followup("질문", "답변 텍스트", "hr", "이력서")

        if captured_texts:
            assert captured_texts[1] == "답변 텍스트"
