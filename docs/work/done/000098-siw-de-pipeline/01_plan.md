# [#98] feat: [siw][DE] Pipeline 1 대시보드 — LLM 옵저버빌리티 시각화 (기능별 호출·latency·에러율) — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

- [x] `/dashboard/observability` 페이지 신규 — 관리자 인증 필요
- [x] 기능별 일별 호출 건수 grouped bar chart
- [x] 평균 latency 추이 line chart (기준선 포함)
- [x] 기능별 에러율 표시
- [x] `GET /api/dashboard/observability` 엔드포인트 신규 — `llm_events_daily` 조회 후 반환
- [x] vitest: observability API 테스트 (7케이스) + UI 테스트 (5케이스)
- [x] 테스트 코드 포함 (154/154 전체 통과)
- [x] `services/siw/.ai.md` 최신화
- [x] 불변식 위반 없음
- [x] 관리자 권한 체크 — 비관리자 403 반환, `/dashboard` 리다이렉트

---

## ADR (Architecture Decision Record)

- **Decision**: chart.js + react-chartjs-2 재활용 (기존 설치됨: `chart.js ^4.4.0`, `react-chartjs-2 ^5.2.0`)
- **Drivers**: 추가 의존성 없음, growth 페이지와 패턴 일관성, 번들 크기 유지
- **Alternatives**:
  - recharts: 새 의존성 추가 (~40KB gzipped) + 이중 라이브러리 혼용 → 비용 > 이점
  - 커스텀 CSS/SVG: 3종 차트 직접 구현 비현실적
- **Consequences**: `$queryRaw` + Zod 런타임 검증으로 타입 안전성 보완

---

## 구현 계획

### Step 0 — 선행 확인: DB 권한 & 스키마 검증

`analytics` 스키마는 Airflow SQL로 생성됨. Prisma/Next.js DB 사용자가 이 스키마에 접근 권한이 있는지 확인 필수.

**확인 방법**:
```sql
-- Supabase SQL Editor에서 실행 (또는 DBA에게 확인 요청)
GRANT USAGE ON SCHEMA analytics TO <prisma_user>;
GRANT SELECT ON analytics.llm_events_daily TO <prisma_user>;

-- 권한 확인
SELECT has_schema_privilege('<prisma_user>', 'analytics', 'USAGE');
SELECT has_table_privilege('<prisma_user>', 'analytics.llm_events_daily', 'SELECT');
```

**DDL 확인**: `services/siw/airflow/sql/001_create_llm_events_daily.sql` (기본 컬럼)
+ `services/siw/airflow/migrations/add_token_columns.sql` (total_tokens, estimated_cost_usd — 이번 대시보드에서는 미포함, 향후 확장)

---

### Step 1 — Zod 스키마 & API 엔드포인트

**신규 파일 2개**:

#### (1-a) `services/siw/src/lib/observability/schemas.ts`

`$queryRaw`는 `unknown[]`를 반환하므로 Zod 런타임 검증 필수.
기존 `src/lib/interview/schemas.ts` 패턴 재사용.

```ts
import { z } from "zod";

// DB raw row (snake_case, $queryRaw 반환)
export const LlmEventsDailyRowSchema = z.object({
  date: z.string(),                      // DATE → SQL ::TEXT 캐스팅
  feature_type: z.string(),
  call_count: z.number(),                // INTEGER → SQL ::INT 캐스팅
  avg_latency_ms: z.number(),            // NUMERIC(10,2) → SQL ::FLOAT 캐스팅
  error_count: z.number(),               // INTEGER → SQL ::INT 캐스팅
  error_rate: z.number(),                // REAL → SQL ::FLOAT 캐스팅
});
export type LlmEventsDailyRow = z.infer<typeof LlmEventsDailyRowSchema>;

// API 응답 (camelCase)
export const ObservabilityResponseSchema = z.object({
  rows: z.array(z.object({
    date: z.string(),
    featureType: z.string(),
    callCount: z.number(),
    avgLatencyMs: z.number(),
    errorCount: z.number(),
    errorRate: z.number(),
  })),
  summary: z.object({
    totalCalls: z.number(),
    avgLatency: z.number(),
    avgErrorRate: z.number(),
    featureTypes: z.array(z.string()),
    lastUpdated: z.string().nullable(),
  }),
});
```

