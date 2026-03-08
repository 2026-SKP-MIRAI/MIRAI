# feat: siw 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end

## 사용자 관점 목표
자소서 PDF를 업로드하면, 내 서류에서 나올 면접 예상 질문을 카테고리별로 받을 수 있다. (siw 서비스 독자 구현)

## 배경
엔진(`engine/`)은 공동 개발 완료 (`POST /api/resume/questions` 구현됨). `mirai_project_plan.md` 지침에 따라 서비스는 각자 독립적으로 개발한다. siw 멘티가 `services/siw/` 디렉토리에 자소서 → 질문 생성 MVP를 직접 설계·구현한다.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약, 에러 코드, 예외 계층
- `docs/specs/mvp/dev_spec.md` — MVP 기술 스택, API 명세 §5-1, 프론트엔드 §7

## 완료 기준
- [x] `services/siw/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [x] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [x] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [x] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [x] 에러 처리: 400/422/500 한국어 안내
- [x] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트)
- [x] `services/siw/.ai.md` 최신화 (구조·진행 상태 반영)
- [x] 불변식 준수: `services/siw/`에 `import anthropic` / `import fitz` 없음

## 구현 플랜
1. **테스트 환경 세팅** — Next.js 프로젝트 초기화, Vitest 설정, `.env.local` (`ENGINE_BASE_URL`)
2. **타입 정의** — `lib/types.ts` (엔진 응답 타입, 상태 타입)
3. **API 라우트 TDD** — `tests/api/` 먼저 작성 → `src/app/api/resume/questions/route.ts` 구현
4. **UI TDD** — 업로드·결과 컴포넌트 테스트 먼저 작성 → 구현
5. **통합 검증** — 엔진 로컬 실행 후 end-to-end 수동 테스트
6. **`.ai.md` 최신화**

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 프로젝트 초기화
`services/siw/`를 Next.js 15 + React 19 + TypeScript strict 기반으로 신규 생성. `vitest.config.ts`에 `environmentMatchGlobs`를 설정해 API 테스트(`tests/api/**`)는 node 환경, UI 테스트(`tests/ui/**`)는 jsdom 환경에서 각각 실행되도록 구성.

### 타입 계약 (`src/lib/types.ts`)
엔진 Pydantic 스키마(`engine/app/schemas.py`)와 동기화된 TypeScript 타입 정의: `Category`, `QuestionItem`, `QuestionsResponse`, `UploadState`. Python camelCase 필드(`extractedLength`)를 그대로 매핑.

### API 라우트 (`src/app/api/resume/questions/route.ts`)
`runtime = "nodejs"` 설정(Edge Runtime은 `AbortSignal.timeout()` 미지원). `ENGINE_BASE_URL` 환경변수로 엔진 접근. `FormData`를 그대로 전달해 `Content-Type: multipart/form-data; boundary=...`를 자동 설정(수동 설정 시 boundary 누락 → FastAPI 422). 엔진 에러 응답의 `detail` 텍스트를 `mapDetailToKey`로 파싱해 한국어 메시지로 변환.

### 에러 처리 (`src/lib/error-messages.ts`)
엔진 실제 detail 텍스트 기반으로 `mapDetailToKey` 구현. `imageOnlyPdf`를 `emptyPdf`보다 먼저 검사(이미지 전용 메시지에 "텍스트" 키워드 포함되어 순서 중요). `noFile` 조건은 `"파일"+"필요"` 조합 사용(엔진 실제 메시지 기반).

### UI 컴포넌트
- `UploadForm.tsx`: `useState<UploadState>` 상태머신(idle→ready→uploading→done/error). 업로드 중 버튼 비활성화.
- `QuestionList.tsx`: CATEGORIES 배열로 그룹핑, `data-testid="question-item"`, "다시 하기" 버튼.
- `src/app/resume/page.tsx`: 클라이언트 컴포넌트, 상태에 따라 UploadForm ↔ QuestionList 전환.

### Vitest 테스트 (20개 전체 통과)
| 파일 | 수 | 환경 |
|------|---|------|
| `tests/api/error-messages.test.ts` | 7 | node |
| `tests/api/resume-questions-route.test.ts` | 6 | node |
| `tests/ui/upload-form.test.tsx` | 5 | jsdom |
| `tests/ui/question-results.test.tsx` | 2 | jsdom |

API 테스트는 `vi.stubGlobal("fetch", mockFetch)`로 엔진 없이 독립 실행. UI 테스트 5개는 상태 전이를 독립 케이스로 분리(mega-test 금지 원칙 준수).

### 기술적 결정사항
- 엔진 코드 수정 없이 `OPENROUTER_API_KEY`를 주입하려면 uvicorn 실행 시 `python -m dotenv run -- python -m uvicorn app.main:app --reload --port 8000` 사용 (pydantic-settings는 `.env`를 Settings 필드만 채우고 `os.environ`에 export하지 않으므로).

