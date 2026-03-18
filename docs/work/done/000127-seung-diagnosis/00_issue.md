# feat: services/seung Phase 3 — 서류 강점·약점 진단 구현 (기능 02)

## 사용자 관점 목표
자소서 업로드 후 지원 직무를 입력하면 면접관 시각의 5개 항목 점수·강점·약점·개선 방향을 진단 페이지에서 확인할 수 있다.

## 배경
엔진 이슈 #90(`POST /api/resume/feedback`)이 완료됐으며, seung Next.js 서비스가 이를 연동한다. 기능01(질문 생성) 완료 후 `resumeId` 기반으로 서버에서 `resumeText`를 조회해 엔진을 호출한다.

- `targetRole` 입력: `/resume` 페이지 질문 리스트 아래 인라인 입력 필드
- 결과 표시: 새 `/diagnosis?resumeId=xxx` 페이지 (`/report` 패턴과 동일)
- DB 저장: `Resume` 모델에 `diagnosisResult Json?` 추가 — 재진단 시 항상 덮어쓰기

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — `/api/resume/feedback` 계약 (timeout 30s)
- `docs/specs/mirai/dev_spec.md` — 기능 02 명세
- `docs/specs/mirai/ux_flow.md` — 기능 02 화면 구성

## 완료 기준
- [x] `lib/types.ts`에 `FeedbackScores`, `SuggestionItem`, `ResumeFeedbackResponse` 타입 추가
- [x] `Resume` Prisma 모델에 `diagnosisResult Json?` 추가 + `prisma migrate dev`
- [x] `POST /api/resume/feedback` 라우트: `{ resumeId, targetRole }` → DB에서 `resumeText` 조회 → 엔진 포워딩 (`AbortSignal.timeout(40_000)`) → 결과 DB 저장(덮어쓰기) 후 반환
- [x] `GET /api/resume/diagnosis?resumeId=xxx` 라우트: DB 조회 후 반환, 없으면 404
- [x] `/resume` 페이지: `resumeId` 있을 때 브랜칭 카드 UX("면접 시작하기 / 서류 진단받기") — "서류 진단받기" 선택 시 `targetRole` 입력 + "진단하기" 버튼, 완료 시 `/diagnosis?resumeId=xxx` 이동 (초기 계획 "인라인 입력 필드"에서 UX 변경)
- [x] `/diagnosis` 페이지: `resumeId` 없거나 404 시 `/resume` redirect, 5개 항목 점수·강점·약점·개선 방향·"홈으로" 버튼 표시
- [x] Vitest 단위 + Playwright E2E 테스트 전체 통과 (기존 회귀 없음 포함)
- [x] `services/seung/.ai.md` 최신화

## 구현 플랜
1. **타입 정의** — `lib/types.ts`에 `FeedbackScores`, `SuggestionItem`, `ResumeFeedbackResponse` 추가
2. **Prisma 스키마** — `Resume`에 `diagnosisResult Json?` 추가 + `prisma migrate dev`
3. **기존 테스트 mock 수정** — `questions.test.ts`의 `mockPrisma.resume.create` 반환 객체에 `diagnosisResult: null` 추가 (기존 테스트 파손 방지)
4. **API 라우트 TDD**
   - `POST /api/resume/feedback` — resumeId로 Resume 조회(없으면 404) → targetRole 빈값 검증(400) → 엔진 포워딩(40s timeout) → `prisma.resume.update`로 저장
   - `GET /api/resume/diagnosis` — resumeId로 Resume 조회 → `diagnosisResult` 반환(없으면 404)
5. **Resume 페이지** — `targetRole` 입력 필드 + "진단하기" 버튼, `isDiagnosing` 상태 + `handleDiagnosis` 핸들러
6. **Diagnosis 페이지** — `app/diagnosis/page.tsx` (Suspense 래퍼), resumeId로 GET 조회, 5개 항목 점수(프로그레스 바)·강점/약점 리스트·suggestions 카드·"홈으로" 버튼
7. **Playwright E2E** — 업로드 → targetRole 입력 → 진단하기 → 진단 페이지 확인

## 개발 체크리스트
- [x] 테스트 코드 포함 (Vitest unit + Playwright e2e, 기존 회귀 없음)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (LLM 직접 호출 금지 — 엔진 경유만)
- [x] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 금지)

---

## 작업 내역

- UX 변경: `/resume` 페이지 진단 UI를 초기 계획(인라인 입력 필드)에서 브랜칭 카드 구조("🎤 면접 시작하기 / 📋 서류 진단받기")로 변경 — 면접/진단이 동등한 선택지로 자연스럽게 제안되는 UX 채택
- E2E 회귀 수정: 브랜칭 카드 UI 변경으로 인해 `interview-flow`, `practice-flow`, `real-interview-flow`, `real-report-flow` 테스트 셀렉터 불일치 → 카드 클릭 → 모드 선택 → 확인 3단계 흐름으로 수정
- 실제 엔진 연동 E2E: `real-diagnosis-flow.spec.ts` 추가 (자소서 업로드 → 서류 진단 전체 플로우, 영상 녹화)

