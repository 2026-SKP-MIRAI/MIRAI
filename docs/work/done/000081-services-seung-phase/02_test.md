# [#81] feat: services/seung Phase 2 — 역량 평가 리포트 구현 — 테스트 결과

> 작성: 2026-03-16

---

## 최종 테스트 결과

### Vitest 단위 테스트

```
Test Files  8 passed (8)
Tests       56 passed (56)
Duration    3.48s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/report-generate.test.ts` | 9 | ✅ 전체 통과 |
| `tests/api/report-get.test.ts` | 3 | ✅ 전체 통과 |
| `tests/api/interview-answer.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/interview-start.test.ts` | 5 | ✅ 전체 통과 |
| `tests/api/questions.test.ts` | 9 | ✅ 전체 통과 |
| `tests/components/InterviewChat.test.tsx` | 7 | ✅ 전체 통과 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 |

---

### 신규 테스트 케이스 상세

#### `tests/api/report-generate.test.ts` (9개)

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | 성공: sessionComplete=true → 엔진 호출 → report.create → `{ reportId }` (201) | ✅ |
| 2 | sessionId 누락 → 400 | ✅ |
| 3 | ENGINE_BASE_URL 없음 → 500 | ✅ |
| 4 | 세션 없음 → 404 | ✅ |
| 5 | sessionComplete=false → 400 "면접이 아직 완료되지 않았습니다." | ✅ |
| 6 | 기존 Report 있음 → findFirst hit → 기존 reportId (200), 엔진 미호출 | ✅ |
| 7 | 엔진 422 → 서비스 422 "답변이 부족합니다." | ✅ |
| 8 | 엔진 500 → 서비스 500 | ✅ |
| 9 | report.create P2002 → findUnique fallback → 기존 reportId (200) | ✅ |

#### `tests/api/report-get.test.ts` (3개)

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | reportId 있음 → 200 + ReportResponse | ✅ |
| 2 | reportId 없음 → 400 | ✅ |
| 3 | 리포트 없음 → 404 | ✅ |

#### `tests/components/InterviewChat.test.tsx` (2개 추가)

| # | 케이스 | 상태 |
|---|--------|------|
| 6 | onReport prop 전달 시 "리포트 생성하기" 버튼 표시 | ✅ |
| 7 | isGeneratingReport=true 시 버튼 disabled + "리포트 생성 중..." 텍스트 | ✅ |

---

### Playwright E2E

> `tests/e2e/report-flow.spec.ts` (test.setTimeout 120_000)

| # | 케이스 | 비고 |
|---|--------|------|
| 1 | 면접 완료 → "리포트 생성하기" 클릭 → `/report?reportId=xxx` → 총점 표시 | API 모킹 |
| 2 | `/report` (reportId 없음) → `/resume` redirect | API 모킹 |

> E2E는 API 모킹 기반. 실제 엔진 연동 E2E는 아래 참조.

---

### 실제 엔진 연동 E2E (2026-03-17)

> `tests/e2e/real-report-flow.spec.ts` (test.setTimeout 600_000)

| # | 케이스 | 비고 | 결과 |
|---|--------|------|------|
| 1 | 자소서 업로드 → 패널 면접 → 리포트 생성 전체 플로우 | 실제 엔진 + Supabase | ✅ 1.4분 소요 |

**사용 fixture**: `engine/tests/fixtures/input/sample_resume.pdf`

**검증 항목**:
- PDF 업로드 → 질문 생성 (LLM 호출)
- 면접 시작 → 다수 답변 제출 → 면접 완료
- "리포트 생성하기" 클릭 → 엔진 LLM 호출 → `/report?reportId=xxx` 이동
- 총점·역량 축별 점수·종합 요약·축별 피드백·홈으로 버튼 표시 확인

**비디오 녹화**: `test-results/real-report-flow-*/video.webm`

---

### DB 마이그레이션

| 항목 | 결과 |
|------|------|
| `prisma migrate dev --name add-report` | ✅ 완료 (`20260316033520_add_report`) |
| Supabase RLS `ALTER TABLE "Report" ENABLE ROW LEVEL SECURITY` | ✅ 완료 |
| Supabase RLS `CREATE POLICY "service_role_full"` | ✅ 완료 |

---

---

### 코드 리뷰 후 수정 사항 (2026-03-17)

| 심각도 | 파일 | 내용 | 조치 |
|--------|------|------|------|
| MEDIUM | `report/page.tsx` | `report.axisFeedbacks`가 null/undefined일 때 `.find()` / `.map()` 호출 시 런타임 에러 가능 | `(report.axisFeedbacks ?? []).find(...)` / `.map(...)` 으로 null 가드 추가 |

---

### 코드 리뷰 후 수정 사항 (2026-03-16)

| 심각도 | 파일 | 내용 | 조치 |
|--------|------|------|------|
| CRITICAL | `report/generate/route.ts` | P2002 fallback `findUnique`가 try/catch 없이 호출 → 예외 시 unhandled crash | fallback 내부 try/catch 추가 |
| HIGH | `report/generate/route.ts` | `session.history`가 null/non-array 시 `.map()` TypeError | `Array.isArray()` 가드 추가, 비정상 시 500 반환 |
| HIGH | `report/page.tsx` | `report.scores`가 null 시 `Object.entries()` TypeError → 화이트스크린 | `report.scores ?? {}` null 가드 추가 |
| MEDIUM | `report/page.tsx` | `setLoading(false)` `.then()`과 `.finally()` 중복 호출 | `.then()`에서 제거, `.finally()`만 유지 |
| MEDIUM | `report/page.tsx` | `axisFeedbacks`가 비어있을 때 feedback 없는 축이 강제로 주황색 표시 | feedback 미존재 시 중립 회색으로 처리 |

---

### 트러블슈팅 기록

#### `vi.clearAllMocks()` vs `vi.resetAllMocks()` 이슈

- **현상**: `report-generate.test.ts`에서 테스트 5~9번이 한 칸씩 밀려서 실패
- **원인**: `vi.clearAllMocks()`는 호출 기록만 지우고, `mockResolvedValueOnce` 큐는 유지됨. TEST 3 (ENGINE_BASE_URL 없음)에서 route가 early return하여 소비되지 않은 mock이 이후 테스트로 누출
- **해결**: `beforeEach`를 `vi.resetAllMocks()`로 교체 + TEST 3의 불필요한 mock 제거

#### `.env` vs `.env.local` Prisma 인식 문제

- **현상**: `prisma migrate dev` 실행 시 `DIRECT_URL` not found 에러
- **원인**: Prisma는 `.env`만 읽고 `.env.local`은 Next.js 전용
- **해결**: `.env.local` 내용을 `.env`로 복사 (`.gitignore`에 `.env*` 패턴 적용 확인)
