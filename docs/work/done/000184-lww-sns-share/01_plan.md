# [#184] feat: [Fint] Phase 1 — 리포트 카드 SNS 공유 (OG 이미지 + 카카오톡 공유) — 구현 계획

> 작성: 2026-03-25
> Ralplan 합의 (Planner → Architect×2 → Critic×2 → APPROVE)

---

## 완료 기준

- [ ] 리포트 URL 공유 시 카카오톡·SNS 미리보기에 점수·직군이 포함된 OG 카드 이미지 표시
- [ ] 리포트 화면에 카카오톡 공유 버튼 + 링크 복사 버튼 추가
- [ ] 공유 링크로 비로그인 유저도 리포트 조회 가능 (읽기 전용, RLS 설정)
- [ ] OG 카드에 Fint 브랜딩 (Teal #0D9488) 적용

---

## ADR (Architecture Decision Record)

### Decision
리포트 페이지를 Server Component wrapper + Client Component(`ReportContent.tsx`)로 분리하고, `is_public=true` RLS + Edge OG 이미지 라우트로 SNS 공유를 구현한다.

### Drivers
1. 현재 `"use client"` + sessionStorage 구조는 `generateMetadata`(OG 메타태그)를 지원하지 않음
2. 공유 링크로 접근한 비로그인 사용자는 sessionStorage가 없으므로 DB 직접 조회 필요
3. Phase 1 마감 2026-03-27, 최소 침습적 변경 필요

### Alternatives Considered
| 대안 | 기각 이유 |
|------|----------|
| Option B: 별도 `/share/[sessionId]` 페이지 | URL 이원화(공유 URL ≠ 원본 URL), UI 코드 중복 |
| `is_public DEFAULT true` | 기존 모든 리포트 소급 공개 — 프라이버시 침해 |
| OG route에서 `createClient()` (anon) | Edge Runtime에서 `cookies()` 의존 불안정 |
| Kakao SDK를 root layout에 로드 | 모든 페이지에 불필요한 ~40KB 추가 |

### Why Chosen
- **Option A**: 동일 URL 유지로 바이럴 링크 일관성 보장, `isOwner` prop으로 소유자/뷰어 UI 분기
- **`DEFAULT false`**: 신규 리포트만 공유 허용, 기존 데이터 안전
- **`createServiceClient()` + 명시적 필터**: Edge 호환성 + is_public 접근 제어 보장
- **Kakao SDK `(interview)` 레이아웃 스코프**: report 페이지에서만 필요한 SDK를 해당 그룹에만 로드

### Consequences
- 긍정: 기존 URL로 SNS 공유 카드 표시, 비로그인 공유 뷰어 지원, 바이럴 루프 완성
- 부정: `is_public=false` 구 리포트는 공유 불가 (sessionStorage fallback만 동작), 소유자가 sessionStorage 소거 후 재방문 시 서버 fetch로 표시(허용됨)
- 알려진 비대칭: 구 리포트 공유 원하면 별도 백필 마이그레이션 필요

### Follow-ups
- Kakao 개발자 앱 등록 및 도메인 화이트리스트 설정 (구현 전 선행)
- 구 리포트 백필(`UPDATE reports SET is_public=true WHERE status='completed'`) — 선택적, 별도 이슈
- `/api/og/` rate limiting 강화 — 별도 이슈

---

## 구현 계획

### Step 0: 사전 준비 — `@vercel/og` 의존성 추가

**작업**:
```bash
cd services/fint && npm install @vercel/og
```

**검증**: `services/fint/package.json`에 `"@vercel/og"` 항목 확인

---

### Step 1: Supabase DB 마이그레이션

**파일 (신규)**: `services/fint/supabase/migrations/20260325000000_add_reports_is_public.sql`

```sql
-- RLS 활성화 (아직 활성화되지 않은 경우)
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- reports 테이블에 is_public 컬럼 추가
ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

-- RLS: anon 사용자가 is_public=true 리포트 조회 허용
CREATE POLICY "public reports are viewable by everyone"
  ON reports
  FOR SELECT
  TO anon
  USING (is_public = true);
```

**RLS 활성화 확인**: 마이그레이션 전 Supabase 대시보드 → Authentication → Policies → reports 테이블에서 RLS 활성화 여부 확인 필수. 이미 활성화된 경우 `ENABLE ROW LEVEL SECURITY` 라인은 no-op (안전).

**주의**: `services/fint/`에 `supabase/migrations/` 디렉토리 없음. Supabase 대시보드 SQL 에디터에서 직접 실행하거나, 디렉토리 신규 생성 후 `supabase db push`.

**검증**:
- Supabase 대시보드에서 `reports` 테이블에 `is_public` 컬럼 존재 확인
- anon key로 `is_public=false` 리포트 SELECT 시 빈 배열 반환 확인

---

### Step 2: `end` route — `is_public: true` 명시적 설정

**파일**: `services/fint/src/app/api/interview/end/route.ts`

기존 `supabase.from("reports").insert({...})` 에 `is_public: true` 추가:
```typescript
.insert({
  session_id: sessionId,
  anonymous_id: anonymousId,
  user_id: userId,
  status: "completed",
  total_score: report.totalScore,
  axis_scores: report.axisScores,
  axis_feedbacks: report.axisFeedbacks,
  summary: report.summary,
  is_public: true,  // ← 추가
})
```

**검증**: 면접 완료 후 DB에서 `is_public = true` 확인

---

### Step 3: `/api/og/report` Edge Route — OG 이미지 동적 생성

**파일 (신규)**: `services/fint/src/app/api/og/report/route.tsx`

**스펙**:
- `export const runtime = "edge"`
- **Supabase 클라이언트**: `createServiceClient()` (service role, cookie-less, Edge 호환) + 명시적 `.eq('is_public', true)` 필터
- **Edge env 확인**: Vercel 대시보드에서 `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`이 Edge Runtime에 노출되어 있는지 확인 필요
- 쿼리파람: `?sessionId=<UUID>`
- UUID 형식 검증 (Zod) → 실패 시 fallback 이미지 반환 (400 아님, SNS 크롤러 에러 방지)
- Supabase 조회: `reports` (total_score, summary, is_public) + `interview_sessions` (job_category) by session_id
- `is_public = false` 또는 데이터 없으면 → 기본 fallback 카드 반환
- `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800` 헤더 설정

**OG 카드 디자인** (1200×630):
- 배경: 흰색
- 상단: "Fint" 브랜드 텍스트 (Teal #0D9488)
- 중앙: "내 면접 점수는 {N}점!" (점수 크게)
- 점수 색상: 80+ → #0D9488, 60-79 → #F59E0B, <60 → #EF4444
- 하단: 직군명, 요약 앞 50자
- OG 이미지는 JSX inline style 사용 (Tailwind 무관)

**검증**:
- `curl "http://localhost:3000/api/og/report?sessionId=<valid-uuid>"` → PNG 반환
- 잘못된 sessionId → fallback 이미지 (200 OK)
- `Cache-Control` 헤더 포함 확인

---

### Step 4: 리포트 페이지 Server/Client 분리

#### 4-A: `ReportContent.tsx` Client Component 분리

**파일 (신규)**: `services/fint/src/components/report/ReportContent.tsx`

기존 `page.tsx`의 UI 로직 전체를 이 파일로 이동.

```typescript
"use client";

interface ReportContentProps {
  sessionId: string;
  initialReport: ReportResponse | null;  // 서버에서 pre-fetch한 데이터
  isOwner: boolean;                       // 서버에서 판별한 소유자 여부
}
```

데이터 우선순위:
1. `initialReport` prop 있으면 사용
2. 없으면 `sessionStorage.getItem(`report_${sessionId}`)` fallback

`isOwner`에 따른 UI 분기:
- `isOwner = true`: 기존 UI 그대로 (exit dialog, SaveAccountCTA, 기존 하단 CTA)
- `isOwner = false` (공유 뷰어): exit dialog 없음, "나도 면접 연습하기" CTA

#### 4-B: `page.tsx` → Server Component 전환

**파일**: `services/fint/src/app/(interview)/report/[sessionId]/page.tsx`

- **Supabase 클라이언트**: `createClient()` (anon key, RLS 적용) — `createServiceClient()` 아님
  - RLS가 적용되므로 `is_public=true`인 리포트만 조회됨 (코드 레벨 필터 불필요하지만 명시 권장)
  - `is_public=false` 구 리포트는 서버 fetch 실패 → `initialReport=null` → Client에서 sessionStorage fallback
- `"use client"` 제거 → async Server Component
- `generateMetadata` 추가 (`generateMetadata`도 같은 클라이언트 사용)
- `fint_anon_id` 쿠키 (`getAnonId()` from `@/lib/anon-cookie`) vs `report.anonymous_id` 비교로 `isOwner` 판별
- `<ReportContent sessionId={...} initialReport={...} isOwner={...} />` 렌더링

**DB row → ReportResponse 타입 매핑** (page.tsx 내 변환 필수):
```typescript
// DB 컬럼 (snake_case) → 클라이언트 타입 (camelCase)
const initialReport: ReportResponse | null = reportRow ? {
  totalScore: reportRow.total_score,       // total_score → totalScore
  summary: reportRow.summary,              // summary → summary (동일)
  axisFeedbacks: reportRow.axis_feedbacks, // axis_feedbacks → axisFeedbacks
  growthCurve: null,                       // DB에 없음, 항상 null
  // axis_scores는 클라이언트 타입에 없으므로 무시
} : null;
```

**알려진 비대칭 동작**: `is_public=false` 구 리포트 소유자는 서버 fetch 실패 → sessionStorage fallback으로 정상 표시. 새 리포트(`is_public=true`)는 서버 fetch 성공 → sessionStorage 없어도 다른 기기에서 공유 링크로 접근 가능. 이는 의도된 동작.

**엣지 케이스**:
- `is_public=false` (구 리포트): `initialReport=null`, Client에서 sessionStorage fallback
- 소유자가 sessionStorage 소거 후 재방문: DB fetch → 정상 표시
- `end` route DB insert 실패: sessionStorage fallback (기존 동작 유지)

**검증**:
- 면접 직후 리포트: 정상 표시
- 다른 기기에서 공유 링크 접근: 점수·직군 표시, 공유 뷰어 UI
- `curl -I` 로 OG 메타태그 확인 (`og:image`, `og:title`)

---

### Step 5: 공유 버튼 UI

**파일 (신규)**: `services/fint/src/components/report/ShareButtons.tsx`

```typescript
"use client";

interface ShareButtonsProps {
  sessionId: string;
  totalScore: number;
  summary?: string;
}
```

- **카카오톡 공유 버튼**: `window.Kakao?.Share?.sendDefault({...})` 호출
  - Kakao SDK 없으면 버튼 비활성화 또는 숨김 (graceful degradation)
- **링크 복사 버튼**: `navigator.clipboard.writeText(window.location.href)` + 토스트 "링크가 복사되었어요!"

카카오 payload:
```typescript
{
  objectType: "feed",
  content: {
    title: `내 면접 점수는 ${totalScore}점!`,
    description: "AI 모의면접 결과를 확인해보세요",
    imageUrl: `${origin}/api/og/report?sessionId=${sessionId}`,
    link: {
      mobileWebUrl: `${origin}/report/${sessionId}`,
      webUrl: `${origin}/report/${sessionId}`,
    },
  },
  buttons: [{ title: "결과 보기", link: { ... } }],
}
```

`ReportContent.tsx`의 하단 CTA 영역에 `<ShareButtons>` 추가.

**검증**: 공유 버튼 클릭 → 카카오 공유 시트 열림 / 클립보드에 URL 복사

---

### Step 6: Kakao SDK 초기화

**파일**: `services/fint/src/app/(interview)/layout.tsx` (수정)

`next/script`로 Kakao JS SDK lazy-load (report 페이지에서만 필요하므로 `(interview)` 그룹 레이아웃에 스코프):

```tsx
import Script from "next/script";

// (interview) layout에 추가
<Script
  src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
  integrity="sha384-TiCUE00h649CAMonG018J2ujOgDKW/kVWlChEuu4jK2vxfAAD0eZxzCKakxg55G4"
  crossOrigin="anonymous"
  strategy="lazyOnload"
  onLoad={() => {
    if (window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(process.env.NEXT_PUBLIC_KAKAO_JS_KEY);
    }
  }}
/>
```

**환경 변수 (신규)**:
- `NEXT_PUBLIC_KAKAO_JS_KEY` — Kakao 개발자 콘솔 JavaScript 키
- Vercel 환경 변수에 추가 필요

**Kakao 개발자 콘솔 설정**:
- 앱 생성 → JavaScript 키 발급
- 플랫폼 → 웹 → 도메인 등록 (개발: `http://localhost:3000`, 프로덕션: 실제 도메인)

**검증**: 브라우저 콘솔에서 `window.Kakao.isInitialized() === true`

---

### Step 7: TypeScript 타입 선언

**파일 (신규)**: `services/fint/src/types/kakao.d.ts`

```typescript
interface Window {
  Kakao?: {
    init: (appKey: string) => void;
    isInitialized: () => boolean;
    Share?: {
      sendDefault: (options: unknown) => void;
    };
  };
}
```

---

### Step 8: 테스트 작성

1. **`services/fint/tests/api/og-report.test.ts`** (신규)
   - 유효한 sessionId, is_public=true → ImageResponse 반환
   - is_public=false → fallback 이미지 반환
   - 잘못된 UUID → fallback 이미지 반환 (200 OK)
   - Cache-Control 헤더 포함

2. **`services/fint/src/components/report/__tests__/ShareButtons.test.tsx`** (신규)
   - 카카오 공유 버튼 클릭 → `window.Kakao.Share.sendDefault` 호출
   - 링크 복사 버튼 클릭 → `navigator.clipboard.writeText` 호출
   - Kakao SDK 없는 경우 graceful degradation

3. **`services/fint/src/components/report/__tests__/ReportContent.test.tsx`** (신규)
   - `initialReport` prop 전달 시 정상 렌더링
   - `isOwner=false` 시 exit dialog 없음, 공유 뷰어 CTA 표시
   - `isOwner=true` 시 기존 UI 표시
   - `initialReport=null` + sessionStorage 있으면 fallback 정상 동작

---

### Step 9: `.ai.md` 업데이트

**파일**: `services/fint/.ai.md`

Phase 1 SNS 공유 구현 내용 추가:
- 신규 파일 목록
- `is_public` 컬럼 및 RLS 정책
- Kakao SDK 초기화 방식
- 환경 변수 목록 (`NEXT_PUBLIC_KAKAO_JS_KEY`)

---

## 파일 변경 요약

| 작업 | 파일 |
|------|------|
| 신규 | `services/fint/supabase/migrations/20260325000000_add_reports_is_public.sql` |
| 수정 | `services/fint/src/app/api/interview/end/route.ts` |
| 신규 | `services/fint/src/app/api/og/report/route.tsx` |
| 전환 | `services/fint/src/app/(interview)/report/[sessionId]/page.tsx` |
| 신규 | `services/fint/src/components/report/ReportContent.tsx` |
| 신규 | `services/fint/src/components/report/ShareButtons.tsx` |
| 수정 | `services/fint/src/app/(interview)/layout.tsx` |
| 신규 | `services/fint/src/types/kakao.d.ts` |
| 신규 | `services/fint/tests/api/og-report.test.ts` |
| 신규 | `services/fint/src/components/report/__tests__/ShareButtons.test.tsx` |
| 신규 | `services/fint/src/components/report/__tests__/ReportContent.test.tsx` |
| 수정 | `services/fint/.ai.md` |

---

## 리스크 및 미해결 사항

| 리스크 | 완화 방법 |
|--------|----------|
| Kakao 개발자 앱 등록 미완료 | 버튼 UI는 앱 키 없이 구현. 키 발급 후 env 설정으로 활성화 |
| `end` route DB insert 실패 (non-fatal) | sessionStorage fallback 유지. 공유 기능만 제한 |
| `/api/og/` rate limit 미적용 | UUID 형식 검증 + Edge Cache로 반복 조회 차단 |
| interview_sessions.job_category 형식 | 쉼표 구분 문자열 → 그대로 OG 카드에 표시 |

---

## 검증 체크리스트

- [ ] `npm run build` — 0 errors
- [ ] `npm test` — 신규 테스트 포함 모두 PASS
- [ ] 카카오톡에서 리포트 URL 공유 시 점수·직군 포함된 OG 카드 표시
- [ ] 리포트 화면에 공유 버튼 표시 및 동작 확인
- [ ] 다른 기기(비로그인)에서 공유 링크 접근 → 리포트 내용 표시
- [ ] OG 카드에 Teal #0D9488 브랜딩 적용 확인
- [ ] `services/fint/.ai.md` 최신화 완료
