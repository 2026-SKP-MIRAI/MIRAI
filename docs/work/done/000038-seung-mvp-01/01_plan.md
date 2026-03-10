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

### 사용자 경험 설계 의도

MVP의 핵심 가치는 "자소서를 올리면, 내 서류에서 나올 질문을 미리 알 수 있다"는 것 하나다. 이 흐름을 최대한 단순하게 만들기 위해 아래와 같이 설계했다.

- **단일 페이지**: 자소서 업로드 → 질문 확인 → (선택) 다시 하기라는 선형 흐름이 전부다. 페이지를 이동할 이유가 없으므로, 라우팅 없이 상태(`state`) 하나로 화면을 전환했다. 사용자 입장에서는 "화면이 바뀐다"는 느낌보다 "한 화면에서 단계가 진행된다"는 느낌을 준다.

- **로딩 상태 분리 (`uploading` / `processing`)**: LLM 질문 생성은 수 초 이상 걸릴 수 있다. "진행 중"임을 명확히 알리지 않으면 사용자가 버튼을 다시 누르거나 이탈할 수 있다. 스피너와 버튼 비활성화로 "지금 처리 중이니 기다려 달라"는 피드백을 준다.

- **에러 메시지 한국어·인라인 표시**: 파일이 잘못됐을 때 영어 에러 코드나 팝업이 아니라, 이유와 조치 방법을 한국어 인라인 메시지로 바로 보여 준다. 사용자가 오류 원인을 이해하고 다시 시도하기 쉽게 하기 위함이다.

- **"다시 하기" 버튼**: 결과를 보고 다른 자소서로 다시 해보고 싶을 때, 페이지를 새로고침하지 않아도 처음 화면으로 돌아올 수 있다.

### 구현 순서 (TDD — Red → Green → Refactor)

**목적**: 자소서 PDF 업로드 → 예상 면접 질문을 카테고리별로 보기 → (선택) 다시 하기. 한 페이지에서 업로드 화면과 결과 화면만 상태로 전환.

#### 1단계: 프로젝트 초기화 및 테스트 환경 세팅
- Next.js 프로젝트 초기화 (App Router, TypeScript, Tailwind CSS v4)
- Vitest + @testing-library/react 설정
- `.env.local` 생성 (`ENGINE_BASE_URL=http://localhost:8000`)

#### 2단계: 타입 정의
- `src/lib/types.ts` 작성
  - `Question`, `QuestionsResponse` — 엔진 응답 타입
  - `UploadState` — `idle | uploading | processing | done | error`
  - `ERROR_MESSAGES` — HTTP 상태 코드별 한국어 메시지 상수 (에러 시 보여 줄 문구 통일)

#### 3단계: API 라우트 TDD
- 서비스는 엔진을 통해 질문을 받아오면 됨 → 브라우저가 보낸 PDF를 엔진으로 넘기고 응답을 그대로 전달하도록 구현.
- `tests/api/questions.test.ts` 먼저 작성 (6개 케이스)
  - 파일 없음 → 400
  - 엔진 200/400/422/500 응답 그대로 전달
  - fetch 네트워크 실패 → 500
- `src/app/api/resume/questions/route.ts` 구현
  - PDF FormData 수신 → 엔진 HTTP 포워딩 → 응답 반환 (파싱/LLM은 엔진만 담당)

#### 4단계: UI 컴포넌트 TDD

**UploadForm** (`tests/components/UploadForm.test.tsx` 7개)  
- 업로드 중/에러를 분명히 보여 주려고 → 버튼 문구·스피너·에러 시 한글 메시지(`role="alert"`).
- idle 상태: 파일 선택 input, 질문 생성 버튼 렌더링
- 파일 미선택 시 버튼 비활성화
- uploading/processing 상태: 스피너, 버튼 비활성화
- error 상태: 에러 메시지 `role="alert"` 표시
- 파일 선택 후 submit → onSubmit 콜백 호출

**QuestionList** (`tests/components/QuestionList.test.tsx` 5개)  
- 질문을 카테고리별로 보여 주고, 다시 하기로 처음부터 할 수 있게 하려고 → 카테고리 섹션 + "다시 하기"로 업로드 화면 복귀.
- 카테고리별 그룹핑 후 섹션 렌더링
- 질문 개수 표시
- 다시 하기 버튼 클릭 → onReset 콜백 호출

#### 5단계: 메인 페이지 통합
- 자소서 올리기 → 결과 보기 → (선택) 다시 하기까지 한 화면에서 단계만 바뀌게 하려고 → `state` 하나로 전환.
- `src/app/page.tsx` — 상태(`state`) 하나로 업로드 화면 ↔ 결과 화면 전환, 엔진 호출·에러 처리 통합

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
