# [#98] 테스트 결과 — LLM 옵저버빌리티 대시보드

> 작성: 2026-03-20

---

## 전체 결과

| 구분 | 결과 |
|------|------|
| vitest 전체 | **154/154 통과** (29 test files) |
| API 테스트 | 7/7 통과 |
| UI 테스트 | 5/5 통과 |
| E2E 테스트 | 6케이스 작성 (Playwright — 로컬 dev 서버 기준) |
| TypeScript | 에러 없음 |

---

## API 테스트 (`tests/api/observability-route.test.ts`)

| # | 케이스 | 결과 |
|---|--------|------|
| 1 | 비인증 (user null) → 401 | ✅ |
| 2 | 비관리자 (role !== "admin") → 403 | ✅ |
| 3 | 정상 조회 (관리자) → 200, rows+summary 구조 검증 | ✅ |
| 4 | 빈 데이터 → 200, rows=[], totalCalls=0, lastUpdated=null | ✅ |
| 5 | DB 에러 (`$queryRaw` throws) → 500 | ✅ |
| 6 | days 파라미터 → $queryRaw 호출에 days 값 포함 확인 | ✅ |
| 7 | Zod 검증 실패 (malformed row) → 500 | ✅ |

**모킹 전략**:
- `vi.mock("@/lib/prisma")` → `prisma.$queryRaw` 제어
- `vi.mock("@/lib/supabase/server")` → `supabase.auth.getUser()` 제어
- `vi.mock("next/headers")` → cookies 제어

---

## UI 테스트 (`tests/ui/observability-page.test.tsx`)

| # | 케이스 | 결과 |
|---|--------|------|
| 1 | 로딩 상태 → `.animate-pulse` skeleton 렌더링 | ✅ |
| 2 | 정상 데이터 → stat 카드 3개 ("총 AI 호출 횟수", "평균 응답 시간", "예상 AI 비용") + 숫자 42 | ✅ |
| 3 | 정상 데이터 → bar-chart, line-chart 존재 | ✅ |
| 4 | 빈 데이터 → "아직 데이터가 없습니다" 텍스트 | ✅ |
| 5 | 기간 필터 "최근 7일" 버튼 클릭 → fetch days=7 재호출 | ✅ |

**모킹 전략**:
- `vi.mock("chart.js")` → Chart, CategoryScale, LinearScale, BarElement, BarController, PointElement, LineElement, LineController, ArcElement, Title, Tooltip, Legend 전부 class mock
- `vi.mock("react-chartjs-2")` → Bar/Line/Doughnut → `<div data-testid="*-chart" />`
- `vi.mock("next/navigation")` → `useRouter` mock
- `global.fetch` mock → mockData 반환
- import 대상: `ObservabilityDashboard` (SSR 래퍼 `page.tsx` 아님)

---

## E2E 테스트 (`tests/e2e/observability-dashboard.spec.ts`)

| # | 케이스 | 내용 |
|---|--------|------|
| 1 | 관리자 정상 데이터 | stat 카드 (총 호출 20), 평균 latency 380, "면접 시작"/"이력서 분석" 레이블 |
| 2 | 빈 데이터 | "아직 데이터가 없습니다" 표시 |
| 3 | 비관리자 403 | `/dashboard`로 리다이렉트 |
| 4 | 기간 필터 7일 | "최근 7일" 버튼 클릭 → API days=7 파라미터 포함 |
| 5 | Sidebar "운영 현황" | 링크 표시 + 클릭 시 `/dashboard/observability`로 이동 |
| 6 | 로딩 skeleton | 1.2초 지연 후 데이터 렌더링 확인 |

**주의**: E2E는 Playwright + 로컬 dev 서버 (`localhost:3001`) 기준. CI에서는 별도 설정 필요.

---

## 트러블슈팅 기록

### 1. Hydration mismatch (`ssr: false` in Server Component)
- **현상**: `page.tsx`가 Server Component인데 `dynamic({ ssr: false })` 사용 → 빌드 에러
- **원인**: Next.js 15에서 Server Component에서 `ssr: false` 금지
- **해결**: `page.tsx`에 `"use client"` 추가

### 2. UI 테스트 — ArcElement 미등록
- **현상**: Doughnut 차트 추가 후 chart.js mock에 `ArcElement` 없어 5개 테스트 전부 실패
- **해결**: `vi.mock("chart.js")` 에 `ArcElement: class {}` 추가, `vi.mock("react-chartjs-2")`에 `Doughnut` mock 추가

### 3. UI 테스트 — import 대상 오류
- **현상**: `page.tsx`가 `dynamic` 래퍼로 바뀐 후 테스트에서 빈 컴포넌트 렌더링
- **해결**: 테스트 import를 `page` → `ObservabilityDashboard`로 변경

### 4. 가중평균 버그 (code reviewer 지적)
- **현상**: `avgLatency`를 단순 행 평균으로 계산 → 소량 호출 기능이 latency 왜곡
- **해결**: `Σ(avgLatencyMs * callCount) / totalCalls` 가중평균으로 수정. `avgErrorRate`도 동일하게 `totalErrors / totalCalls`로 수정

### 5. Zod `as` 캐스트 (code reviewer 지적)
- **현상**: 클라이언트에서 `json as ObservabilityResponse` → 런타임 검증 없음
- **해결**: `ObservabilityResponseSchema.parse(json)` 으로 교체

### 6. 401 미처리 (code reviewer 지적)
- **현상**: 403만 리다이렉트 처리, 401(미인증)은 처리 안 함
- **해결**: `if (r.status === 401) router.replace("/")`  추가

### 7. 이미지 PDF 타임아웃
- **현상**: OCR 처리에 ~116초 소요, 30초 타임아웃 초과
- **해결**: `AbortSignal.timeout(30000)` → `180000` (3분), `maxDuration` 60 → 300

### 8. `analytics.llm_events_daily` 500 에러
- **현상**: 대시보드 데이터 없음 (500 응답)
- **원인**: `prompt_tokens`, `completion_tokens` 컬럼 DB 마이그레이션 미실행
- **해결**: Supabase SQL 에디터에서 `airflow/migrations/add_prompt_completion_tokens.sql` 실행 필요

---

## 후속 이슈

- **#165** `feat: [siw] 인터뷰·연습 기능 withEventLogging 적용 — 토큰 사용량 추적 확장`
  - 인터뷰 route들(`/api/interview/*`)에 `withEventLogging` 미적용 상태
  - resume만 토큰 추적됨, 인터뷰/연습은 별도 PR 필요
