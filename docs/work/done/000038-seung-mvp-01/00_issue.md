# feat: seung 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end

## 사용자 관점 목표
자소서 PDF를 업로드하면, 내 서류에서 나올 면접 예상 질문을 카테고리별로 받을 수 있다. (seung 서비스 독자 구현)

## 배경
엔진(`engine/`)은 공동 개발 완료 (`POST /api/resume/questions` 구현됨). `mirai_project_plan.md` 지침에 따라 서비스는 각자 독립적으로 개발한다. seung 멘티가 `services/seung/` 디렉토리에 자소서 → 질문 생성 MVP를 직접 설계·구현한다.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약, 에러 코드, 예외 계층
- `docs/specs/mvp/dev_spec.md` — MVP 기술 스택, API 명세 §5-1, 프론트엔드 §7

## 완료 기준
- [x] `services/seung/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [x] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [x] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [x] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [x] 에러 처리: 400/422/500 한국어 안내
- [x] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트)
- [x] `services/seung/.ai.md` 최신화 (구조·진행 상태 반영)
- [x] 불변식 준수: `services/seung/`에 `import anthropic` / `import fitz` 없음

## 구현 플랜
1. **테스트 환경 세팅** — Next.js 프로젝트 초기화, Vitest 설정, `.env.local` (`ENGINE_BASE_URL`)
2. **타입 정의** — `lib/types.ts` (엔진 응답 타입, 상태 타입)
3. **API 라우트 TDD** — `tests/api/` 먼저 작성 → `src/app/api/resume/questions/route.ts` 구현
4. **UI TDD** — 업로드·결과 컴포넌트 테스트 먼저 작성 → 구현
5. **통합 검증** — 엔진 로컬 실행 후 end-to-end 수동 테스트
6. **`.ai.md` 최신화**

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 구현 개요
`services/seung/`에 Next.js(App Router, TypeScript, Tailwind CSS v4) 기반 자소서 업로드 → 질문 생성 MVP를 end-to-end로 구현했다. 엔진(`POST /api/resume/questions`)을 HTTP로 호출하고 결과를 카테고리별로 표시한다.

### 변경 파일별 설명

**`src/lib/types.ts`**
공유 타입 정의. `Question`, `QuestionsResponse`, `UploadState`, 한국어 에러 메시지 상수(`ERROR_MESSAGES`) 포함. 서비스 전역에서 타입 일관성 유지.

**`src/app/api/resume/questions/route.ts`**
Next.js API 라우트. PDF FormData를 수신해 엔진으로 포워딩하고 응답을 그대로 반환. 파일 미첨부(400), fetch 실패(500) 처리 포함.

**`src/components/UploadForm.tsx`**
PDF 업로드 폼. `idle → uploading → processing → done/error` 5가지 상태를 시각적으로 표현. 스피너, 비활성화, 에러 인라인 표시.

**`src/components/QuestionList.tsx`**
질문 결과 화면. `groupByCategory()`로 카테고리별 그룹핑 후 섹션 렌더링. "다시 하기" 버튼으로 업로드 폼 복귀.

**`src/app/page.tsx`**
메인 페이지. 상태(`useState`)로 `UploadForm` ↔ `QuestionList` 전환 관리. 엔진 호출 및 에러 처리 통합.

**`tests/api/questions.test.ts`** (6개)
API 라우트 단위 테스트. 파일 없음/엔진 200·400·422·500/fetch 실패 케이스 검증.

**`tests/components/UploadForm.test.tsx`** (7개)
UploadForm 컴포넌트 테스트. 각 상태별 UI, 파일 선택, 제출, 에러 메시지 표시 검증.

**`tests/components/QuestionList.test.tsx`** (5개)
QuestionList 컴포넌트 테스트. 카테고리 그룹핑, 질문 렌더링, 다시 하기 버튼 검증.

**`tests/e2e/upload-flow.spec.ts`** (4개)
Playwright E2E 테스트. API 모킹으로 엔진 없이 실행 가능. 성공/422/500/다시하기 시나리오.

**`tests/e2e/real-flow.spec.ts`** (1개)
실제 엔진 연동 E2E 테스트. 엔진 서버 기동 상태에서 실제 PDF 업로드 → LLM 질문 생성 → 결과 표시까지 Playwright로 검증 및 영상 녹화.

**`playwright.config.ts`**
Playwright 설정. Chromium 단독, `video: 'on'`으로 항상 녹화, webServer로 dev 서버 자동 기동.

**`.gitignore`**
`/playwright/.cache/`, `/tests/e2e/fixtures/` 추가.

**`services/seung/.ai.md`**
전체 구조·진행 상태 최신화. E2E 테스트 추가 반영.

