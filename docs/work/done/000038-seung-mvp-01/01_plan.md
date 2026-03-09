# [#38] feat: seung 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end — 구현 계획

> 작성: 2026-03-09

---

## 완료 기준

- [x] `services/seung/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [x] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [x] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [x] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [x] 에러 처리: 400/422/500 한국어 안내
- [x] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트)
- [x] `services/seung/.ai.md` 최신화 (구조·진행 상태 반영)
- [x] 불변식 준수: `services/seung/`에 `import anthropic` / `import fitz` 없음

---

## 구현 계획

### 기술 스택
- **프레임워크**: Next.js 16 (App Router, TypeScript)
- **스타일**: Tailwind CSS v4
- **단위 테스트**: Vitest + @testing-library/react
- **E2E 테스트**: Playwright (API 모킹 + 실제 엔진 연동)

### 구현 순서 (TDD — Red → Green → Refactor)

#### 1단계: 프로젝트 초기화 및 테스트 환경 세팅
- Next.js 프로젝트 초기화 (App Router, TypeScript, Tailwind CSS v4)
- Vitest + @testing-library/react 설정
- `.env.local` 생성 (`ENGINE_BASE_URL=http://localhost:8000`)

#### 2단계: 타입 정의
- `src/lib/types.ts` 작성
  - `Question`, `QuestionsResponse` — 엔진 응답 타입
  - `UploadState` — `idle | uploading | processing | done | error`
  - `ERROR_MESSAGES` — HTTP 상태 코드별 한국어 메시지 상수

#### 3단계: API 라우트 TDD
- `tests/api/questions.test.ts` 먼저 작성 (6개 케이스)
  - 파일 없음 → 400
  - 엔진 200/400/422/500 응답 그대로 전달
  - fetch 네트워크 실패 → 500
- `src/app/api/resume/questions/route.ts` 구현
  - PDF FormData 수신 → 엔진 HTTP 포워딩 → 응답 반환

#### 4단계: UI 컴포넌트 TDD

**UploadForm** (`tests/components/UploadForm.test.tsx` 7개)
- idle 상태: 파일 선택 input, 질문 생성 버튼 렌더링
- 파일 미선택 시 버튼 비활성화
- uploading/processing 상태: 스피너, 버튼 비활성화
- error 상태: 에러 메시지 `role="alert"` 표시
- 파일 선택 후 submit → onSubmit 콜백 호출

**QuestionList** (`tests/components/QuestionList.test.tsx` 5개)
- 카테고리별 그룹핑 후 섹션 렌더링
- 질문 개수 표시
- 다시 하기 버튼 클릭 → onReset 콜백 호출

#### 5단계: 메인 페이지 통합
- `src/app/page.tsx` — 상태 관리 + UploadForm ↔ QuestionList 전환
- 엔진 호출, 에러 처리 통합

#### 6단계: Playwright E2E 테스트 추가
- `tests/e2e/upload-flow.spec.ts` (4개 — API 모킹, 엔진 불필요)
  - 성공: PDF 업로드 → 카테고리별 질문 표시
  - 422: 한국어 에러 메시지 표시
  - 500: 서버 오류 메시지 표시
  - 다시 하기: 결과 → 업로드 폼 복귀
- `tests/e2e/real-flow.spec.ts` (1개 — 실제 엔진 연동 + 영상 녹화)
  - 실제 자소서 PDF 업로드 → LLM 질문 생성 → 결과 화면 검증
  - `video: 'on'` 으로 영상 녹화

#### 7단계: `.ai.md` 최신화
- 구조 트리, 진행 상태, E2E 테스트 항목 반영

### 최종 테스트 결과
- Vitest 단위 테스트: **18개 통과**
- Playwright E2E (모킹): **4개 통과**
- Playwright E2E (실제 엔진): **1개 통과 (11.7s)**
