# chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services)

## 목적
MVP 기능 01 (PDF 자소서 → 맞춤 질문 생성) TDD 구현 전, 엔진과 서비스 양쪽에 필요한 테스트 데이터(fixtures)를 미리 준비한다.

## 배경
`engine/tests/fixtures/`와 `services/*/tests/fixtures/`가 현재 비어 있어, Red 단계 테스트 작성 시 필요한 샘플 PDF·예상 출력 JSON·mock 응답이 없는 상태다. MVP 스펙(`docs/specs/mvp/dev_spec.md` §5-1, §6)에 정의된 API 응답 형식 기준으로 준비한다.

## 완료 기준
- [ ] `engine/tests/fixtures/sample_resume.pdf` — 실제 자소서 형식 샘플 PDF (텍스트 기반)
- [ ] `engine/tests/fixtures/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [ ] `engine/tests/fixtures/mock_llm_response.json` — Claude mock 응답 (카테고리 4개, 8~20개 질문, §5-1 형식)
- [ ] `engine/tests/fixtures/empty.pdf` — edge case: 빈 PDF
- [ ] `engine/tests/fixtures/image_only.pdf` — edge case: 텍스트 없는 이미지 PDF
- [ ] `services/*/tests/fixtures/mock_engine_response.json` — 엔진 full 응답 mock `{ questions, meta }` (API 라우트 단위테스트용)
- [ ] `services/*/tests/fixtures/error_responses.json` — 400/500 에러 mock (한국어 메시지 포함)
- [ ] 각 fixtures 디렉토리 `.ai.md` 최신화

## 구현 플랜
1. `sample_resume.pdf` 생성 — reportlab 또는 Python으로 실제 자소서 형식 텍스트 포함
2. `expected_parsed.json` 작성 — 위 PDF 파싱 예상 결과
3. `mock_llm_response.json` 작성 — 직무 역량·경험의 구체성·성과 근거·기술 역량 카테고리별 2~5개
4. edge case 파일 생성 (empty.pdf, image_only.pdf)
5. 서비스 4개 fixtures 디렉토리에 mock_engine_response.json, error_responses.json 작성
6. fixtures 디렉토리 .ai.md 최신화

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역
