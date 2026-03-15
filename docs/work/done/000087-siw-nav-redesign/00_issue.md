# feat: siw 전체 내비게이션 재설계 — 대시보드·내 이력서·면접·성장 추이 4탭 구조 (siw)

## 사용자 관점 목표

사이드바 4탭 구조(대시보드·내 이력서·면접·성장 추이)로 서비스 전체를 일관된 내비게이션으로 연결한다. 각 탭은 독립적인 목적을 가지며, 면접 탭에서는 자소서 선택 → 모드 선택 → 페르소나 확인 → 바로 시작하는 흐름이 완성된다. 면접 도중 언제든 종료할 수 있다.

## 배경

- 현재 Sidebar: "내 자소서"·"면접 시작" 활성, 나머지 3개 disabled — 구조가 기능 중심이 아닌 동선 중심으로 재편 필요
- 기능01(이력서 분석)·기능03·04(패널 면접)·기능05(연습 모드)·기능07(8축 리포트) 모두 구현됐거나 구현 예정 → 한 내비게이션 아래 통합할 시점
- 이슈 #86(연습 모드 피드백 루프)과 연계: 면접 진입 페이지가 모드 선택 UI를 담당
- **면접 종료 버튼 없음**: 현재 `sessionComplete=true` 될 때까지 나갈 방법이 없음. 브라우저 뒤로가기 시 세션이 DB에 미완료 상태로 남고, history < 5개면 리포트 422 에러 발생
- **8축 리포트 피드백 텍스트 미표시 버그**: `axis-row__desc`가 CSS에서 기본 `opacity: 0` + `max-height: 0`으로 숨겨져 있고, `data-active="true"` 시에만 표시되도록 설계되어 있으나 `ReportResult.tsx`의 `axis-row` div에 `data-active` 속성이 없어 피드백 텍스트가 항상 숨겨짐

## 완료 기준

- [x] **Sidebar** — 4탭(대시보드·내 이력서·면접·성장 추이) + 각 아이콘, 활성 상태 표시
- [x] **대시보드** `/dashboard` — 최근 면접 요약 카드, 이력서 목록 미리보기, 성장 추이 스냅샷 섹션 3개
- [x] **내 이력서** `/resumes` — 자소서 카드 목록, 카드 클릭 → 해당 자소서 기능01 분석 결과 표시
- [x] **면접 진입 페이지** `/interview/new` — ① 자소서 선택(목록) ② 모드 선택(실전/연습 카드) ③ 페르소나 소개(HR·기술팀장·경영진) ④ 시작 버튼
- [x] **면접 종료 버튼** — 헤더에 "면접 종료" 버튼, 클릭 시 확인 모달 → 확인 시 `sessionComplete=true` 강제 저장 후 리포트 or 대시보드 이동
- [x] **ReportResult.tsx 리뉴얼** — Chart.js Radar 차트(총평 탭) + 개선점 탭(잘한 점/개선할 점) + 점수 바 클릭 토글 확장, 피드백 텍스트 항상 표시
- [x] **성장 추이** `/growth` — 과거 면접 세션 목록, 세션 선택 → 8축 점수 바 + 날짜별 총점 라인 그래프
- [x] 기존 `/resume`(업로드 단독 페이지) → **내 이력서 탭 내 "새 이력서 업로드"** 플로우로 흡수 + `/resume` → `/resumes` redirect
- [x] 기존 `interview/[sessionId]` 세션 페이지·리포트 페이지 — 내비게이션 경로 변경 없이 유지

## 구현 플랜

### Step 1 — Sidebar 4탭 재구성 (`src/components/Sidebar.tsx`)

```
NAV_MAIN:
  - 대시보드       /dashboard     LayoutDashboard
  - 내 이력서      /resumes       FileText
  - 면접          /interview/new  MessageSquare
  - 성장 추이      /growth        TrendingUp
```

- 기존 "내 자소서·면접 시작" 제거, "준비 중" 섹션 제거
- 각 탭 active 스타일 유지 (pathname startsWith 매칭)

---

### Step 2 — ReportResult.tsx 버그 수정 (`src/components/ReportResult.tsx`)

```tsx
// Before
<div key={item.axis} className="axis-row">

// After
<div key={item.axis} className="axis-row" data-active="true">
```

- `axis-row__desc` CSS: 기본 `opacity: 0` / `max-height: 0`, `data-active="true"` 시에만 표시
- 리포트 화면에서는 인터랙션 없이 항상 표시해야 하므로 `data-active="true"` 고정

---

### Step 3 — 대시보드 `/dashboard` (`src/app/(app)/dashboard/page.tsx`)

**레이아웃 (3섹션 수직 배치):**

