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


def test_v3_tech_lead_prompt_placeholders():
    """interview_tech_lead_v3.md: 필수 플레이스홀더 존재 확인"""
    content = read_prompt("interview_tech_lead_v3.md")
    assert "{resume_text}" in content, "tech_lead v3: {resume_text} 누락"
    assert "{personas_context}" in content, "tech_lead v3: {personas_context} 누락"


def test_v3_tech_lead_prompt_output_format_contract():
    """interview_tech_lead_v3.md: 출력 포맷 계약 확인"""
    content = read_prompt("interview_tech_lead_v3.md")
    assert '"question"' in content, "tech_lead v3: 출력 포맷에 \"question\" 키 누락"
    assert '"personaLabel"' in content, "tech_lead v3: 출력 포맷에 \"personaLabel\" 키 누락"
    assert '"기술팀장"' in content, "tech_lead v3: personaLabel 값 \"기술팀장\" 누락"


def test_v3_tech_lead_prompt_no_sw_fixed_keywords():
    """interview_tech_lead_v3.md: SW 고정 키워드 미포함 확인"""
    content = read_prompt("interview_tech_lead_v3.md")
    assert "Docker" not in content, "tech_lead v3: SW 고정 키워드 'Docker' 포함됨"
    assert "GraphQL" not in content, "tech_lead v3: SW 고정 키워드 'GraphQL' 포함됨"
    assert "gRPC" not in content, "tech_lead v3: SW 고정 키워드 'gRPC' 포함됨"
    assert "시니어 엔지니어" not in content, "tech_lead v3: SW 고정 표현 '시니어 엔지니어' 포함됨"
    assert "프로덕션에서 발생한" not in content, "tech_lead v3: SW 고정 표현 '프로덕션에서 발생한' 포함됨"
    assert "응답 지연이 갑자기" not in content, "tech_lead v3: SW 고정 표현 '응답 지연이 갑자기' 포함됨"


def test_v3_tech_lead_prompt_domain_adaptive_keywords():
    """interview_tech_lead_v3.md: 도메인 적응 키워드 존재 확인"""
    content = read_prompt("interview_tech_lead_v3.md")
    assert "직무 도메인" in content, "tech_lead v3: '직무 도메인' 키워드 누락"
    assert "도구" in content, "tech_lead v3: '도구' 키워드 누락"
    assert "방법론" in content, "tech_lead v3: '방법론' 키워드 누락"


def test_v3_followup_tech_lead_no_sw_fixed_keywords():
    """interview_followup_tech_lead_v3.md: SW 고정 키워드 미포함 확인"""
    content = read_prompt("interview_followup_tech_lead_v3.md")
    assert "NoSQL" not in content, "followup tech_lead v3: SW 고정 키워드 'NoSQL' 포함됨"
    assert "RDB" not in content, "followup tech_lead v3: SW 고정 키워드 'RDB' 포함됨"
    assert "마이크로서비스" not in content, "followup tech_lead v3: SW 고정 키워드 '마이크로서비스' 포함됨"
    assert "캐싱" not in content, "followup tech_lead v3: SW 고정 키워드 '캐싱' 포함됨"
    assert "시니어 엔지니어" not in content, "followup tech_lead v3: SW 고정 표현 '시니어 엔지니어' 포함됨"
    assert "코드를 보면" not in content, "followup tech_lead v3: SW 고정 표현 '코드를 보면' 포함됨"


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
