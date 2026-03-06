# chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services)

## 목적
MVP 기능 01 (PDF 자소서 → 맞춤 질문 생성) TDD 구현 전, 엔진과 서비스 양쪽에 필요한 테스트 데이터(fixtures)를 미리 준비한다.

## 배경
`engine/tests/fixtures/`와 `services/*/tests/fixtures/`가 현재 비어 있어, Red 단계 테스트 작성 시 필요한 샘플 PDF·예상 출력 JSON·mock 응답이 없는 상태다. MVP 스펙(`docs/specs/mvp/dev_spec.md` §5-1, §6)에 정의된 API 응답 형식 기준으로 준비한다.

## 완료 기준
- [ ] `engine/tests/fixtures/sample_resume.pdf` — ⚠️ git 제외 (*.pdf 커밋 금지 규칙), 팀 공유로 별도 배포
- [x] `engine/tests/fixtures/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [x] `engine/tests/fixtures/mock_llm_response.json` — Claude mock 응답 (카테고리 4개, 8~20개 질문, §5-1 형식)
- [ ] `engine/tests/fixtures/empty.pdf` — ⚠️ git 제외 (*.pdf 커밋 금지 규칙), 팀 공유로 별도 배포
- [ ] `engine/tests/fixtures/image_only.pdf` — ⚠️ git 제외 (*.pdf 커밋 금지 규칙), 팀 공유로 별도 배포
- [x] `services/*/tests/fixtures/mock_engine_response.json` — 엔진 full 응답 mock `{ questions, meta }` (API 라우트 단위테스트용)
- [x] `services/*/tests/fixtures/error_responses.json` — 400/500 에러 mock (한국어 메시지 포함)
- [x] 각 fixtures 디렉토리 `.ai.md` 최신화

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

### 추가된 파일

**engine/tests/fixtures/**
- `expected_parsed.json` — PyMuPDF가 `sample_resume.pdf`에서 추출하는 텍스트(781자)·`extractedLength`·`pageCount`를 기록. 파서 단위 테스트의 기대값으로 사용.
- `mock_llm_response.json` — Claude API 응답 mock. 직무 역량·경험의 구체성·성과 근거·기술 역량 카테고리별 2개씩 총 8개 질문, `meta.extractedLength=781`. dev_spec.md §5-1 형식 준수.
- `pdf_input_cases.json` — PDF 입력 케이스 명세 13종. 정상(한국어/영어/혼용)·텍스트 없음(빈 PDF/이미지only/극소량)·분량 초과·파일 오류 케이스 및 각 케이스의 `expected_behavior`·`expected_error` 정의. 실제 PDF 없이 테스트 케이스 기준 확인 가능.
- `.ai.md` — 디렉토리 목적·파일 목록·PDF 취득 방법(팀 공유) 안내.

**services/{siw,kwan,lww,seung}/tests/fixtures/** (4개 서비스 동일)
- `mock_engine_response.json` — 엔진 HTTP 성공 응답 mock (`questions` 8개, `meta`). Next.js API 라우트 단위 테스트에서 `fetch` mock으로 사용.
- `error_responses.json` — 400(파일 없음/PDF 아님/크기 초과/페이지 초과)·413·500(파싱 실패/LLM 오류) 에러 응답 mock. 한국어 메시지 포함.
- `.ai.md` — 디렉토리 목적·파일 목록·스펙 참조 기술.

### 기술적 결정 사항
- **PDF git 제외**: `*.pdf 커밋 금지` 규칙(CLAUDE.md)에 따라 PDF 3개는 git에 포함하지 않음. 대신 `pdf_input_cases.json`으로 입력 케이스 명세를 문서화하고, 팀 공유 채널로 실제 파일 배포.
- **pdf_input_cases.json 추가**: 이슈 원래 요구사항에 없던 파일이나, PDF 없이도 어떤 케이스를 테스트해야 하는지 git에서 확인할 수 있도록 추가.
