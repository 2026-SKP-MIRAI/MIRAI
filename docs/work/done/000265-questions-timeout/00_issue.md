# Issue #265 — questions/route.ts & llm_service.py 타임아웃 증가

## 개요
질문 생성 API의 타임아웃이 너무 짧아 LLM 응답 대기 중 타임아웃 오류가 발생하는 문제를 수정한다.

## 변경 내용
- `services/siw/src/app/api/resume/questions/route.ts`: `maxDuration` 35→60, `AbortSignal.timeout` 30000→55000
- `engine/app/services/llm_service.py`: `timeout_seconds` 30.0→50.0
