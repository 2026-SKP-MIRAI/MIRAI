"""페르소나별 답변 신호 포맷팅 모듈. LLM 미사용, 결정론적."""
from app.analyzers.text_analyzer import TextSignals

TEAMWORK_KEYWORDS = ["협업", "팀", "소통", "배려", "조율", "합의", "갈등", "리더"]
TECHNICAL_KEYWORDS = ["설계", "아키텍처", "알고리즘", "최적화", "리팩토링", "디버깅", "배포", "CI/CD"]
BUSINESS_KEYWORDS = ["매출", "성과", "ROI", "임팩트", "전략", "비용", "효율", "KPI"]


def _keyword_score(text: str, keywords: list[str]) -> float:
    count = sum(1 for kw in keywords if kw in text)
    return min(count / 3.0, 1.0)


def format_persona_signals(answer: str, signals: TextSignals, persona: str) -> str:
    if persona == "hr":
        return (
            f"[HR 관심 신호]\n"
            f"- STAR 구조 완성도: {signals.star_score:.2f}/1.0\n"
            f"- 협업/소통 키워드 밀도: {_keyword_score(answer, TEAMWORK_KEYWORDS):.2f}/1.0\n"
            f"- 주도성 동사 수: {signals.agency_verb_count}개\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0"
        )
    elif persona == "tech_lead":
        return (
            f"[기술팀장 관심 신호]\n"
            f"- 기술 깊이 키워드 밀도: {_keyword_score(answer, TECHNICAL_KEYWORDS):.2f}/1.0\n"
            f"- 인과 분석 표현 수: {signals.cause_analysis_count}개\n"
            f"- 대안 언급 수: {signals.alternative_count}개\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0"
        )
    elif persona == "executive":
        return (
            f"[경영진 관심 신호]\n"
            f"- 비즈니스 임팩트 키워드 밀도: {_keyword_score(answer, BUSINESS_KEYWORDS):.2f}/1.0\n"
            f"- 성과 점수: {signals.achievement_score:.2f}/1.0\n"
            f"- 구체성 점수: {signals.specificity_score:.2f}/1.0\n"
            f"- 주도성 동사 수: {signals.agency_verb_count}개"
        )
    else:
        return format_persona_signals(answer, signals, "hr")