#### (1-b) `services/siw/src/app/api/dashboard/observability/route.ts`

기존 `services/siw/src/app/api/growth/sessions/route.ts` 패턴 준수.

```ts
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { LlmEventsDailyRowSchema } from "@/lib/observability/schemas";
import { z } from "zod";

export async function GET(req: NextRequest) {
  // 1. 인증
  const cookieStore = await cookies();
  const supabase = createServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ message: "인증이 필요합니다" }, { status: 401 });
  }

  // 2. days 파라미터 파싱 (1~90, 기본 30)
  const daysParam = req.nextUrl.searchParams.get("days");
  const days = Math.min(90, Math.max(1, Number(daysParam) || 30));

  try {
    // 3. $queryRaw — 명시적 ::TYPE 캐스팅으로 JS 직렬화 안전성 보장
    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        date::TEXT        AS date,
        feature_type      AS feature_type,
        call_count::INT   AS call_count,
        avg_latency_ms::FLOAT AS avg_latency_ms,
        error_count::INT  AS error_count,
        error_rate::FLOAT AS error_rate
      FROM analytics.llm_events_daily
      WHERE date >= CURRENT_DATE - (${days} * INTERVAL '1 day')
      ORDER BY date ASC, feature_type ASC
    `);

    // 4. Zod 런타임 검증
    const parsed = z.array(LlmEventsDailyRowSchema).parse(rows);

    // 5. camelCase 변환 + summary 계산
    const camelRows = parsed.map(r => ({
      date: r.date,
      featureType: r.feature_type,
      callCount: r.call_count,
      avgLatencyMs: r.avg_latency_ms,
      errorCount: r.error_count,
      errorRate: r.error_rate,
    }));

    const totalCalls = camelRows.reduce((acc, r) => acc + r.callCount, 0);
    const avgLatency = camelRows.length > 0
      ? camelRows.reduce((acc, r) => acc + r.avgLatencyMs, 0) / camelRows.length
      : 0;
    const avgErrorRate = camelRows.length > 0
      ? camelRows.reduce((acc, r) => acc + r.errorRate, 0) / camelRows.length
      : 0;
    const featureTypes = [...new Set(camelRows.map(r => r.featureType))];
    const lastUpdated = camelRows.length > 0 ? camelRows[camelRows.length - 1].date : null;

    return Response.json({
      rows: camelRows,
      summary: { totalCalls, avgLatency, avgErrorRate, featureTypes, lastUpdated },
    });
  } catch (e) {
    console.error("[observability] DB 조회 실패:", e);
    return Response.json({ message: "서버 오류" }, { status: 500 });
  }
}
```

**주의사항**:
- `Prisma.sql` 태그드 리터럴 사용 → SQL injection 방지
- `::TYPE` 캐스팅으로 BigInt/Decimal 직렬화 에러 사전 차단
- `analytics.llm_events_daily` fully-qualified name 사용

---

### Step 2 — API 테스트

**신규 파일**: `services/siw/tests/api/observability-route.test.ts`

기존 `tests/api/growth-sessions-route.test.ts` 패턴 그대로.

```ts
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerClient: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: vi.fn() } }));