```
┌─────────────────────────────────┐
│  최근 면접                        │
│  [세션카드] [세션카드] ...           │  → /interview/[sessionId]/report
├─────────────────────────────────┤
│  내 이력서                         │
│  [자소서 카드] [자소서 카드] ...      │  → /resumes
├─────────────────────────────────┤
│  성장 추이 미리보기                   │
│  총점 라인 미니 그래프                │  → /growth
└─────────────────────────────────┘
```

- 데이터: 현재는 mock (Prisma InterviewSession 조회 — sessionComplete=true 최근 5개)
- 면접 세션이 없을 때 빈 상태 UI ("아직 면접 기록이 없어요. 면접을 시작해 보세요!")
- 각 섹션 우측 "전체 보기 →" 링크

---

### Step 4 — 내 이력서 `/resumes` 개편 (`src/app/(app)/resumes/page.tsx`)

```
┌──────────────────────────────────────┐
│  내 이력서                  [+ 새 이력서] │
└──────────────────────────────────────┘
[이력서 카드]  [이력서 카드]  ...

카드 클릭 시:
  → 해당 이력서 기능01 분석 결과(질문 목록) 슬라이드 패널 또는 별도 페이지
  → "이 이력서로 면접 시작" 버튼 → /interview/new?resumeId=xxx
```

