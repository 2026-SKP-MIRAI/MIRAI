import json
from app.parsers.exceptions import LLMError
from app.schemas import QuestionItem

def _strip_markdown_code_block(raw: str) -> str:
    stripped = raw.strip()
    if stripped.startswith("```"):
        stripped = stripped[stripped.index("\n") + 1:]
    if stripped.endswith("```"):
        stripped = stripped[: stripped.rfind("```")]
    return stripped.strip()


def parse_llm_response(raw: str) -> list[QuestionItem]:
    try:
        data = json.loads(_strip_markdown_code_block(raw))
    except json.JSONDecodeError as e:
        raise LLMError(f"LLM 응답이 유효한 JSON이 아닙니다: {e}") from e

    if not isinstance(data, list):
        raise LLMError("LLM 응답 루트가 리스트가 아닙니다")

    if len(data) == 0:
        raise LLMError("질문 생성 결과가 없습니다")

    items = []
    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise LLMError(f"항목 {i}가 객체가 아닙니다")
        if "category" not in item:
            raise LLMError(f"항목 {i}에 category 키가 없습니다")
        if "question" not in item:
            raise LLMError(f"항목 {i}에 question 키가 없습니다")
        if not item["question"]:
            raise LLMError(f"항목 {i}의 question이 빈 문자열입니다")

        try:
            q = QuestionItem(category=item["category"], question=item["question"])
        except Exception as e:
            raise LLMError(f"항목 {i} 검증 실패 (category가 허용된 값이 아님): {e}") from e

        items.append(q)

    if len(items) < 8:
        raise LLMError(f"질문이 8개 미만입니다: {len(items)}개")

    return items
