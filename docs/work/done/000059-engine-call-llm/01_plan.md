# [#59] fix: engine call_llm max_tokens 1024 → 2048 상향 — 구현 계획

> 작성: 2026-03-12

---

## 완료 기준

- [x] `call_llm`의 `max_tokens` 값이 2048로 변경됨
- [x] 면접 진행 시 JSON 응답이 잘리지 않음 (로컬 테스트 확인)

---

## 구현 계획

### 원인 분석

`engine/app/services/llm_client.py`의 `call_llm` 함수에서 `max_tokens=1024`가 기본값으로 설정되어 있었음.
면접 응답 JSON은 질문·추론·답변 구조를 포함해 1024 토큰을 초과하는 경우가 발생, 응답이 중간에 잘려 파싱 실패로 이어짐.

### 변경 범위

| 파일 | 변경 내용 |
|------|-----------|
| `engine/app/services/llm_client.py:24` | `max_tokens` 기본값 `1024` → `2048` |
| `engine/app/services/.ai.md:32` | 인터페이스 문서 주석 동기화 |

### 설계 결정

- `call_llm`은 모든 서비스(interview, report 등)의 단일 LLM 진입점이므로 여기서 기본값을 올리면 전체에 적용됨
- 개별 호출에서 더 높은 값이 필요하면 `max_tokens` 인자로 재지정 가능 (기존 인터페이스 유지)