- **"+ 새 이력서"** 버튼 클릭 → UploadForm 인라인 표시 (현재 /resume 페이지 로직 흡수)
- 저장 방식: 현재 mock 유지, Supabase Storage 연동은 별도 이슈(#89)

---

### Step 5 — 면접 진입 페이지 `/interview/new` (`src/app/(app)/interview/new/page.tsx`)

#### 섹션 1 — 자소서 선택
```
[이력서 카드]  [이력서 카드]  ...  ← 클릭으로 선택, border 강조
[+ 새 자소서 업로드]
```

#### 섹션 2 — 모드 선택 (자소서 선택 후 활성화)
```
┌───────────────────┐  ┌───────────────────┐
│   실전 모드         │  │   연습 모드          │
│  세션 중 피드백 없음  │  │  답변 후 즉각 피드백  │
│  종료 후 8축 리포트  │  │  재답변으로 반복 훈련  │
└───────────────────┘  └───────────────────┘
```

#### 섹션 3 — 페르소나 소개 (모드 선택 후 표시)
```
[HR 담당자]  [기술팀장]  [경영진]
```

[면접 시작하기] → 자소서·모드 모두 선택 시 활성화

---

### Step 6 — 면접 종료 버튼 (`/interview/[sessionId]/page.tsx`)

```
헤더: MirAI  [면접 진행 중]  [면접 종료 버튼]

클릭 →
  확인 모달
    history < 5:  "답변이 5개 미만이면 리포트를 생성할 수 없습니다."
    history >= 5: "지금까지의 답변으로 리포트를 생성할 수 있습니다."
  종료 확인 →
    PATCH /api/interview/[sessionId]/complete (sessionComplete=true 강제 저장)
    history >= 5 → /interview/[sessionId]/report
    history < 5  → /dashboard
```

**`PATCH /api/interview/[sessionId]/complete` 신규 route:**
- `Prisma InterviewSession.update({ sessionComplete: true })`
- 이미 complete인 세션도 200 반환 (idempotent)

---

### Step 7 — 성장 추이 `/growth` (`src/app/(app)/growth/page.tsx`)

```
┌────────────────────┐  ┌─────────────────────────────┐
│  면접 기록           │  │  8축 레이더 차트               │
│  [세션] 선택됨       │  │  날짜별 총점 라인 그래프         │
│  [세션]             │  │  총점: 76점                  │
└────────────────────┘  │  [리포트 전체 보기 →]           │
                        └─────────────────────────────┘
```

- 세션 목록: `sessionComplete=true`, `orderBy: createdAt desc`
- 라인 그래프: 세션 1개면 점만, 2개 이상이면 성장 곡선

---

### Step 8 — 라우팅 정리

| 기존 경로 | 변경 후 | 비고 |
|----------|--------|------|
| `/resume` | `/resumes` 내 업로드 인라인 | redirect 처리 |
| `/resumes` | `/resumes` (개편) | 유지 |
| `/interview/[sessionId]` | 유지 | 변경 없음 |
| `/interview/[sessionId]/report` | 유지 | 변경 없음 |
| (신규) `/interview/new` | 면접 진입 페이지 | 신규 |
| (신규) `/interview/[sessionId]/complete` | 면접 강제 종료 PATCH | 신규 |
| (신규) `/dashboard` | 대시보드 | 신규 |
| (신규) `/growth` | 성장 추이 | 신규 |

---

### Step 9 — 테스트

- `tests/ui/report-result.test.tsx`: `data-active="true"` 로 피드백 텍스트 표시 케이스 추가
- `tests/api/interview-complete-route.test.ts`: PATCH 200(정상)/200(idempotent)/404
- `tests/ui/interview-session-page.test.tsx`: 종료 버튼 → 모달 → history<5 경고 문구
- `tests/ui/interview-new-page.test.tsx`: 자소서·모드 선택 활성화 흐름
- `tests/ui/growth-page.test.tsx`: 세션 목록 렌더링 + 빈 상태 UI

## 의존성

- 이슈 #86 (연습 모드 피드백 루프)
- 이슈 #88 (Auth) — userId 기반 세션 조회
- 이슈 #89 (이력서 저장) — 실 이력서 목록 연동

## 개발 체크리스트

- [ ] 테스트 코드 포함
- [ ] `services/siw/.ai.md` 최신화
- [ ] 불변식 위반 없음
- [ ] 기존 `/interview/[sessionId]` 및 리포트 페이지 회귀 없음 확인

---

## 작업 내역

### Phase 1–6: 내비게이션 재설계 핵심 구현

**Sidebar.tsx** — 4탭(대시보드/내 이력서/면접/성장 추이) 재설계. 접기 토글(240px↔68px), 모바일 오버레이, 활성 상태 pathname 매칭.

**신규 페이지 3종**
- `/dashboard` — 통계 4카드 + 최근 면접 세션 목록 + 이력서 카드 + 성장 추이 SVG 스냅샷. framer-motion stagger 진입 애니메이션.
- `/interview/new` — 3단계 Client Component (이력서 선택 → 모드 선택 → 시작). `?resumeId` 파라미터 시 이력서 단계 skip. 시작 실패 시 에러 메시지 표시.
- `/growth` — 완료 세션 목록 + 세션 선택 시 8축 점수 바 + 날짜별 총점 Line 차트.

**신규 API 2종**
- `PATCH /api/interview/[sessionId]/complete` — sessionComplete=true 강제 저장, 멱등성 보장, P2025 → 404.
- `GET /api/growth/sessions` — sessionComplete=true AND reportScores IS NOT NULL 세션 목록 반환 (GrowthSession[]).

**기존 페이지 수정**
- `/interview/[sessionId]` — 헤더에 "면접 종료" 버튼 + 확인 모달 (history ≥5: 리포트 이동, <5: 대시보드 이동). JSON.parse sessionStorage 크래시 방지 try-catch 추가.
- `/resumes` — 업로드 플로우 인라인 흡수 (showUpload 토글). 이력서 카드에 "내용 보기" + "면접 시작" 버튼.
- `/resume/page.tsx` — `redirect('/resumes')` Server Component로 교체.

**ReportResult.tsx 리뉴얼** — Chart.js Radar(총평 탭) + 개선점 탭(잘한 점/개선할 점 분리). 점수 바 클릭 시 피드백 텍스트 토글 확장 (`maxHeight: none` inline 오버라이드). grade badge (S/A/B/C/D).

**Prisma 스키마** — `InterviewSession`에 `reportScores Json?`, `reportTotalScore Int?` 추가 (additive migration).

**report/generate/route.ts** — 엔진 응답 후 best-effort saveReport + 2초 딜레이 1회 재시도.

### Phase 7–8: UI/UX 개선 및 Critical/Warning 이슈 수정

**C1 반응형 레이아웃** — 대시보드 통계 그리드 `grid-cols-2 md:grid-cols-4`, 메인 레이아웃 `grid-cols-1 lg:grid-cols-[1fr_320px]` (Tailwind arbitrary value).

**C2 JSON.parse 방어** — `sessionStorage` 캐시 파싱 실패 시 try-catch로 크래시 방지.

**C3 이력서 단건 API** — `GET /api/resumes/[id]` 신규 생성. `resume-repository.findDetailById()` 추가. 상세 페이지 fetch URL `/api/resumes` → `/api/resumes/${id}` 변경.

**W8 면접 시작 에러 피드백** — `startError` state 추가, API 실패 시 빨간 메시지 표시.

**W9 Prisma 싱글톤** — `src/lib/prisma.ts` 신규 생성 (`globalThis` 패턴). 모든 repository가 공유 인스턴스 사용 (HMR 연결 풀 고갈 방지).

**W10 saveReport 재시도** — 저장 실패 시 2초 후 1회 재시도 fire-and-forget.

### 테스트

신규 27케이스 추가 (API 8 + UI 19), 기존 테스트 수정 2건 (report-result, resumes-detail-page). **최종 전체 79/79 통과 (18 파일)**.

