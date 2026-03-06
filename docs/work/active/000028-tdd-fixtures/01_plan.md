# [#28] chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services) — 구현 계획

> 작성: 2026-03-06

---

## 완료 기준

- [ ] `engine/tests/fixtures/sample_resume.pdf` — 실제 자소서 형식 샘플 PDF (텍스트 기반)
- [ ] `engine/tests/fixtures/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [ ] `engine/tests/fixtures/mock_llm_response.json` — Claude mock 응답 (카테고리 4개, 8~20개 질문, §5-1 형식)
- [ ] `engine/tests/fixtures/empty.pdf` — edge case: 빈 PDF
- [ ] `engine/tests/fixtures/image_only.pdf` — edge case: 텍스트 없는 이미지 PDF
- [ ] `services/*/tests/fixtures/mock_engine_response.json` — 엔진 full 응답 mock `{ questions, meta }` (API 라우트 단위테스트용)
- [ ] `services/*/tests/fixtures/error_responses.json` — 400/500 에러 mock (한국어 메시지 포함)
- [ ] 각 fixtures 디렉토리 `.ai.md` 최신화

---

## 구현 계획

(작성 예정)
