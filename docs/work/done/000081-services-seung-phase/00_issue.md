# feat: services/seung Phase 2 — 역량 평가 리포트 구현

## 사용자 관점 목표
seung 서비스에서 패널 면접 완료 후 8축 역량 평가 리포트를 확인할 수 있다. 각 축별 점수·피드백과 총점을 리포트 페이지에서 조회한다.

## 배경
engine 기능 07(`POST /api/report/generate`)이 완료됐으며, seung Next.js 서비스가 이를 연동한다. Phase 1(패널 면접 + 꼬리질문)은 완료 상태. 엔진은 완전 stateless — `history`와 `resumeText`는 seung이 Supabase에서 관리하고 엔진 호출 시 풀 컨텍스트를 전달한다.

**필드명 주의:** 엔진이 반환하는 `axisFeedbacks: AxisFeedback[8]`을 기준으로 저장·반환. `dev_spec.md` 기능07 응답 예시의 `actionItems`는 명명 불일치 — 엔진 계약 우선.

**레이더 차트는 이번 범위 외.** 기본 UI(숫자+프로그레스 바)로 구현 후 별도 이슈 고도화.

**엔진 수정 금지** — 엔진 API 규격(`engine/.ai.md`)에 맞게 서비스 파트만 개발한다.

## 사전 검토 필수
- `engine/.ai.md` — `/api/report/generate` 계약 (`axisFeedbacks` 필드, 내부 LLM timeout 60s)
- `docs/specs/mirai/dev_spec.md` — 기능 07 명세
- `docs/specs/mirai/ux_flow.md` — 기능 07 화면 구성

## 완료 기준
- [x] `lib/types.ts`에 `AxisScores`, `AxisFeedback`, `ReportResponse` 타입 추가
- [x] `Report` Prisma 모델 추가 (`id`, `sessionId` FK → InterviewSession, `totalScore Int`, `scores Json`, `summary String`, `axisFeedbacks Json`, `createdAt DateTime @default(now())`) + `prisma migrate dev` + Supabase RLS SQL 마이그레이션
- [x] `POST /api/report/generate` 라우트: `sessionComplete === false` → 400 / 동일 sessionId Report 기존재 시 기존 `reportId` 반환 / 엔진 호출 (`AbortSignal.timeout(90_000)`, `maxDuration = 100`) / 엔진 422(InsufficientAnswersError) → 서비스 422 반환 / Report 저장 → `reportId` 반환
- [x] `GET /api/report?reportId=xxx` 라우트: DB 조회 후 반환, 없으면 404
- [x] `InterviewChat` 컴포넌트: `onReport?: () => void` prop 추가, 면접 완료 블록에 "리포트 생성하기"(로딩 스피너) + "다시 시작" 버튼 병렬 표시
- [x] `/interview` 페이지: `isGeneratingReport` 상태 + `handleReport` 핸들러 — 로딩 중 버튼 비활성화, 완료 시 `/report?reportId=xxx` 이동, 에러 시 인라인 메시지 표시
- [x] `/report` 페이지: Suspense 래퍼(`useSearchParams`), `reportId` 없거나 404 시 `/resume` redirect, 총점·8축 점수(숫자+프로그레스 바)·종합 요약·축별 피드백 카드·"홈으로" 버튼 표시
- [x] Vitest 단위 테스트 (mockPrisma에 `report.findFirst`, `report.create` 포함)
- [x] Playwright E2E (`test.setTimeout(120_000)` 이상, 면접 완료 → 리포트 생성 → 리포트 페이지 전 과정)
- [x] `services/seung/.ai.md` 최신화

## 구현 플랜
1. **타입 정의** — `lib/types.ts`에 `AxisScores`, `AxisFeedback`, `ReportResponse` 추가
2. **Prisma 스키마** — `Report` 모델 추가, `prisma migrate dev`, Supabase RLS SQL 적용
3. **API 라우트 TDD**:
   - `POST /api/report/generate` — `select { resumeId, history, sessionComplete }`로 세션 조회 → 완료 검증 → 중복 체크(findFirst) → DB history에서 `questionType` 제거 후 엔진 호출(90s timeout, maxDuration=100) → Report 저장
   - `GET /api/report` — reportId DB 조회 후 반환
4. **컴포넌트 수정** — `InterviewChat.tsx`: `onReport` prop 추가, 완료 블록 버튼 2개
5. **페이지 수정** — `interview/page.tsx`: `isGeneratingReport` 상태 + `handleReport` 핸들러
6. **리포트 페이지** — `app/report/page.tsx` (Suspense 래퍼) + `ReportCard` 컴포넌트 (점수 바·피드백·growthCurve null 플레이스홀더·홈으로 버튼)
7. **Playwright E2E** — 면접 완료 → 리포트 생성 → 리포트 페이지 확인 (test.setTimeout ≥ 120_000)

## 개발 체크리스트
- [ ] 테스트 코드 포함 (Vitest unit + Playwright e2e)
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 직접 호출 금지 — 엔진 경유만)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 금지)

---

## 작업 내역

### 2026-03-16 — Phase 2 구현 완료

**구현 내역:**
- `src/lib/types.ts` — `AxisScores`, `AxisFeedback`, `ReportResponse`, `StoredHistoryEntry` 타입 추가
- `src/app/api/interview/answer/route.ts` — 로컬 `StoredHistoryEntry` 타입 제거 → `lib/types.ts` import 교체
- `prisma/schema.prisma` — `Report` 모델 추가, `InterviewSession.report?` 역관계 추가
- `prisma migrate dev --name add-report` 실행 완료 (migration: `20260316033520_add_report`)
- Supabase RLS SQL 적용 완료 (`ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY` + policy)
- `src/app/api/report/generate/route.ts` — POST 라우트 신규 (maxDuration=100, 90s timeout, P2002 fallback)
- `src/app/api/report/route.ts` — GET 라우트 신규
- `src/components/InterviewChat.tsx` — `onReport`, `isGeneratingReport` prop 추가, animate-spin 스피너
- `src/app/interview/page.tsx` — `handleReport`, `isGeneratingReport`, `reportError` 추가
- `src/app/report/page.tsx` — 신규 (Suspense, 총점/8축/피드백/growthCurve 플레이스홀더/홈으로)
- `tests/api/report-generate.test.ts` — 9개 케이스 신규
- `tests/api/report-get.test.ts` — 3개 케이스 신규
- `tests/components/InterviewChat.test.tsx` — 2개 케이스 추가
- `tests/e2e/report-flow.spec.ts` — 2개 E2E 케이스 신규 (test.setTimeout 120_000)
- `services/seung/.ai.md` 최신화

**테스트 결과:** Vitest 56/56 통과

### 2026-03-17

**현황**: 9/9 완료

**완료된 항목**:
- 실제 엔진 연동 E2E 검증 (`real-report-flow.spec.ts` 신규 추가, 1/1 통과, 소요 1.4분)
- `tests/e2e/real-report-flow.spec.ts` — 자소서 업로드 → 패널 면접 → 리포트 생성 전체 플로우 실제 환경 검증
- Playwright 비디오 녹화 확인 (`test-results/real-report-flow-*/video.webm`)

**미완료 항목**: 없음

**변경 파일**: 1개 (`tests/e2e/real-report-flow.spec.ts` 신규)

