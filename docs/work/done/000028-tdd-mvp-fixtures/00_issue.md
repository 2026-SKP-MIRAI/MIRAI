# chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services)

## 목적
MVP 기능 01 (PDF 자소서 → 맞춤 질문 생성) TDD 구현 전, 엔진과 서비스 양쪽에 필요한 테스트 데이터(fixtures)를 미리 준비한다.

## 배경
`engine/tests/fixtures/`와 `services/*/tests/fixtures/`가 현재 비어 있어, Red 단계 테스트 작성 시 필요한 샘플 PDF·예상 출력 JSON·mock 응답이 없는 상태다. MVP 스펙(`docs/specs/mvp/dev_spec.md` §5-1, §6)에 정의된 API 응답 형식 기준으로 준비한다.

## 완료 기준
- [x] `engine/tests/fixtures/sample_resume.pdf` — 실제 자소서 형식 샘플 PDF (텍스트 기반)
- [x] `engine/tests/fixtures/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [x] `engine/tests/fixtures/mock_llm_response.json` — Claude mock 응답 (카테고리 4개, 8~20개 질문, §5-1 형식)
- [x] `engine/tests/fixtures/empty.pdf` — edge case: 빈 PDF
- [x] `engine/tests/fixtures/image_only.pdf` — edge case: 텍스트 없는 이미지 PDF
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
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 구현 내용

**PDF fixtures (로컬 전용, gitignore)**
- `sample_resume.pdf`: 실제 자소서 `자소서_004_개발자.pdf` (건국대 수학과 백엔드 개발자) 복사
- `empty.pdf`: Python으로 텍스트 레이어 없는 최소 유효 PDF 생성 (321B)
- `image_only.pdf`: zlib 압축 이미지 XObject만 포함한 PDF 생성 (667B)

**engine/tests/fixtures/ (커밋)**
- `expected_parsed.json`: 실제 PDF에서 추출한 텍스트(3,314자), pageCount=2, extractedLength=3314
- `mock_llm_response.json`: 실제 자소서 내용 기반 질문 12개 (카테고리 4개 × 3개). A/B 테스트, 쿼리 최적화, 협업 등 실제 경험에서 도출
- `.ai.md`: PDF 로컬 전용 정책, JSON 형식 문서화

**services/{siw,kwan,lww,seung}/tests/fixtures/ (커밋, 4개 서비스 동일)**
- `mock_engine_response.json`: engine mock_llm_response.json과 동일 구조·내용 (서비스 레이어 테스트에서 엔진 의존성 제거용)
- `error_responses.json`: INVALID_FILE(400), FILE_TOO_LARGE(413), SERVER_ERROR(500) 한국어 메시지
- `.ai.md`: 각 서비스 fixtures 목적·형식 문서화

### 기술적 결정
- PDF는 멘토 지침(외부 스토리지 정책)에 따라 gitignore 유지, 커밋 제외
- `expected_parsed.json` 필드명을 이슈 AC 기준 `extractedLength`로 확정 (초기 `characterCount`에서 수정)
- 임의 데이터 대신 실제 자소서 PDF를 사용해 fixture 현실성 확보

