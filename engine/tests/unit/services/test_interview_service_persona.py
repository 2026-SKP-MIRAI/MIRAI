"""페르소나별 꼬리질문 프롬프트 라우팅 테스트."""
import pytest
from unittest.mock import MagicMock, patch


def _make_llm_result(content: str = '{"shouldFollowUp": false}') -> MagicMock:
    r = MagicMock()
    r.content = content
    r.usage = None
    r.model = "test"
    return r


class TestPersonaFollowupPromptRouting:
    """_check_followup이 페르소나별로 올바른 프롬프트 파일을 로드하는지 검증."""

    def test_hr_loads_persona_hr_prompt(self, monkeypatch):
        import app.services.interview_service as svc
        loaded = []

        def mock_read(self, **kwargs):
            loaded.append(self.name)
            return "TEMPLATE {question} {answer} {persona_signals} {pressure_type} {resume_text}"

        monkeypatch.setattr(svc.Path, "read_text", mock_read)
        monkeypatch.setattr(svc, "_call_llm", lambda *a, **kw: _make_llm_result())
        monkeypatch.setattr(svc, "_parse_object", lambda c, **kw: {"shouldFollowUp": False})

        svc._check_followup("질문", "협업했습니다" * 10, "hr", "이력서")
        assert any("interview_followup_hr_v3" in n for n in loaded)

    def test_tech_lead_loads_persona_tech_prompt(self, monkeypatch):
        import app.services.interview_service as svc
        loaded = []

        def mock_read(self, **kwargs):
            loaded.append(self.name)
            return "TEMPLATE {question} {answer} {persona_signals} {pressure_type} {resume_text}"

        monkeypatch.setattr(svc.Path, "read_text", mock_read)
        monkeypatch.setattr(svc, "_call_llm", lambda *a, **kw: _make_llm_result())
        monkeypatch.setattr(svc, "_parse_object", lambda c, **kw: {"shouldFollowUp": False})

        svc._check_followup("질문", "설계했습니다" * 10, "tech_lead", "이력서")
        assert any("interview_followup_tech_lead_v3" in n for n in loaded)

    def test_executive_loads_persona_exec_prompt(self, monkeypatch):
        import app.services.interview_service as svc
        loaded = []

        def mock_read(self, **kwargs):
            loaded.append(self.name)
            return "TEMPLATE {question} {answer} {persona_signals} {pressure_type} {resume_text}"

        monkeypatch.setattr(svc.Path, "read_text", mock_read)
        monkeypatch.setattr(svc, "_call_llm", lambda *a, **kw: _make_llm_result())
        monkeypatch.setattr(svc, "_parse_object", lambda c, **kw: {"shouldFollowUp": False})

        svc._check_followup("질문", "매출 성장했습니다" * 5, "executive", "이력서")
        assert any("interview_followup_executive_v3" in n for n in loaded)

    def test_unknown_persona_fallback(self, monkeypatch):
        import app.services.interview_service as svc
        loaded = []

        def mock_read(self, **kwargs):
            loaded.append(self.name)
            return "TEMPLATE {question} {answer} {persona_signals} {pressure_type} {resume_text}"

        monkeypatch.setattr(svc.Path, "read_text", mock_read)
        monkeypatch.setattr(svc, "_call_llm", lambda *a, **kw: _make_llm_result())
        monkeypatch.setattr(svc, "_parse_object", lambda c, **kw: {"shouldFollowUp": False})

        svc._check_followup("질문", "답변입니다" * 10, "unknown_persona", "이력서")
        assert any("interview_followup" in n for n in loaded)

    def test_same_answer_different_personas_different_prompts(self, monkeypatch):
        """동일 답변 + 다른 페르소나 → LLM에 다른 프롬프트 전달."""
        import app.services.interview_service as svc
        prompts_sent = []

        def mock_read(self, **kwargs):
            return f"TEMPLATE_FOR_{self.name} {{question}} {{answer}} {{persona_signals}} {{pressure_type}} {{resume_text}}"

        def mock_llm(prompt, **kw):
            prompts_sent.append(prompt)
            return _make_llm_result()

        monkeypatch.setattr(svc.Path, "read_text", mock_read)
        monkeypatch.setattr(svc, "_call_llm", mock_llm)
        monkeypatch.setattr(svc, "_parse_object", lambda c, **kw: {"shouldFollowUp": False})

        answer = "협업하여 설계하고 매출 성과를 달성했습니다. " * 5
        for persona in ["hr", "tech_lead", "executive"]:
            svc._check_followup("질문", answer, persona, "이력서")

        assert len(prompts_sent) == 3
        assert len(set(prompts_sent)) == 3  # 모두 다름

    def test_classify_followup_type_vague_answer_returns_clarify(self):
        """모호 표현 과다 or 내용 부족 답변 → CLARIFY."""
        from app.services.interview_service import _classify_followup_type
        # 50자 미만 → has_content=False → CLARIFY
        assert _classify_followup_type("짧은 답변") == "CLARIFY"
