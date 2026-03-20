import os
import pytest

PROMPTS_DIR = os.path.join(os.path.dirname(__file__), "../../../app/prompts")


def read_prompt(filename):
    path = os.path.join(PROMPTS_DIR, filename)
    with open(path, encoding="utf-8") as f:
        return f.read()


def test_v2_prompts_contain_required_placeholders():
    # 메인 프롬프트 3개: {resume_text}, {personas_context}
    for fname in ["interview_hr_v2.md", "interview_tech_lead_v2.md", "interview_executive_v2.md"]:
        content = read_prompt(fname)
        assert "{resume_text}" in content, f"{fname}: {{resume_text}} 누락"
        assert "{personas_context}" in content, f"{fname}: {{personas_context}} 누락"

    # followup 프롬프트: {persona_context}, {resume_text}, {question}, {answer}
    followup = read_prompt("interview_followup_v2.md")
    assert "{persona_context}" in followup, "followup v2: {persona_context} 누락"
    assert "{resume_text}" in followup, "followup v2: {resume_text} 누락"
    assert "{question}" in followup, "followup v2: {question} 누락"
    assert "{answer}" in followup, "followup v2: {answer} 누락"


def test_v2_prompts_output_format_contract():
    """출력 형식 계약: _parse_object 호환 단일 JSON 객체 명시 여부"""
    hr = read_prompt("interview_hr_v2.md")
    assert '"question"' in hr, "hr v2: 출력 포맷에 \"question\" 키 누락"
    assert '"personaLabel"' in hr, "hr v2: 출력 포맷에 \"personaLabel\" 키 누락"
    assert '"HR 담당자"' in hr, "hr v2: personaLabel 값 \"HR 담당자\" 누락"

    tech = read_prompt("interview_tech_lead_v2.md")
    assert '"question"' in tech, "tech_lead v2: 출력 포맷에 \"question\" 키 누락"
    assert '"personaLabel"' in tech, "tech_lead v2: 출력 포맷에 \"personaLabel\" 키 누락"
    assert '"기술팀장"' in tech, "tech_lead v2: personaLabel 값 \"기술팀장\" 누락"

    exec_ = read_prompt("interview_executive_v2.md")
    assert '"question"' in exec_, "executive v2: 출력 포맷에 \"question\" 키 누락"
    assert '"personaLabel"' in exec_, "executive v2: 출력 포맷에 \"personaLabel\" 키 누락"
    assert '"경영진"' in exec_, "executive v2: personaLabel 값 \"경영진\" 누락"


def test_v2_followup_output_format_contract():
    """followup 출력 4개 키 명시 여부"""
    followup = read_prompt("interview_followup_v2.md")
    for key in ["shouldFollowUp", "followupType", "followupQuestion", "reasoning"]:
        assert key in followup, f"followup v2: 출력 포맷에 \"{key}\" 키 누락"


def test_v2_prompts_persona_boundary_constraints():
    """페르소나 경계: HR은 기술 질문 금지, 경영진은 기술 세부 질문 금지 명시"""
    hr = read_prompt("interview_hr_v2.md")
    # HR 프롬프트에 기술 질문 금지 Negative Constraint 명시 확인
    assert "기술" in hr and ("금지" in hr or "하지 말" in hr or "묻지" in hr), \
        "hr v2: 기술 질문 금지 Negative Constraint 누락"

    exec_ = read_prompt("interview_executive_v2.md")
    # 경영진 프롬프트에 기술 세부 질문 금지 명시 확인
    assert "기술" in exec_ and ("금지" in exec_ or "하지 말" in exec_ or "묻지" in exec_), \
        "executive v2: 기술 세부 질문 금지 Negative Constraint 누락"
