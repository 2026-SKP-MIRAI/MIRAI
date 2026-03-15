# [#87] feat: siw 전체 내비게이션 재설계 — 구현 계획

> 작성: 2026-03-13
> 디자인 레퍼런스: `docs/mirai-ui-preview.html` (레이아웃·구성·인터랙션 참조, 텍스트/이모지 제외)

---

## 완료 기준

- [x] **Sidebar** — 4탭, 접힘/펼침 (240px ↔ 68px), 하단 유저 정보
- [x] **대시보드** `/dashboard` — 통계 4카드 + 최근 면접 목록 + 퀵액션 패널
- [x] **내 이력서** `/resumes` — 이력서 카드 + 점선 추가 카드
- [x] **이력서 상세** `/resumes/[id]` — 원문 + 8축 점수 바 + 성장 요약 (MOCK, auth #89 후 실연동)
- [x] **면접 진입** `/interview/new` — 안내 배너 + 페르소나 선택 카드 + 시작 버튼
- [x] **면접 종료** — 헤더 버튼 → 모달 → sessionComplete=true → 이동
- [x] **ReportResult 리뉴얼** — 레이더 차트(총평 탭) + 개선점 탭 추가
- [x] **성장 추이** `/growth` — 차트 3종 + 축별 성장량 + AI 추천 + 강점/약점 패턴
- [x] `/resume` → `/resumes` 리다이렉트
- [x] **전체 인터랙션** — stagger 진입 + 카드 hover lift + 버튼 active scale + 점수 바 애니메이션

> **완료일**: 2026-03-13
> **테스트**: vitest 27케이스 신규 추가, 전체 통과

---

## 디자인 시스템

### 색상 토큰
```
violet  #7C3AED   bg: gray-100 (#F3F4F6)
indigo  #4F46E5   card: white/90 backdrop-blur-sm, border: black/[0.08]
text-primary: gray-900   text-body: gray-700   text-sub: gray-500   text-hint: gray-400
radius: 16px (rounded-2xl)   radius-sm: 8px (rounded-lg)
```

### 공통 컴포넌트 패턴
```
카드:          bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6
               hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200
버튼 primary:  bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-full px-5 py-2.5
               shadow-[0_4px_14px_rgba(124,58,237,0.35)] hover:-translate-y-px
               active:scale-[0.96] transition-all duration-200
버튼 secondary: bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 active:scale-[0.96]
버튼 link:     text-violet-600 font-semibold text-sm hover:underline (no bg)
태그:          rounded-full px-2.5 py-0.5 text-[11px] font-semibold
grad-text:     bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent
아이콘박스:    w-11 h-11 rounded-xl flex items-center justify-center
점수 바:       bg-gray-100 rounded-full h-2 overflow-hidden / fill: transition-[width] duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]
change-badge:  rounded-full px-2 py-0.5 text-[11px] font-bold
  positive → bg-emerald-100 text-emerald-800
  negative → bg-red-100 text-red-800
  neutral  → bg-gray-100 text-gray-600
```

---

## 인터랙션 구현 전략

### A. Stagger 진입 애니메이션 (Framer Motion)

```bash
npm install framer-motion
```

```tsx
const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22,1,0.36,1] } }
};

<motion.div variants={containerVariants} initial="hidden" animate="show">
  <motion.div variants={itemVariants}>...</motion.div>
</motion.div>
```

각 페이지 최상단에 적용. 카드·헤더·리스트 항목 등 `motion.div` 래핑.

### B. 카드 Hover Lift
```
hover:-translate-y-0.5 hover:shadow-[0_8px_28px_rgba(0,0,0,0.09)] transition-all duration-200 will-change-transform
```

### C. 버튼 Active Scale
```
active:scale-[0.96] active:transition-none
```

### D. 점수 바 마운트 애니메이션

```tsx
const [animated, setAnimated] = useState(false);
useEffect(() => { const t = setTimeout(() => setAnimated(true), 80); return () => clearTimeout(t); }, []);

<div className="h-full rounded-full transition-[width] duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]"
     style={{ width: animated ? `${score}%` : '0%' }} />
```

---

## 의존성 추가

```bash
# services/siw 에서
npm install framer-motion chart.js react-chartjs-2
```

---

## 실행 순서

### Phase 1 — Foundation (병렬 가능)

#### T1. Schema 수정
`prisma/schema.prisma` — `InterviewSession`에 추가:
```prisma
reportScores     Json?
reportTotalScore Int?
```
`prisma/migrations/20260313_add_report_scores/migration.sql`:
```sql
ALTER TABLE "interview_sessions"
  ADD COLUMN IF NOT EXISTS "reportScores" JSONB,
  ADD COLUMN IF NOT EXISTS "reportTotalScore" INTEGER;
```
> 스키마 변경은 이것뿐. 페르소나별 현황은 기존 `history` 필드에서 파생.

#### T2. 타입 추가
`src/lib/types.ts`:
```ts
export type GrowthSession = {
  id: string;
  createdAt: string;
  reportTotalScore: number;
  scores: AxisScores;
  resumeLabel: string;
};
```

#### T3. Repository 확장
`src/lib/interview/interview-repository.ts` 메서드 추가:
- `complete(id)` → sessionComplete=true, P2025 → `Error('session_not_found')`
- `saveReport(id, scores, totalScore)` → reportScores+reportTotalScore 저장
- `listCompleted()` → sessionComplete=true AND reportScores IS NOT NULL, createdAt desc

---

### Phase 2 — API Layer (T3 완료 후)

#### T4. Report generate 저장 연동
`src/app/api/report/generate/route.ts` — 엔진 응답 후 `saveReport()` best-effort 호출

#### T5. `PATCH /api/interview/[sessionId]/complete`
`src/app/api/interview/[sessionId]/complete/route.ts`
→ 200 `{ ok: true }`, 404 session_not_found, 멱등성

#### T6. `GET /api/growth/sessions`
`src/app/api/growth/sessions/route.ts`
→ `listCompleted()` → `GrowthSession[]`, resumeLabel: 첫 30자+"…"

---

### Phase 3 — 공통 UI 기반 (Phase 1과 병렬 가능)

#### T7. ReportResult 리뉴얼
`src/components/ReportResult.tsx`

기존 단순 목록 → **탭 2개 구조**로 확장:

```
[종합 점수 카드]  (그라데이션 bg, 큰 숫자, 등급 배지)
  그라데이션: bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-2xl p-8
  등급 배지: A(>=85) B(>=70) C(>=55) D(<55) — 반투명 흰 테두리 배지
  큰 점수: font-size 80px font-weight 900
  부제: "/ 100점" + "총 N턴 면접 완료"

[내부 탭 2개]
  배경 bg-gray-100 rounded-xl p-1
  탭: rounded-lg px-3 py-2 text-sm font-semibold transition
  활성: bg-white text-violet-600 shadow-sm
  비활성: text-gray-500

  [탭 1: 총평]
    2열 레이아웃 (레이더 차트 | 8축 점수 바)
      좌: <Radar> (chart.js) — violet fill 15%, violet border, 점 4px
          labels: ['의사소통', '문제해결', '논리적사고', '직무전문성', '조직적합성', '리더십', '창의성', '성실성']
          max 100, stepSize 20, grid rgba(0,0,0,0.07)
      우: 8축 점수 바 행들 (마운트 애니메이션)
          축명 90px | 바 | 점수 36px
    AI 피드백 박스
      bg-gray-50 rounded-xl p-5 border border-black/5 mt-4
      "AI 면접관 종합 피드백" 레이블 + summary 텍스트

  [탭 2: 개선점]
    axisFeedbacks에서 type="improvement" 필터링 → 개선 카드 목록
    각 카드: bg-gray-50 rounded-lg p-4 border border-black/6 mb-3
      순위 배지: 24x24 gradient rounded-md text-white font-bold
      축명 + 점수 태그 + 우선도 태그
      피드백 텍스트 text-sm text-gray-500

data-active 버그: axis-row div에 data-active="true" 추가 (이제 탭 구조로 대체되므로
  CSS가 달라질 수 있음 — 기존 .axis-row__desc 가시성 CSS 확인 후 처리)
```

#### T8. Sidebar 재설계
`src/components/Sidebar.tsx`

```
[로고] 32x32 gradient rounded-lg + "MirAI" 텍스트
[Nav 4탭]
  대시보드   /dashboard     LayoutDashboard   pathname==='/dashboard'
  내 이력서  /resumes       FileText          pathname.startsWith('/resumes')
  면접       /interview/new MessageSquare     pathname.startsWith('/interview/')
  성장 추이  /growth        TrendingUp        pathname==='/growth'
[flex-1]
[유저 영역]
  32x32 gradient 아바타(이름 첫글자) | 이름 | 이메일
  로그아웃 버튼 (text-gray-400 hover:bg-gray-100)
[접기 버튼] absolute -right-3.5 top-20 원형 28x28 shadow border
```

접힘 상태 (`collapsed` useState):
- `transition-[width] duration-200` → `w-60` / `w-[68px]`
- 텍스트: `transition-opacity duration-150 opacity-0 w-0 overflow-hidden`
- 접기 버튼 텍스트: `‹` / `›`
- 모바일: fixed + translate-x-[-100%], 열림 시 translate-x-0 + 오버레이

활성 스타일:
```
활성: bg-gradient-to-br from-violet-50 to-indigo-50 text-violet-700 font-semibold
비활성: text-gray-500 hover:text-gray-900 hover:bg-black/5
공통: rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-sm transition-all mx-2
```

NAV_COMING 섹션 완전 제거.

#### T9. `/resume` 리다이렉트
`src/app/(app)/resume/page.tsx` → `redirect('/resumes')`

---

### Phase 4 — 신규 / 업그레이드 페이지 (Phase 2+3 완료 후)

#### T10. `/resumes` 업그레이드
`src/app/(app)/resumes/page.tsx`

```
[페이지 헤더] "내 이력서" + 부제 + [수정] btn-secondary-sm
[이력서 카드]  (motion.div stagger)
  좌: 아이콘박스 56x56 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 FileText 아이콘
  우: 이름 + 날짜 + [활성] tag-green
      미리보기: bg-gray-50 rounded-lg p-3 text-xs text-gray-500 border 1줄 truncate
      버튼: [내용 보기 →] secondary-sm → /resumes/{id}
            [이 이력서로 면접] primary-sm → /interview/new?resumeId={id}
[점선 추가 카드]
  border-2 border-dashed border-gray-200 bg-transparent text-center py-10
  아이콘 + "새 이력서 추가" + 안내 + [이력서 업로드] primary
  → showUpload 토글 → <UploadForm /> 인라인
```

#### T11. 신규: `/resumes/[id]`
`src/app/(app)/resumes/[id]/page.tsx`

```
[뒤로가기] "← 내 이력서" → /resumes
[페이지 헤더]
  "내 이력서" + [분석 완료] tag-green + 날짜
  버튼: [수정] secondary | [면접 시작 →] primary → /interview/new?resumeId={id}

[이력서 원문 카드]
  헤더: "이력서 원문" + [원문] tag-gray
  내용: bg-gray-50 rounded-xl p-5 text-sm leading-[1.9] whitespace-pre-wrap font-mono border

[8축 역량 평가 카드]  ← mock (auth 구현 후 resumeId 연결 시 실제 데이터로 교체)
  헤더: "8축 역량 평가" + [준비 중] tag-gray
  안내 문구: "면접 기록 연동은 로그인 기능 구현 후 제공될 예정입니다."
  8개 점수 바 행: 빈 상태 (0%) 또는 회색 표시

[성장 요약 카드]  ← mock (동일 사유)
  헤더: "성장 요약"
  안내 문구: "로그인 기능 구현 후 이 이력서로 진행한 면접 기록이 연동됩니다."
```

> `/api/resumes/[id]` 는 mock 유지 (Issue #89 범위). 현재 ResumeSession에서 id로 조회.

#### T12. `/interview/new`
`src/app/(app)/interview/new/page.tsx`

```
[페이지 헤더] "면접 시작하기" + "페르소나를 선택하고 AI 면접을 시작하세요"

[안내 배너]
  bg-violet-50 border-1.5 border-violet-200 rounded-lg p-4 text-sm
  "AI 면접관 안내: 이력서 기반 맞춤 질문 + 8축 평가 기준"

[섹션 타이틀] "면접관 페르소나 선택"

[페르소나 카드 3열]  ← selectedPersona state
  HR 담당자:  emerald 아이콘박스 | [HR] tag-green   | 소프트스킬·팀워크 | 난이도: 보통
  기술 팀장:  blue 아이콘박스   | [기술] tag-blue  | 기술깊이·논리검증 | 난이도: 높음
  경영진:     purple 아이콘박스 | [경영진] tag-purple | 비즈니스·ROI    | 난이도: 매우 높음

  비선택: border-2 border-transparent hover:border-violet-200 hover:-translate-y-0.5
  선택:   border-2 border-violet-600 shadow-[0_0_0_3px_rgba(124,58,237,0.1)]

[선택된 이력서 확인 박스]
  border-1.5 border-violet-200 bg-violet-50 rounded-2xl p-5
  "선택된 이력서" + resumeLabel + [이력서 변경] btn-link → /resumes

[시작 버튼] full-width primary
  미선택: disabled "페르소나를 선택해주세요"
  선택:   "면접 시작하기 →"
  클릭: POST /api/interview/start, personas: ["hr","tech_lead","executive"] → /interview/{id}

?resumeId=xxx → 이력서 단계 스킵
```

#### T13. 면접 종료 버튼 + 모달
`src/app/(app)/interview/[sessionId]/page.tsx`

헤더에 [면접 종료] 추가:
```
border border-gray-200 text-gray-600 rounded-full px-4 py-1.5 text-sm hover:bg-gray-50 active:scale-95
```

모달 (`showExitModal`):
```
fixed inset-0 bg-black/40 flex items-center justify-center z-50
  bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl
  제목: "면접을 종료하시겠어요?"
  내용:
    history >= 5: "충분한 답변이 있어 리포트를 생성할 수 있습니다."
    history < 5: "아직 답변이 {n}개입니다. 리포트는 5개 이상 답변이 필요합니다."
  [계속하기] secondary | [종료하기] primary
  종료: PATCH /complete → history>=5 → /report, else → /dashboard
```

"다시 하기" 버튼: `/resume` → `/interview/new`

#### T14. `/dashboard`
`src/app/(app)/dashboard/page.tsx`

```
[인사 헤더] (motion.div)
  "안녕하세요, [이름]님" — 이름 부분 grad-text
  "오늘도 한 걸음 더 성장하세요."

[통계 4카드] grid-cols-4 gap-4  (각 motion.div)
  1. 총 면접 횟수:  violet 아이콘박스 | grad-text 숫자 | "총 면접 횟수" | "누적"
  2. 평균 점수:     indigo 아이콘박스 | indigo "XX점" | "평균 점수" | "8축 기준"
  3. 업로드 이력서: cyan 아이콘박스   | cyan 숫자 | "업로드 이력서" | "저장됨"
  4. 성장률:        emerald 아이콘박스 | emerald "+XX%" (최근 vs 직전) | "성장률" | "최근 비교"

[메인 2열] grid-cols-[1fr_320px]
  좌: 최근 면접 기록 카드
    헤더: "최근 면접 기록" + [전체 보기→] /growth
    각 행: (motion.div stagger)
      점수 원형 44px (>=80: emerald, >=70: blue, <70: violet)
      N번째 면접 + 날짜 hint
      [결과 보기→] btn-link → /interview/{id}/report
    최대 5개, 빈 상태 처리

  우: 퀵 액션
    카드1: bg-gradient-to-br from-violet-600 to-violet-700 shadow-violet rounded-2xl p-5 mb-3
           "이력서 관리" + 설명 + [이력서 보기→] 반투명 버튼
    카드2: bg-gradient-to-br from-indigo-600 to-indigo-700 shadow-indigo rounded-2xl p-5 mb-3
           "면접 시작하기" + 설명 + [면접 시작→] 반투명 버튼
    카드3: 일반 카드 "최근 분석 요약"
           강점: 가장 높은 점수 축명 + 점수
           개선: 가장 낮은 점수 축명 + 점수
           세션 없으면: "면접을 완료하면 표시됩니다"
```

#### T15. `/growth`
`src/app/(app)/growth/page.tsx`

```
[페이지 헤더] "성장 추이" + "면접 실력이 얼마나 성장했는지 확인하세요"

[통계 2카드] grid-cols-2
  1. 총 면접 횟수: grad-text 큰 숫자
  2. 최신 점수:    emerald 숫자 + change-badge (+N점 향상 / -N점 하락)

[종합 점수 추이]  <Line> chart.js h-[200px]
  dataset[0]: 회차별 totalScore, violet gradient fill, tension 0.4, pointRadius 5
  dataset[1]: 70점 목표선, emerald dashed, pointRadius 0
  y: 40~100, ticks "XX점", x grid off

[8축 역량 비교]  <Bar> chart.js h-[240px]
  dataset[0]: 최신 8축, indigo #4F46E5, borderRadius 4
  dataset[1]: 직전 8축, violet-200 #C4B5FD, borderRadius 4
  범례: "현재" | "이전" (custom legend inline)
  세션 1개: dataset[1] 제외

[축별 성장량 카드]
  각 행: 축명 | "이전→현재" text-hint | change-badge
  세션 1개: 현재 점수만 표시

[AI 개선 추천 카드]
  최신 세션 하위 3개 축 기준
  각 항목: 빨간/주황 dot + 축명+점수 + 개선 문구

[하단 2열]
  좌: 강점 & 약점 패턴  (reportScores 여러 세션 분석)
    꾸준한 강점: 전 세션 평균 상위 3개 축 (dot-green)
    반복 약점:   전 세션 평균 하위 2개 축 (dot-yellow)
    세션 1개: "더 많은 면접을 완료하면 패턴이 분석됩니다"

[세션 선택 목록]  (하단)
  각 항목: 날짜 + resumeLabel + totalScore
  클릭 → selectedSession state → 8축 점수 바 패널 표시
  [리포트 보기→] /interview/{id}/report

[빈 상태]
  "면접을 완료하면 성장 추이가 여기에 표시됩니다" + [면접 시작하기] → /interview/new
```

---

### Phase 5 — 테스트

| 파일 | 케이스 |
|---|---|
| `tests/ui/report-result.test.tsx` (수정) | 탭 전환, 레이더 차트 렌더, 개선점 카드 |
| `tests/api/interview-complete-route.test.ts` | 200, 404, 멱등성 |
| `tests/api/growth-sessions-route.test.ts` | 목록, 빈 배열, resumeLabel 30자 |
| `tests/ui/interview-new-page.test.tsx` | 페르소나 선택 → 버튼 활성화, API 호출 |
| `tests/ui/interview-session-exit.test.tsx` | 모달 표시/닫기, history 분기 |
| `tests/ui/growth-page.test.tsx` | 차트 렌더, 세션 선택, 강점/약점 패턴 |
| `tests/ui/dashboard-page.test.tsx` | 통계 카드, 빈 상태 |
| `tests/ui/resumes-detail-page.test.tsx` | 원문 표시, 점수 바, 성장 요약 |

---

### Phase 6 — 문서

`services/siw/.ai.md` 최신화

---

### Phase 7 — 세션 후 UI/UX 개선 (2026-03-13 추가)

#### T16. 대시보드 UI 개선
- 통계 카드 `●` 불릿 → Lucide 아이콘 (`MessageSquare`, `TrendingUp`, `FileText`, `BarChart2`)
- 퀵 액션 카드: 그라데이션 배경 → 흰 배경 + violet/indigo 테두리 (`border-violet-200`, `border-indigo-200`)

#### T17. `/interview/new` 페르소나 UI 수정
- 페르소나 선택 제거 → 3 페르소나 항상 전원 참여 (정보 카드로 전환)
- 카드를 `<button>` → `<div>` 변경, 선택 상태 state 제거
- `selectedPersona` 조건 → `!selectedResumeId` 조건으로 시작 버튼 disabled 변경
- 페르소나 카드에 Lucide 아이콘 추가 (`Users`, `Code2`, `Briefcase`)
- 항상 `personas: ["hr", "tech_lead", "executive"]` 전송

#### T18. 랜딩 페이지 개선
- "무료로 시작하기" 버튼 href: `/resume` → `/dashboard`
- nav 로고에서 별 SVG (`<path d="M9 1...">`) 제거, `<span>MirAI</span>`만 유지

#### T19. Sidebar 로고 수정
- 로고 `<div>M</div>` 그라데이션 박스 완전 제거
- 로고를 `<Link href="/">` 로 감싸고 그라데이션 텍스트 "MirAI"만 표시

#### T20. 이력서 분석 플로우 수정
- `UploadForm` `onComplete` 핸들러: 결과 페이지 대신 `/interview/new?resumeId={id}` 로 라우팅
- `/resumes` 페이지에서 업로드 완료 시 면접 시작 페이지로 자연스럽게 연결

#### T21. `/api/resumes` 실DB 연동
- Mock 데이터 제거 → `resumeRepository.listAll()` 실제 DB 조회
- `resumeRepository`에 `listAll()` 메서드 추가 (`resumeSession.findMany`)

#### T22. Prisma 워크트리 자동화
- `package.json` scripts에 `"postinstall": "prisma generate"` 추가
- 신규 워크트리 `npm install` 시 `.prisma/client` 자동 생성

#### T23. PDF 파서 모듈 레벨 수정
- `pdf-parser.ts`: `require("pdf-parse")`를 함수 내부 → 모듈 최상단으로 이동
- Next.js webpack `serverExternalPackages: ["pdf-parse"]` 동작과 호환

#### T24. 레이아웃 max-w 통일 (max-w-5xl)
- 모든 앱 페이지에 `max-w-5xl` 적용:
  - `/interview/[sessionId]/report` (max-w-3xl → max-w-5xl)
  - `/resumes` (max-w-3xl → max-w-5xl)
  - `/resumes/[id]` (max-w-3xl → max-w-5xl)
  - `/interview/new` (max-w-3xl → max-w-5xl)
  - `/interview/[sessionId]` (max-w-3xl → max-w-5xl)
  - `/growth` (max-w-4xl → max-w-5xl)

#### T25. ReportResult 랜딩 디자인 적용
- 기존 단순 바 → `axis-row` + `score-grid-wrapper` CSS 클래스 사용 (랜딩 페이지 동일 디자인)
- hover 시 해당 axis 하이라이트, 비활성 dimming
- **클릭 토글**: 기본 1줄 미리보기(`line-clamp-1`) → 클릭 시 `maxHeight: none`으로 전체 피드백 텍스트 표시
- 레이더 차트 크기 확대 (`max-w-[420px]`)
- **개선점 탭 개편**: "잘한 점" (emerald, 최대 5개) + "개선할 점" (amber/violet, 최대 5개) 두 섹션으로 분리

#### T26. 테스트 수정
- `tests/ui/report-result.test.tsx`: `getByText("76")` → `getAllByText("76").length > 0` (score-grid 이중 표시 대응)

---

## 생성/수정 파일 목록

### 신규 (13개)
```
prisma/migrations/20260313_add_report_scores/migration.sql
src/app/api/interview/[sessionId]/complete/route.ts
src/app/api/growth/sessions/route.ts
src/app/(app)/dashboard/page.tsx
src/app/(app)/resumes/[id]/page.tsx               ← 이력서 상세 (신규)
src/app/(app)/interview/new/page.tsx
src/app/(app)/growth/page.tsx
tests/api/interview-complete-route.test.ts
tests/api/growth-sessions-route.test.ts
tests/ui/interview-new-page.test.tsx
tests/ui/interview-session-exit.test.tsx
tests/ui/growth-page.test.tsx
tests/ui/dashboard-page.test.tsx
tests/ui/resumes-detail-page.test.tsx             ← 신규
```

### 수정 (11개)
```
package.json                                       ← framer-motion, chart.js, react-chartjs-2
prisma/schema.prisma
src/lib/types.ts
src/lib/interview/interview-repository.ts
src/app/api/report/generate/route.ts
src/components/Sidebar.tsx
src/components/ReportResult.tsx                    ← 탭 2개 + 레이더 차트 + 개선점 탭
src/app/(app)/resume/page.tsx
src/app/(app)/resumes/page.tsx
src/app/(app)/interview/[sessionId]/page.tsx
tests/ui/report-result.test.tsx
services/siw/.ai.md
```

*모든 경로는 `services/siw/` 기준*

---

## 스키마 변경 요약

| 변경 | 이유 |
|---|---|
| `InterviewSession.reportScores Json?` 추가 | 8축 점수 저장 (성장 추이용) |
| `InterviewSession.reportTotalScore Int?` 추가 | 총점 저장 (대시보드 통계용) |

---

## 검증 체크리스트

```
[ ] npm install 완료 (framer-motion, chart.js, react-chartjs-2)
[ ] npx prisma migrate dev 성공
[ ] /dashboard — 통계 4카드 + 인터랙션 확인
[ ] /resumes — 카드 목록 + 점선 추가 카드
[ ] /resumes/[id] — 원문 + 8축 바 + 성장 요약
[ ] /interview/new — 페르소나 선택 border 인터랙션
[ ] 면접 종료 버튼 → 모달 → 이동
[ ] ReportResult — 탭 전환 + 레이더 차트 + 개선점 탭
[ ] /growth — 차트 3종 + 페르소나별 현황 + 강점/약점 패턴
[ ] Sidebar 접힘/펼침 240↔68px
[ ] 카드 stagger 진입 애니메이션
[ ] 카드 hover lift (-2px)
[ ] 버튼 active scale (0.96)
[ ] 점수 바 마운트 애니메이션 (0→실제값)
[ ] /resume → /resumes 리다이렉트
[x] pnpm test 전체 통과 (79/79)
```

---

## Phase 8 — Critical/Warning 이슈 수정 (2026-03-13)

> 3인 팀 리뷰(code-reviewer, 서버 전문가, 아키텍처 전문가) 결과 도출된 이슈 수정

### 수정 목록

#### C1. 반응형 레이아웃 (`/dashboard`)
- **파일**: `src/app/(app)/dashboard/page.tsx`
- **문제**: 통계 그리드 `grid-cols-4` 하드코딩 → 모바일에서 카드 찌그러짐
- **수정**: `grid-cols-2 md:grid-cols-4`로 변경
- **추가**: 메인 2컬럼 레이아웃도 `style={{ gridTemplateColumns: "1fr 320px" }}` → `className="grid grid-cols-1 lg:grid-cols-[1fr_320px]"` (Tailwind arbitrary value)

#### C2. JSON.parse 크래시 방지 (`/interview/[sessionId]`)
- **파일**: `src/app/(app)/interview/[sessionId]/page.tsx`
- **문제**: `sessionStorage`에서 읽은 값을 `JSON.parse()` 직접 호출 → 손상된 캐시 시 앱 크래시
- **수정**: try-catch로 감싸고 파싱 실패 시 무시 (기존 question 유지)

#### C3. 이력서 단건 API 신규 생성
- **파일 (신규)**: `src/app/api/resumes/[id]/route.ts`
- **파일 (수정)**: `src/lib/resume-repository.ts` — `findDetailById()` 메서드 추가
- **파일 (수정)**: `src/app/(app)/resumes/[id]/page.tsx` — fetch URL `/api/resumes` → `/api/resumes/${id}`
- **문제**: 이력서 상세 페이지가 전체 목록 API(`/api/resumes`)를 호출 후 id로 필터링하던 구조 → 단건 조회 불가, 404 처리 불가
- **수정**: `GET /api/resumes/[id]` 엔드포인트 신규 생성, `ResumeSession.findUniqueOrThrow`로 단건 조회

#### W8. 면접 시작 실패 시 에러 피드백 (`/interview/new`)
- **파일**: `src/app/(app)/interview/new/page.tsx`
- **문제**: `POST /api/interview/start` 실패 시 사용자에게 아무 피드백 없음
- **수정**: `startError` state 추가, API 실패 시 에러 메시지 표시 (시작 버튼 위 빨간 텍스트)

#### W9. Prisma 싱글톤 패턴 적용
- **파일 (신규)**: `src/lib/prisma.ts`
- **파일 (수정)**: `src/lib/interview/interview-repository.ts`
- **파일 (수정)**: `src/lib/resume-repository.ts`
- **문제**: 각 repository 파일에서 `new PrismaClient()` 직접 생성 → HMR 환경에서 연결 풀 고갈
- **수정**: `globalThis` 기반 싱글톤 `prisma.ts` 모듈 생성, 모든 repository에서 공유 import

#### W10. saveReport 재시도 로직 추가
- **파일**: `src/app/api/report/generate/route.ts`
- **문제**: `saveReport` 저장 실패 시 로그만 남기고 재시도 없음
- **수정**: 실패 시 2초 후 1회 재시도 (`saveWithRetry` async 함수), fire-and-forget 유지

#### W11. (확인 완료 — 수정 불필요)
- migration 파일이 이미 존재함: `prisma/migrations/20250310000000_add_report_scores/migration.sql`

### 테스트 수정

| 파일 | 변경 내용 |
|------|----------|
| `tests/ui/report-result.test.tsx` | `getByText("76")` → `getAllByText("76").length > 0` (점수가 2곳에 렌더링됨) |
| `tests/ui/resumes-detail-page.test.tsx` | fetch mock을 배열 → 단건 객체로 변경 (`/api/resumes/${id}` 응답 형식 반영) |

### 최종 테스트 결과

```
Test Files  18 passed (18)
Tests       79 passed (79)
Duration    4.38s
```
