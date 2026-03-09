# feat: kwan 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end

## 사용자 관점 목표
자소서 PDF를 업로드하면, 내 서류에서 나올 면접 예상 질문을 카테고리별로 받을 수 있다. (kwan 서비스 독자 구현)

## 배경
엔진(`engine/`)은 공동 개발 완료 (`POST /api/resume/questions` 구현됨). `mirai_project_plan.md` 지침에 따라 서비스는 각자 독립적으로 개발한다. kwan 멘티가 `services/kwan/` 디렉토리에 자소서 → 질문 생성 MVP를 직접 설계·구현한다.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — 엔진 API 계약, 에러 코드, 예외 계층
- `docs/specs/mvp/dev_spec.md` — MVP 기술 스택, API 명세 §5-1, 프론트엔드 §7

## 완료 기준
- [x] `services/kwan/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [x] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [x] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [x] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [x] 에러 처리: 400/422/500 한국어 안내
- [x] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트)
- [x] `services/kwan/.ai.md` 최신화 (구조·진행 상태 반영)
- [x] 불변식 준수: `services/kwan/`에 `import anthropic` / `import fitz` 없음

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

### 프로젝트 초기화
`create-next-app`으로 Next.js 16 + TypeScript + Tailwind 프로젝트 생성. Vitest + @testing-library/react + jsdom 설치. `vitest.config.ts`에 jsdom 환경 및 `@/*` alias 설정.

### 타입 정의 (`src/domain/interview/types.ts`)
엔진 인터페이스에 맞는 `Category`, `Question`, `GenerateResult`, `UploadState` 타입 정의. DDD 원칙에 따라 `domain/interview/` 디렉토리에 분리.

### 엔진 HTTP 클라이언트 (`src/lib/engine-client.ts`)
`ENGINE_BASE_URL` 환경변수 기반 fetch 래퍼 구현. `AbortSignal.timeout(30_000)`으로 30초 타임아웃 설정.

### API 라우트 TDD (`src/app/api/resume/questions/route.ts`)
테스트 먼저 작성 후 구현. 엔진 400/422/500 에러 메시지를 그대로 프록시하고, 네트워크 오류(타임아웃·엔진 다운) 시 500 한국어 메시지 반환.

### 업로드 UI (`src/components/UploadForm.tsx`)
`accept=".pdf"` 강제, 비-PDF 선택 시 인라인 에러, 로딩 중 버튼 비활성화 처리.

### 결과 UI (`src/components/QuestionList.tsx`)
`reduce`로 카테고리별 그룹핑, 고정 순서(직무 역량→경험의 구체성→성과 근거→기술 역량)로 표시. "다시 하기" 버튼으로 초기화.

### 메인 페이지 (`src/app/page.tsx`)
`UploadState` 기반으로 UploadForm ↔ QuestionList 전환. 에러 메시지 인라인 표시.

### 테스트 fixture 적용
멘토 제공 공식 fixture(`000028-fixtures`) 중 kwan용 JSON 2개(`mock_engine_response.json`, `error_responses.json`)를 `tests/fixtures/input/`에 적용.

### 엔진 연결
main 브랜치 머지 후 엔진 Python 코드 확인. `engine/.env`에 `OPENROUTER_API_KEY` 설정, uvicorn으로 엔진 실행 후 `.env.local` `ENGINE_BASE_URL=http://localhost:8001`로 변경해 end-to-end 동작 확인.
