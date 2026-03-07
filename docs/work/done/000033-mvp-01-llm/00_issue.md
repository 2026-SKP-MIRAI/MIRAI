# feat: MVP 01 구현 — 엔진 파서·LLM·API + lww 서비스 연동

## 사용자 관점 목표
자소서 PDF를 업로드하면, 내 서류에서 나올 면접 예상 질문을 카테고리별로 받을 수 있다.

## 배경
기획서, dev_spec(`docs/specs/mvp/dev_spec.md`), 테스트 fixtures(#28) 준비 완료. 이를 기반으로 엔진(FastAPI)과 lww 서비스(Next.js) MVP 01 end-to-end를 TDD로 구현한다.

## 완료 기준
- [x] 엔진: `POST /api/resume/questions` — PDF 수신 → 파싱 → Claude API → `{ questions, meta }` JSON 반환 (§5-1 형식)
- [x] 엔진: 파서 edge case 처리 (빈 PDF→422, 이미지 전용→422, 크기/페이지 초과→400, Claude 오류→500)
- [x] 엔진: pytest 단위·통합 테스트 포함 (파서·LLM 서비스·API 라우트)
- [x] lww: `POST /api/resume/questions` Next.js API 라우트 → 엔진 HTTP 호출 → 응답 전달
- [x] lww: 업로드 UI (PDF 선택, "질문 생성" 버튼, idle→uploading→processing→done/error 상태)
- [x] lww: 결과 UI (카테고리별 질문 리스트, "다시 하기" 버튼)
- [x] lww: 에러 상태 한국어 안내 (400/422/500)

## 구현 플랜
1. **엔진 파서 TDD** — `engine/app/parsers/` pytest 먼저 작성 → PyMuPDF로 PDF → 텍스트 추출, edge case 예외 처리
2. **엔진 LLM 서비스 TDD** — `engine/app/services/` pytest 먼저 → anthropic SDK로 질문 생성, 프롬프트 `engine/app/prompts/`에 분리
3. **엔진 API 라우트 완성** — `POST /api/resume/questions`, `schemas.py` Pydantic 모델, 전역 exception handler
4. **lww API 라우트** — Next.js `POST /api/resume/questions` → 엔진 HTTP 호출 (ENGINE_BASE_URL, 타임아웃 30초)
5. **lww 업로드 UI** — PDF 선택·드롭, "질문 생성" 버튼, 로딩 스피너/메시지
6. **lww 결과 UI** — 카테고리별 질문 카드, "다시 하기" 버튼

## 개발 체크리스트
- [x] 테스트 코드 포함 (pytest 34개 + vitest 14개 + e2e 2개 = 50개)
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음 (LLM은 engine/app/services에서만, lww는 엔진 HTTP 호출만)

---

## 작업 내역

### 엔진 (FastAPI)

**`engine/pyproject.toml`** — 프로젝트 설정 신규 작성. FastAPI, PyMuPDF, openai(OpenRouter용) 의존성 포함. pytest 설정 포함.

**`engine/app/parsers/`** — PDF 파싱 레이어 구현.
- `pdf_parser.py`: PyMuPDF로 텍스트 추출. 빈 PDF→EmptyPDFError, 이미지 전용→ImageOnlyPDFError, 손상→ParseError, 크기/페이지 초과→FileSizeError/PageLimitError.
- `exceptions.py`: ParseError 계층(EmptyPDFError, ImageOnlyPDFError, FileSizeError, PageLimitError) + LLMError 독립 정의.

**`engine/app/services/`** — LLM 서비스 레이어 구현.
- `llm_service.py`: OpenRouter API(google/gemini-2.5-flash)를 OpenAI SDK로 호출. 프롬프트는 `prompts/question_generation_v1.md` 분리.
- `output_parser.py`: LLM JSON 응답 파싱 + 검증. markdown 코드 블록(` ```json ``` `) 자동 제거 처리 추가 (Gemini 모델 응답 형식 대응).

**`engine/app/routers/resume.py`** — `POST /api/resume/questions` 엔드포인트. Content-Length 선제 검증(메모리 DoS 방지), MIME 타입 위장 방지 포함.

**`engine/app/main.py`** — FastAPI 앱 진입점. ParseError→400/422, LLMError→500 전역 exception handler.

**`engine/tests/`** — pytest 34개 전부 통과.
- `unit/parsers/`: PDF 파서 10개 (edge case + 경계값)
- `unit/services/`: output_parser 11개 + llm_service 5개
- `integration/`: API 라우트 통합 8개

### lww 서비스 (Next.js)

**`services/lww/src/app/api/resume/questions/route.ts`** — Next.js API 라우트. 엔진 HTTP 호출(타임아웃 30초), 에러 패스스루.

**`services/lww/src/components/UploadForm.tsx`** — PDF 업로드 상태머신 (idle→ready→uploading→done/error). "질문 생성" 버튼, 에러 시 재시도.

**`services/lww/src/components/QuestionList.tsx`** — 카테고리별 질문 그룹핑 렌더링, "다시 하기" 버튼.

**`services/lww/src/lib/error-messages.ts`** — 엔진 에러 상세 → 한국어 메시지 변환. imageOnlyPdf 오분류 버그 수정 포함.

**`services/lww/tests/`** — vitest 14개 + Playwright e2e 2개(mock) + Playwright e2e 1개(실제 LLM 연동) 전부 통과.

### 버그 수정 (배포 검증 중 발견)

- **모델명 오류**: `google/gemini-flash-1.5` → `google/gemini-2.5-flash` (OpenRouter 실제 모델 ID로 수정)
- **LLM 응답 파싱 오류**: Gemini가 JSON을 markdown 코드 블록으로 감싸 반환 → `_strip_markdown_code_block()` 추가로 해결
- **엔진 미기동**: 워크트리 생성 시 `.env` 미복사 → 메인 레포에서 복사 후 기동

### 기타

- `.gitignore`: `.next/`, `*.egg-info/`, `test-results/`, `next-env.d.ts` 추가 (빌드 아티팩트 제외)
- `.env.example`: Anthropic → OpenRouter API 키로 업데이트
- `scripts/check_invariants.py`: 경로 `engine/services` → `engine/app/services` 수정

