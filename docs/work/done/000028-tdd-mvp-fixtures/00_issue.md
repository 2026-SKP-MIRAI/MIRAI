# chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services)

## 목적
MVP 기능 01 (PDF 자소서 → 맞춤 질문 생성) TDD 구현 전, 엔진과 서비스 양쪽에 필요한 테스트 데이터(fixtures)를 미리 준비한다.

## 배경
`engine/tests/fixtures/`와 `services/*/tests/fixtures/`가 현재 비어 있어, Red 단계 테스트 작성 시 필요한 샘플 PDF·예상 출력 JSON·mock 응답이 없는 상태다. MVP 스펙(`docs/specs/mvp/dev_spec.md` §5-1, §6)에 정의된 API 응답 형식 기준으로 준비한다.

## 완료 기준
- [x] `engine/tests/fixtures/input/sample_resume.pdf` — 실제 자소서 형식 샘플 PDF (텍스트 기반)
- [x] `engine/tests/fixtures/input/empty.pdf` — edge case: 빈 PDF
- [x] `engine/tests/fixtures/input/image_only.pdf` — edge case: 텍스트 없는 이미지 PDF
- [x] `engine/tests/fixtures/input/corrupted.pdf` — edge case: 손상·암호화 PDF (ParseError → 400)
- [x] `engine/tests/fixtures/input/many_pages.pdf` — edge case: 10페이지 초과 PDF (PageLimitError → 400)
- [x] `engine/tests/fixtures/input/large_file.pdf` — edge case: 5MB 초과 파일 (FileSizeError → 400)
- [x] `engine/tests/fixtures/output/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [x] `engine/tests/fixtures/output/mock_llm_response.json` — Claude mock 응답 ([{category, question}] 배열, 카테고리 4개, 8~20개 질문)
- [x] `services/*/tests/fixtures/input/mock_engine_response.json` — 엔진 full 응답 mock `{ questions, meta }` (API 라우트 단위테스트용)
- [x] `services/*/tests/fixtures/input/error_responses.json` — 400/422/500 에러 mock (한국어 메시지 포함)
- [x] 각 fixtures 디렉토리 `.ai.md` 최신화

## 구현 플랜
1. ✅ `sample_resume.pdf` 복사 — 실제 개발자 자소서 PDF (`자소서_004_개발자.pdf`)
2. ✅ edge case 파일 준비 — `empty.pdf`, `image_only.pdf` 복사 / `corrupted.pdf`, `many_pages.pdf` Python 생성 / `large_file.pdf` 포트폴리오 파일 복사
3. ✅ `expected_parsed.json` 작성 — extractedLength 실측 후 기입 (3538자)
4. ✅ `mock_llm_response.json` 작성 — 카테고리별 2~5개, 총 12개 질문
5. ✅ 서비스 4개 fixtures 디렉토리에 `mock_engine_response.json`, `error_responses.json` 작성
6. ✅ fixtures 디렉토리 `.ai.md` 최신화

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-07

**engine/.ai.md 업데이트**
- 파서 edge case 동작 계약 테이블 추가 (EmptyPDFError→422, ImageOnlyPDFError→422, ParseError→400, FileSizeError→400, PageLimitError→400, LLMError→500)
- 예외 계층 구조 명시 (ParseError base → EmptyPDFError, ImageOnlyPDFError, FileSizeError, PageLimitError / LLMError 독립)
- TODO: Beta 진입 시 ValidationError 분리 검토 추가

**docs/specs 업데이트**
- `docs/specs/mvp/dev_spec.md` §5-1 에러 응답에 422 추가 (빈 PDF, 이미지 전용 PDF)
- `docs/specs/mirai/dev_spec.md` HTTP 상태 코드 일치 (3문서 충돌 해소)

**engine/tests/fixtures/input/ 파일 준비 완료**
- `sample_resume.pdf` (68K) — `자소서_004_개발자.pdf` 복사
- `empty.pdf` (5.7K), `image_only.pdf` (24K) — 공유폴더에서 복사
- `corrupted.pdf` (43B) — 손상 바이트 시퀀스로 생성
- `many_pages.pdf` (2.1K) — PyMuPDF로 11페이지 생성
- `large_file.pdf` (6.1M) — `포트폴리오_006_5MB넘는파일.pdf` 복사

**01_plan.md 업데이트**
- 디렉토리 구조에 3개 edge case 파일 추가
- 완료 기준 업데이트
- Step 4b large_file.pdf 생성 방식 수정 (포트폴리오 파일 복사로)
- 실행 순서 1~4 완료 표시

**engine/tests/fixtures/output/ 파일 생성**
- `expected_parsed.json` — extractedLength 실측(3538자), 텍스트 앞부분 발췌
- `mock_llm_response.json` — 카테고리 4개 × 3개, 총 12개 질문 (자소서 내용 기반)

**services/{kwan,lww,seung,siw}/tests/fixtures/input/ 파일 생성**
- `mock_engine_response.json` — 엔진 HTTP 응답 mock (`{ questions: 8개, meta }`)
- `error_responses.json` — camelCase 키, 400×4 / 422×2 / 500×1 케이스

**fixtures 디렉토리 .ai.md 최신화**
- `engine/tests/fixtures/.ai.md` — input/output 구조, 소스 파일 경로, 예외 계층
- `services/*/tests/fixtures/.ai.md` — 4개 서비스 각각 작성

**모든 AC 완료**