// Mock raw rows (snake_case, 이미 캐스팅된 JS 타입)
const mockRows = [
  { date: "2026-03-19", feature_type: "interview_start", call_count: 10,
    avg_latency_ms: 320.5, error_count: 1, error_rate: 0.1 },
];
```

**5 테스트 케이스**:
| # | Case | Assert |
|---|------|--------|
| 1 | 인증된 정상 조회 | 200, `rows`/`summary` 구조 검증 |
| 2 | 빈 데이터 | 200, `rows=[]`, `totalCalls=0`, `lastUpdated=null` |
| 3 | 미인증 (user null) | 401 |
| 4 | DB 에러 (`$queryRaw` throws) | 500 |
| 5 | `days` 파라미터 | 200, `$queryRaw` 호출 인자에 days 값 포함 |

---

### Step 3 — 대시보드 페이지

**신규 파일**: `services/siw/src/app/(app)/dashboard/observability/page.tsx`

기존 `services/siw/src/app/(app)/growth/page.tsx` 패턴 준수 (`"use client"` + chart.js).

**구조**:
```
ObservabilityPage
├── 상단 stat 카드 3개 (총 호출 수, 평균 Latency, 평균 에러율)
├── 기간 필터 버튼 (7일 / 14일 / 30일)
├── Bar Chart — 기능별 일별 호출 건수
│   └── chart.js: CategoryScale + LinearScale + BarElement
├── Line Chart — 평균 latency 추이 (기능별 라인)
│   └── chart.js: CategoryScale + LinearScale + PointElement + LineElement
└── 에러율 표시 — feature_type별 카드 (색상: 0% 녹색, >5% 빨강)
```

**chart.js 등록**:
```ts
ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, BarController,
  PointElement, LineElement, LineController,
  Title, Tooltip, Legend
);
```

**상태 처리**:
- 로딩: `animate-pulse` skeleton (기존 패턴)
- 빈 데이터: "아직 데이터가 없습니다. Airflow DAG(#95)가 실행되면 표시됩니다." 안내
- 에러: 에러 메시지 표시

**반응형**: `grid-cols-1 lg:grid-cols-2`

---

### Step 4 — UI 테스트

**신규 파일**: `services/siw/tests/ui/observability-page.test.tsx`

기존 `tests/ui/dashboard-page.test.tsx` 패턴 준수.

```ts
vi.mock("chart.js", () => ({ Chart: vi.fn(), ... }));
vi.mock("react-chartjs-2", () => ({
  Bar: ({ "data-testid": testId }: { "data-testid"?: string }) => <div data-testid={testId ?? "bar-chart"} />,
  Line: ({ "data-testid": testId }: { "data-testid"?: string }) => <div data-testid={testId ?? "line-chart"} />,
}));
```

**5 테스트 케이스**:
| # | Case | Assert |
|---|------|--------|
| 1 | 로딩 상태 | skeleton `animate-pulse` 렌더링 |
| 2 | 정상 데이터 → stat 카드 | 3개 카드 + 숫자 표시 |
| 3 | 정상 데이터 → 차트 | `data-testid="bar-chart"`, `"line-chart"` 존재 |
| 4 | 빈 데이터 | "아직 데이터가 없습니다" 텍스트 |
| 5 | 기간 필터 버튼 | "7일" 버튼 클릭 → `fetch` 재호출 (days=7) |

---

### Step 5 — 네비게이션 연결 + `.ai.md` 최신화

**수정 파일**:
1. `services/siw/src/components/Sidebar.tsx` — NAV_ITEMS에 추가:
   ```ts
   { href: "/dashboard/observability", label: "운영 현황", icon: ActivityIcon }
   ```
   (lucide-react의 `Activity` 아이콘 사용)

2. `services/siw/src/app/(app)/dashboard/page.tsx` — observability 퀵 액션 카드 추가
   (기존 "이력서 관리"/"면접 시작" 카드와 동일 스타일)

3. `services/siw/.ai.md` — 다음 업데이트:
   - 파일 구조에 추가: `api/dashboard/observability/route.ts`, `(app)/dashboard/observability/page.tsx`, `lib/observability/schemas.ts`
   - 테스트 파일 목록에 추가
   - 진행 상태에 Issue #98 완료 기록

---

## 엣지 케이스 / 주의사항 요약

| 항목 | 내용 | 완화 방법 |
|------|------|----------|
| analytics 스키마 권한 | Prisma 유저 접근 불가 시 500 | Step 0에서 선행 확인 |
| BigInt/Decimal 직렬화 | `NUMERIC` → JS `Decimal`, `INTEGER` → BigInt | SQL `::FLOAT`, `::INT` 캐스팅 |
| Zod 검증 실패 | DDL 변경 시 런타임 에러 | `schemas.ts`에 Zod 스키마 정의 |
| 빈 테이블 | DAG 미실행 시 빈 배열 | 빈 상태 UI 필수 |
| chart.js SSR 불가 | `canvas` 의존 | `"use client"` 필수 |
| DATE 타입 | Prisma가 Date 객체 반환 가능 | `::TEXT` 캐스팅으로 string 보장 |
| total_tokens/estimated_cost_usd | 이번 AC에 미포함 | 향후 확장으로 남김 |
