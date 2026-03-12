# Issue #63 — siw 디자인 시스템 적용 플랜

> 작성: 2026-03-11
> **구현 도구**: `~/.claude/skills/ui-ux-pro-max` 스킬 사용
> **원칙**: 로직·API·data-testid 변경 없음. className(스타일)만 추가/교체.
> **작업 경로**: `.worktree/000063-siw-pretendard-glassmorphism/services/siw/`

---

## 완료 기준

- [x] Tailwind v4 설치 및 postcss 설정 완료
- [x] globals.css — Pretendard + shadcn 호환 디자인 시스템 구축
  - shadcn 호환 CSS 변수 (`:root`), `@theme inline` Tailwind v4 색상 매핑
  - Pretendard `@import url()` — `<link>` 태그 없이 CSS에서 직접 로드
  - glass-card / glass-card-hover / glass-panel / glass-card-dark
  - gradient-text / gradient-text-cyan / btn-primary / btn-outline
  - tag variants / input-dark / gauge / skeleton / animations
  - layered-card-wrapper / lc-layer-* (3중 레이어 카드 CSS)
  - score-grid-wrapper / axis-row / axis-row__* (8축 점수 그리드 CSS)
  - bg-grid / dot-grid / fadeInUp / card-3d / pulse-ring / shimmer
- [x] glass-card glassmorphism 효과 (backdrop-blur) 동작
- [x] gradient-text MirAI 로고 렌더링
- [x] btn-primary 그라디언트 버튼 적용
- [x] 카테고리 태그 색상 4종 (QuestionList: 직무역량=blue, 경험=green, 성과=yellow, 기술=purple)
- [x] 페르소나 버블 색상 3종 (InterviewChat: hr=blue, tech_lead=green, executive=purple)
- [x] 세션 완료 결과 카드 (체크 아이콘 + 미구현 안내 + TODO 주석)
- [x] 랜딩 페이지 (/): Nav + Hero(LayeredCardWrapper+RadarChartInteractive) + Features + Personas + CTA + Footer
- [x] `components/landing/LayeredCardWrapper.tsx` — 3중 레이어 카드 래퍼 컴포넌트
- [x] `components/landing/RadarChartInteractive.tsx` — 8축 인터랙티브 점수 그리드 (데모 데이터)
- [x] 면접 페이지 헤더 glass-panel 적용
- [x] 기존 Vitest 테스트 통과 (data-testid 보존) — 32/32 passed
- [x] 모바일 반응형 (320px~) — Sidebar 햄버거 토글 포함
- [x] API 엔드포인트 변경 없음

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-11 | Phase 1~12 대부분 구현 완료 (API 비용 소진으로 중단) |
| 2026-03-12 | 작업 현황 점검: Vitest 1개 실패, TSC 에러 2개 확인 |
| 2026-03-12 | `UploadForm.tsx` 수정 — `"processing"` 타입 제거 (`UploadState`에 없음), `aria-label="질문 생성"` 추가 (uploading 상태에서 버튼 텍스트 변경으로 인한 테스트 탐색 실패 해결) |
| 2026-03-12 | TSC `--noEmit` 에러 0개, `npm run build` 성공, Vitest 32/32 통과 확인 |
| 2026-03-12 | `01_plan.md` 완료 기준 전체 체크, `services/siw/.ai.md` 최신화, `02_test.md` 작성 |
| 2026-03-12 | 전면 리디자인 (Pretendard + Glassmorphism 2차): (1) `page.tsx` — `"use client"` 전환, Hero 레이아웃 2컬럼, "MirAI" text-6xl/text-8xl 순수 검정 #0F0F1A, pill 태그 "✦ RAG 기반 AI 모의면접 시스템", 헤드라인 "진짜 실력" gradient-text, 인용구 italic, 버튼 rounded-full (2) 레이더 차트 → 8축 분석 대시보드 카드 (종합 점수 내부 카드, 8축 progress bar, hover 툴팁, 3D tilt onMouseMove perspective 효과) (3) Nav — 로고 SVG 별 아이콘, 중앙 4개 링크, "로그인" + rounded-full 시작하기 (4) Features — glass-card 제거 → bg-white border shadow-sm, 아이콘 bg-gradient-to-br rounded-2xl (5) Personas — #F8F8FF 배경, border-t-2 컬러 강조, 이니셜 아이콘 (6) CTA — #1e1b4b → indigo 딥 그라디언트, rounded-full 버튼 hover:scale (7) `globals.css` — dot-grid, fadeInUp, card-3d 추가 (8) FadeInSection IntersectionObserver 스크롤 애니메이션 — TSC 에러 0개, Vitest 32/32 통과 |
| 2026-03-12 | 디자인 세련도 향상 5종 구현: (1) 랜딩 히어로 텍스트 "당신의 첫 번째 면접관 / MirAI(gradient-text-cyan, 7xl)" 변경 (2) 랜딩 우측 면접 질문 미리보기 → 8축 역량 레이더 차트(SVG, 인디고/보라 그라디언트) 교체 (3) QuestionList → 자소서 분석 완료 카드(아이콘+gradient-text+카테고리 태그+면접 바로 시작 버튼, data-testid 보존) (4) InterviewChat 페르소나 버블 통일(bg-white + border-purple-200 + font-bold text-[#7C3AED], tag 제거) (5) globals.css glass-card shadow 부드럽게, btn-primary 120deg, glass-card-hover -3px, Sidebar 로고 패딩 조정·nav-item-active border-left 제거 배경색만으로 표현 — Vitest 32/32, TSC noEmit 에러 0개 확인 |
| 2026-03-12 | 랜딩 페이지 전면 재구성 (UI/UX Pro Max 스펙): (1) phone-ratio 8축 분석 카드 — rounded-[2rem] border-2 border-purple-300, min(660px,80vh) 높이, 내부 스크롤 flex column, 3D tilt onMouseMove(최대 6도, perspective 1200px, transition 0.15s) (2) AxisRow 인라인 컴포넌트 — hover bg rgba(124,58,237,0.06) transition 150ms, progress bar CSS width 즉시(transition:0s) (3) Nav — sticky top-0 z-50, 중앙 4링크 anchor scroll, "시작하기 →" rounded-full, 모바일 hidden md:flex (4) Hero — dot-grid bg, pill tag, "당신의 첫 번째 면접관" 서브헤드, MirAI gradient-text clamp(3rem,8vw,5rem), 헤드라인 2xl/3xl, italic 인용구, 버튼 2개 rounded-full (5) Features — bg-[#FAFAFA], FadeInSection stagger 100ms, hover:border-purple-200 (6) Personas — bg-white, border-t-2 컬러, rounded-full 이니셜 w-10 h-10 (7) CTA — bg-[#1e1b4b] 단색, rounded-xl 버튼 hover:scale-[1.02] (8) globals.css — html scroll-behavior:smooth + prefers-reduced-motion 쿼리 추가 — TSC noEmit 에러 0개, Vitest 32/32 통과 확인 |
| 2026-03-12 | 디자인 시스템 고도화 (Phase 13): (1) globals.css 전면 교체 — shadcn 호환 `:root` + `@theme inline` (Tailwind v4 색상 매핑), Pretendard `@import url()` CDN (layout.tsx `<link>` 태그 제거), layered-card-wrapper/lc-layer-* 3중 레이어 카드 CSS, score-grid-wrapper/axis-row/axis-row__* 8축 점수 그리드 CSS 전체 추가, glass-panel/glass-card-dark/gauge-*/tab-* 추가, 기존 glass-card·btn-primary 등 유지 (2) layout.tsx — body 단순화 (`antialiased` 유지, Pretendard link 제거) (3) `components/landing/LayeredCardWrapper.tsx` 신규 — 3중 레이어(lc-layer-3/2/1) 카드 래퍼, hover 시 레이어 분리 효과 (4) `components/landing/RadarChartInteractive.tsx` 신규 — 8축 점수 그리드 인터랙티브 데모, hover 시 axis-row 활성/비활성 전환, delta 배지·progress bar 포함 (5) `(landing)/page.tsx` — Hero 우측 phone-ratio 카드 → LayeredCardWrapper+RadarChartInteractive 교체, Features/Personas 카드 `glass-card glass-card-hover` 적용, Hero `bg-grid` 패턴 적용 (6) `interview/[sessionId]/page.tsx` — 헤더 `glass-panel` 적용 — next build 성공, Vitest 32/32 통과 확인 |

---

## 디자인 토큰 시스템

```
┌──────────────────────────────────────────────────────────────┐
│                     MirAI Design Tokens                      │
├──────────────┬────────────────────────────┬──────────────────┤
│   역할        │       값                   │    사용처         │
├──────────────┼────────────────────────────┼──────────────────┤
│ Primary      │  #4F46E5  ████  (인디고)   │ 버튼, 링크, 강조  │
│ Secondary    │  #7C3AED  ████  (보라)     │ 그라디언트, 태그  │
│ Accent       │  #06B6D4  ████  (시안)     │ 포인트 컬러       │
│ Success      │  #10B981  ████  (에메랄드) │ 완료, 정답        │
│ Warning      │  #F59E0B  ████  (앰버)     │ 주의, 경고        │
│ Error        │  #EF4444  ████  (레드)     │ 에러 메시지       │
│ Text         │  #1F2937                   │ 본문              │
│ Text Muted   │  #9CA3AF                   │ 힌트, 부제        │
│ BG           │  #F8F9FB                   │ 페이지 배경       │
└──────────────┴────────────────────────────┴──────────────────┘
```

---

## 컴포넌트 카탈로그

### Glass Card
```
┌───────────────────────────────────────────────┐
│           .glass-card                         │
│  background : rgba(255,255,255,0.85)           │
│  border     : 1px solid rgba(0,0,0,0.1)       │
│  backdrop   : blur(12px)                      │
│  shadow     : indigo tint + inset highlight   │
│                                               │
│  + .glass-card-hover                          │
│    → translateY(-4px) on hover                │
│    → border-color: rgba(79,70,229,0.22)       │
└───────────────────────────────────────────────┘
```

### 버튼
```
┌──────────────────────────┐   ┌──────────────────────────┐
│      .btn-primary        │   │      .btn-outline         │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │   │  ┌──────────────────┐    │
│  gradient(인디고→보라)    │   │  │  border only     │    │
│  shadow: indigo glow     │   │  └──────────────────┘    │
│  hover: lift -1px        │   │  hover: indigo bg+text   │
│  disabled: opacity 50%   │   │                          │
└──────────────────────────┘   └──────────────────────────┘
```

### 태그 / 배지
```
  ╭──────────╮  ╭──────────╮  ╭──────────╮  ╭──────────╮
  │ 직무역량  │  │ 경험구체성│  │  성과근거 │  │  기술역량 │
  │ tag-blue │  │tag-green │  │tag-yellow│  │tag-purple│
  ╰──────────╯  ╰──────────╯  ╰──────────╯  ╰──────────╯
  각 태그: bg(10% 투명) + 진한 텍스트 + border(20% 투명) + pill
```

### 그라디언트 텍스트
```
  .gradient-text      ──→  보라(#7C3AED) → 인디고(#4F46E5)   [로고 "MirAI"]
  .gradient-text-cyan ──→  인디고 → 보라 → 시안               [히어로 제목]
```

### LayeredCardWrapper (3중 레이어 카드)
```
                         ┌──────────────────────────────────┐
  lc-layer-1  z:1  ───→  │ border: 1px solid #7C3AED        │ ← 최상위 (실제 콘텐츠)
                         │ bg: rgba(255,255,255,0.97)        │   보라색 경계선
                         │ backdrop-filter: blur(16px)       │
                         └──────────────────────────────────┘
                           ┌────────────────────────────────┐
  lc-layer-2  z:0  ───→   │ bg: rgba(255,255,255,0.72)      │ ← 중간 레이어
                           │ translateY(5px) scale(0.982)    │   hover → translateY(8px)
                           └────────────────────────────────┘
                             ┌──────────────────────────────┐
  lc-layer-3  z:-1 ───→     │ bg: rgba(255,255,255,0.4)     │ ← 최하위 (가장 흐릿)
                             │ translateY(10px) scale(0.965) │   hover → translateY(14px)
                             └──────────────────────────────┘
  hover 시: 레이어 간격 벌어짐 + lc-layer-1 그림자/border 강화
```

### RadarChartInteractive (8축 점수 그리드)
```
  ┌─ score-grid-wrapper ────────────────────────────────┐
  │  ┌─ score-grid__summary ──────────────────────────┐ │
  │  │  종합 점수     68 → 80  (+12 초록)              │ │
  │  └────────────────────────────────────────────────┘ │
  │  ─────────────────────────────────────────────────  │
  │  ┌─ axis-row (hover → data-active=true) ──────────┐ │
  │  │  기술 정확도  20%       [이전:65]  [+13]  78점  │ │
  │  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ (prev bar 반투명)│ │
  │  │  ████████████████████████████████ (current bar) │ │
  │  │  (hover 시) "개념이 사실에 기반하는가" 설명 노출  │ │
  │  └────────────────────────────────────────────────┘ │
  │  ... × 8축                                          │
  │  ─────────────────────────────────────────────────  │
  │  범례: ● 현재  ○ 이전                               │
  └─────────────────────────────────────────────────────┘

  점수 구간별 색상:
    85+  →  #10B981 (초록)   linear-gradient(#10B981, #34D399)
    70~  →  #7C3AED (보라)   linear-gradient(#7C3AED, #9B59E8)
    ~69  →  #F59E0B (주황)   linear-gradient(#F59E0B, #FCD34D)
```

---

## 페이지별 비포 / 애프터

### `/resume` — 자소서 업로드

```
[ BEFORE ]                       [ AFTER ]
──────────────────────────       ─────────────────────────────────────────
<input type="file" />            ┌─────────────────────────────────────┐
<button>질문 생성</button>        │  ▓▓▓ MirAI          (gradient-text) │ ← sticky header
                                 ├─────────────────────────────────────┤
                                 │                                     │
                                 │  ╔═══════════════════════════════╗  │
                                 │  ║  자소서 분석  (gradient h2)   ║  │ ← glass-card
                                 │  ║  PDF 업로드 시 맞춤 질문 생성  ║  │
                                 │  ║                               ║  │
                                 │  ║  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  ║  │
                                 │  ║  │   drop zone (클릭 선택)  │  ║  │ ← dashed indigo
                                 │  ║  │   PDF 파일을 선택하세요   │  ║  │   hover border
                                 │  ║  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  ║  │
                                 │  ║                               ║  │
                                 │  ║  [▓▓▓▓▓▓ 질문 생성 ▓▓▓▓▓▓▓]  ║  │ ← btn-primary
                                 │  ╚═══════════════════════════════╝  │
                                 └─────────────────────────────────────┘
```

### `/resume` — QuestionList (결과) — MVP 현재 vs 최종 서비스

> **⚠️ 서비스 방향 메모**
> - **MVP 현재**: 질문 리스트 노출 후 "면접 시작" 버튼으로 진행 (개발 확인 용도)
> - **최종 서비스**: 질문 리스트 노출 없이 → "자소서 분석 완료" 확인 카드 → 면접 바로 시작
>   - QuestionList 컴포넌트는 향후 제거 또는 숨김 처리 예정
>   - 이번 디자인 작업에서는 **MVP 흐름 유지** + 최종 서비스를 위한 "분석 완료 카드" 디자인 뼈대 추가

```
[ MVP 현재 — 질문 리스트 표시 ]
─────────────────────────────────────────────
│  ▓▓▓ MirAI                               │ ← header
├─────────────────────────────────────────────┤
│  생성된 면접 질문  (gradient-text)          │
│  총 N개 질문                               │
│                                           │
│  ╔═══════════════════════════════════╗    │
│  ║  ╭──────────╮ 3개                 ║    │ ← glass-card
│  ║  │ 직무역량  │  (tag-blue)         ║    │   per category
│  ║  ╰──────────╯                     ║    │
│  ║  ──────────────────────────────── ║    │
│  ║   1  OO 프로젝트에서 담당한 역할은? ║    │
│  ║   2  팀 내 갈등을 어떻게 해결했나요?║    │
│  ╚═══════════════════════════════════╝    │
│                                           │
│  [다시 하기  outline]  [면접 시작 ▓▓▓▓▓]  │
└─────────────────────────────────────────────┘

[ 최종 서비스 목표 — 질문 리스트 미표시 ]
─────────────────────────────────────────────
│  ▓▓▓ MirAI                               │ ← header
├─────────────────────────────────────────────┤
│                                           │
│  ╔═══════════════════════════════════╗    │
│  ║                                   ║    │ ← glass-card
│  ║    ┌──────────────────┐           ║    │   "분석 완료" 카드
│  ║    │  bg-indigo-50    │           ║    │
│  ║    │  ✦ (아이콘)      │ w-16 h-16 ║    │
│  ║    └──────────────────┘           ║    │
│  ║                                   ║    │
│  ║   자소서 분석 완료  (gradient-text)║    │
│  ║   면접 질문 N개가 생성됐습니다     ║    │
│  ║                                   ║    │
│  ║   ╭──────────╮ ╭──────────╮       ║    │ ← 카테고리 요약 태그
│  ║   │ 직무역량  │ │  기술역량 │ ...  ║    │   (질문 내용 비공개)
│  ║   ╰──────────╯ ╰──────────╯       ║    │
│  ║                                   ║    │
│  ║   [▓▓▓▓▓ 면접 바로 시작 ▓▓▓▓▓▓]  ║    │ ← 바로 /interview 이동
│  ╚═══════════════════════════════════╝    │
│                                           │
│  [처음부터 다시  btn-outline]             │
└─────────────────────────────────────────────┘
  TODO: QuestionList → ResumeComplete 컴포넌트로 교체 (Phase 2 이후)
```

### `/interview/[sessionId]` — 면접 진행

```
[ AFTER ]
─────────────────────────────────────────────
│  ▓▓▓ MirAI        ╭─────────────╮         │ ← header
│                   │ 면접 진행 중 │ tag-purple│
│                   ╰─────────────╯         │
├─────────────────────────────────────────────┤
│                                           │
│  ┌────────────────────────────────────┐   │
│  │ bg-blue-50 / border-blue-200       │   │ ← 면접관 질문 버블
│  │ ╭──────────╮                       │   │   (페르소나별 색상)
│  │ │HR 담당자  │ tag-blue              │   │
│  │ ╰──────────╯                       │   │
│  │ "OO 프로젝트에서 본인의 역할은?"    │   │
│  └────────────────────────────────────┘   │
│         ┌──────────────────────────┐      │
│         │ bg-white / 내 답변 텍스트 │      │ ← 사용자 답변 (들여쓰기)
│         └──────────────────────────┘      │
│                                           │
│  ╔════════════════════════════════════╗   │ ← sticky bottom
│  ║  textarea (input-dark)             ║   │   glass-card
│  ║  [▓▓▓▓▓▓▓▓ 답변 제출 ▓▓▓▓▓▓▓▓▓▓▓] ║   │
│  ╚════════════════════════════════════╝   │
└─────────────────────────────────────────────┘

  페르소나 색상 매핑:
  hr        →  bg-blue-50   / border-blue-200   / tag-blue
  tech_lead →  bg-green-50  / border-green-200  / tag-green
  executive →  bg-purple-50 / border-purple-200 / tag-purple
```

### `/interview/[sessionId]` — 세션 완료

```
[ sessionComplete = true ]
  ╔══════════════════════════════════════╗
  ║                                      ║
  ║     ┌──────────────────┐             ║
  ║     │  bg-emerald-50   │             ║
  ║     │    ✓  (SVG)      │  w-16 h-16  ║
  ║     └──────────────────┘             ║
  ║                                      ║
  ║   면접이 완료됐습니다                  ║
  ║   역량 리포트 기능은 준비 중입니다     ║  ← TODO: Phase 2 /result 연결
  ║                                      ║
  ║   [다시 하기  btn-outline]            ║
  ╚══════════════════════════════════════╝
```

---

## 신규: 랜딩 페이지 `/`

```
┌──────────────────────────────────────────────────────────────┐
│ NAV  sticky z-50  bg-white/80 backdrop-blur                  │
│  ▓▓▓ MirAI (gradient-text)        [시작하기 ▓▓▓ btn-primary] │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ HERO  bg-[#F8F9FB]                                           │
│         ╭ blur orb indigo/10  (우상단) ╮                     │
│         ╰ blur orb purple/10  (좌하단) ╯                     │
│                                                              │
│  ┌──────────────────────────┐  ┌─────────────────────────────┐│
│  │  ╭─────────────╮         │  │    당신의 면접 분석            ││
│  │  │✦ RAG AI시스템│ tag-pur │  │    LLM 평가 기반 8축 분석     ││
│  │  ╰─────────────╯         │  │                             ││
│  │                          │  │  ╔═ lc-layer-1 (보라 border)╗ ││ ← LayeredCardWrapper
│  │  당신의 첫 번째 면접관      │  │  ║  .score-grid-wrapper     ║ ││   3중 레이어 카드
│  │  MirAI  (gradient-text)  │  │  ║  종합 점수: 68 → 80 (+12)║ ││
│  │                          │  │  ║  ─────────────────────── ║ ││
│  │  AI가 당신의 진짜 실력을    │  │  ║  기술정확도 ████████ 78 ║ ││ ← RadarChartInteractive
│  │  보여줍니다               │  │  ║  설명명확도 █████████ 82 ║ ││   axis-row hover 인터랙션
│  │                          │  │  ║  문제해결   ███████   75 ║ ││   delta 배지 + progress bar
│  │  [무료로 시작하기 ▓▓▓▓▓▓]  │  │  ║  의사소통   ██████████88 ║ ││
│  │  [대시보드 보기 ○○○○○○]  │  │  ║  ...                    ║ ││
│  └──────────────────────────┘  │  ╚═════════════════════════╝ ││
│                                │    각 항목 위로 마우스를       ││
│                                │    이동해보세요               ││
│                                └─────────────────────────────┘│
│  (lc-layer-2, lc-layer-3: 아래로 밀린 그림자 레이어들)           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ FEATURES  bg-white  id="features"                            │
│  "면접 준비의 모든 것"                                         │
│                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ │
│  │  bg-indigo-50   │ │  bg-purple-50   │ │  bg-cyan-50     │ │ ← glass-card-hover
│  │  [FileText 아이콘]│ │  [Users 아이콘] │ │  [Zap 아이콘]   │ │   lucide-react
│  │                 │ │                 │ │                 │ │
│  │  AI 자소서 분석  │ │   3인 패널 면접  │ │  실시간 꼬리질문 │ │
│  │  PDF 핵심 추출  │ │  HR·기술·경영진  │ │  CLARIFY·CHALL  │ │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘ │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ PERSONAS  bg-[#F8F9FB]                                       │
│  "3인 1조 페르소나 패널 면접"                                   │
│                                                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │
│  │  ╭────╮        │  │  ╭────╮       │  │  ╭────╮       │    │
│  │  │ HR │ blue   │  │  │기술│ green │  │  │경영 │ purpl│    │
│  │  ╰────╯        │  │  ╰────╯       │  │  ╰────╯       │    │
│  │  HR 담당자      │  │  기술팀장     │  │  경영진        │    │
│  │  조직적합·인성  │  │  직무·기술깊이│  │  성장가능성·비전│    │
│  │  • STAR 기법   │  │  • 기술 심층  │  │  • 장기 비전   │    │
│  │  • 가치관 탐색  │  │  • 문제해결   │  │  • 전략적 사고 │    │
│  │  • 팀워크 검증  │  │  • 구현방법   │  │  • 임팩트 검증 │    │
│  └───────────────┘  └───────────────┘  └───────────────┘    │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│ CTA  background: linear-gradient(인디고 → 보라)               │
│                                                              │
│          "당신의 면접, 데이터로 바꾸세요"  (text-white)         │
│          "자소서를 업로드하고 AI 면접을 지금 시작하세요"          │
│                                                              │
│          [ 무료로 시작하기  bg-white / text-indigo ]           │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│ FOOTER  bg-white border-t                                    │
│  ▓▓▓ MirAI  AI 모의면접 코치              링크 목록            │
└──────────────────────────────────────────────────────────────┘
```

---

## 향후 기능: 자소서 선택 → 면접 시작 페이지 (`/resumes`)

> **Phase 2 이후 별도 이슈로 구현 예정** — 이번 작업에서는 디자인 뼈대와 UX 흐름만 정의

### 배경
현재는 `/resume`에서 매번 새로 업로드해야 면접 시작 가능.
→ 이전에 업로드한 자소서 목록을 보고 선택 → 바로 면접 시작할 수 있는 페이지 필요.

### UX 흐름

```
[ 현재 흐름 ]
  /resume (업로드) → 질문 생성 → 면접 시작

[ 목표 흐름 ]
  /          (랜딩)
   ↓ "시작하기"
  /resumes   (내 자소서 목록) ──────────────────────────────┐
   ├─ 저장된 자소서 있음 → 카드 목록 표시 + "새 자소서 업로드" │
   └─ 저장된 자소서 없음 → /resume 업로드로 리다이렉트       │
                                                           │
  [자소서 카드 선택]                                        │
   ↓ "이 자소서로 면접 시작"                               │
  /interview/[sessionId]   (면접 진행)                     │
                                                           │
  [+ 새 자소서 업로드]  ←────────────────────────────────── ┘
   ↓ /resume (업로드 완료 후 /resumes로 복귀)
```

### `/resumes` 페이지 디자인

```
┌──────────────────────────────────────────────────────────────┐
│ NAV  ▓▓▓ MirAI                      [새 자소서 업로드 ▓▓▓▓]  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  내 자소서  (gradient-text)                                   │
│  저장된 자소서 N개                                             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  glass-card glass-card-hover  rounded-2xl p-6        │   │ ← 자소서 카드
│  │                                                      │   │   (클릭 시 선택)
│  │  ╭──────────╮  파일명.pdf                            │   │
│  │  │ tag-blue │  업로드: 2026-03-10                    │   │
│  │  ╰──────────╯  생성된 질문: 12개                      │   │
│  │                                                      │   │
│  │  [이 자소서로 면접 시작 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  glass-card  파일명2.pdf                             │   │
│  │  업로드: 2026-03-08  /  질문: 10개                   │   │
│  │  [이 자소서로 면접 시작 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓]             │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│  │  + 새 자소서 업로드   (btn-outline, dashed border)   │   │ ← /resume으로 이동
│  └─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘

[ 빈 상태 (자소서 없음) ]
  ╔══════════════════════════════════════╗
  ║   ┌──────────────────┐              ║
  ║   │  bg-indigo-50    │              ║
  ║   │  📄 (아이콘)      │              ║
  ║   └──────────────────┘              ║
  ║   아직 업로드한 자소서가 없습니다     ║
  ║   [▓▓▓▓ 첫 자소서 업로드 ▓▓▓▓▓▓▓]  ║
  ╚══════════════════════════════════════╝
```

### 필요한 백엔드 작업 (siw 서비스 내)
- `Resume` DB 모델에 `userId` 연결 (현재는 익명)
- `GET /api/resumes` — 내 자소서 목록 조회 API
- 인증 도입 후 userId 기반 필터링

### 이번 작업 범위
- `/resumes` 페이지 **신규 생성** — 정적 목 데이터로 디자인 뼈대만 구현
- 실제 API 연결은 인증 + DB 이슈 해결 후 별도 PR

---

## 백엔드 수정 플랜 (siw 서비스 내)

> **이번 이슈 범위**: 신규 `GET /api/resumes` route 뼈대 추가 (목 데이터)
> **원칙**: 기존 엔드포인트 로직·스펙 변경 없음.

### 현재 API 구조
```
src/app/api/
  resume/
    questions/route.ts   POST  — PDF 업로드 → 질문 생성
  interview/
    start/route.ts       POST  — 세션 시작 + 첫 질문
    answer/route.ts      POST  — 답변 제출 + 다음 질문
```

### 추가할 API
```
src/app/api/
  resumes/
    route.ts             GET   — 저장된 자소서 목록 반환 (목 데이터)
```

#### `GET /api/resumes` 응답 스펙 (목 데이터)
```ts
// 실제 DB 연결 전 정적 mock 반환
[
  {
    id: "mock-1",
    fileName: "홍길동_자소서_2026.pdf",
    uploadedAt: "2026-03-10T09:00:00Z",
    questionCount: 12,
    categories: ["직무 역량", "기술 역량", "성과 근거"],
  },
  {
    id: "mock-2",
    fileName: "홍길동_자소서_카카오.pdf",
    uploadedAt: "2026-03-08T14:30:00Z",
    questionCount: 10,
    categories: ["직무 역량", "경험의 구체성"],
  },
]
```

### Prisma 모델 변경 (향후 — 이번 이슈 미구현)
```prisma
// 목표 (userId 연결 — 인증 이슈 완료 후)
model Resume {
  id        String   @id @default(cuid())
  userId    String?                        // ← 추가 예정
  fileName  String                         // ← 추가 예정
  createdAt DateTime @default(now())
  // ...
}
```

---

## 사이드바 레이아웃 플랜

> **이번 작업**: 기능 없는 뼈대 구현 — 클릭 시 해당 페이지 이동만 작동, 실데이터 없음
> **적용 범위**: `/resume`, `/resumes`, `/interview/*` 등 앱 내부 페이지
> **랜딩 (`/`)**: 사이드바 없음 — 별도 `(landing)` 라우트 그룹

### 전체 레이아웃 구조

```
┌─────────────────────────────────────────────────────────────┐
│  ┌──────────────┬──────────────────────────────────────┐   │
│  │              │                                      │   │
│  │   SIDEBAR    │           MAIN CONTENT               │   │
│  │   w-64       │           flex-1                     │   │
│  │   h-screen   │           overflow-y-auto            │   │
│  │   sticky     │                                      │   │
│  │              │                                      │   │
│  └──────────────┴──────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
모바일(< 768px): 사이드바 숨김 + 상단 햄버거 버튼으로 토글
```

### 사이드바 상세 디자인

```
┌──────────────────────────────┐
│  bg-white border-r           │
│  h-screen sticky top-0 w-64  │
│                              │
│  ┌────────────────────────┐  │
│  │  ▓▓▓ MirAI             │  │ ← gradient-text 로고
│  │  AI 면접 코치          │  │ ← text-[#9CA3AF] 서브타이틀
│  └────────────────────────┘  │
│  ── 구분선 ────────────────   │
│                              │
│  [활성]                      │
│  ┌────────────────────────┐  │
│  ▌ □ 내 자소서             │  │ ← nav-item-active
│  └────────────────────────┘  │   border-left: 2px solid #4F46E5
│                              │   bg: rgba(79,70,229,0.1)
│  [비활성]                    │
│  ┌────────────────────────┐  │
│  │ □ 면접 시작             │  │ ← text-[#4B5563]
│  └────────────────────────┘  │   hover: bg-[#F8F9FB]
│                              │
│  ── 곧 출시 ───────────────   │
│                              │
│  ┌────────────────────────┐  │
│  │ □ 대시보드  [준비 중]   │  │ ← opacity-50 cursor-not-allowed
│  └────────────────────────┘  │   tag-yellow "준비 중"
│                              │
│  ┌────────────────────────┐  │
│  │ □ 면접 리포트 [준비 중] │  │
│  └────────────────────────┘  │
│                              │
│  ┌────────────────────────┐  │
│  │ □ 연습 모드   [준비 중] │  │
│  └────────────────────────┘  │
│                              │
└──────────────────────────────┘

아이콘 (lucide-react):
  내 자소서   → FileText
  면접 시작   → Play
  대시보드    → LayoutDashboard
  면접 리포트 → BarChart2
  연습 모드   → Dumbbell
```

### 라우트 그룹 파일 구조 (신규)

```
src/app/
  (landing)/                      ← 랜딩 전용 그룹 (사이드바 없음)
    page.tsx                      ← 기존 / 페이지 이동
  (app)/                          ← 사이드바 레이아웃 그룹
    layout.tsx                    ← Sidebar + <main> 래퍼  [신규]
    resume/
      page.tsx                    ← 기존 파일 이동
    resumes/
      page.tsx                    ← 신규 (자소서 목록, 목 데이터)
    interview/
      [sessionId]/
        page.tsx                  ← 기존 파일 이동
  layout.tsx                      ← 루트 (globals.css + Pretendard)

src/components/
  Sidebar.tsx                     ← 신규
```

### `Sidebar.tsx` 네비게이션 스펙

```ts
type NavItem = {
  label:    string
  href:     string
  icon:     LucideIcon
  disabled?: boolean   // 미구현 메뉴
  badge?:   string     // "준비 중"
}

const NAV_MAIN: NavItem[] = [
  { label: "내 자소서", href: "/resumes", icon: FileText },
  { label: "면접 시작", href: "/resume",  icon: Play },
]

const NAV_COMING: NavItem[] = [
  { label: "대시보드",   href: "#", icon: LayoutDashboard, disabled: true, badge: "준비 중" },
  { label: "면접 리포트", href: "#", icon: BarChart2,      disabled: true, badge: "준비 중" },
  { label: "연습 모드",  href: "#", icon: Dumbbell,        disabled: true, badge: "준비 중" },
]
```

---

## 작업 순서

```
Phase 1  빌드 설정
  ├─ package.json  : tailwindcss + @tailwindcss/postcss + postcss (devDeps)
  │                  framer-motion + lucide-react (deps) 추가
  └─ postcss.config.mjs  신규 생성

Phase 2  globals.css  신규 생성
  └─ @import "tailwindcss"
     디자인 토큰(:root) + glass-card + gradient-text
     btn-primary/outline + tag variants
     input-dark + gauge + skeleton + animations + nav-item-active

Phase 3  layout.tsx
  └─ import "./globals.css"
     <head> Pretendard CDN link 추가
     <body> antialiased bg-[#F8F9FB] + Pretendard font-family

Phase 4  라우트 그룹 재구성
  ├─ src/app/(app)/layout.tsx                    신규 — Sidebar + <main> 래퍼
  ├─ src/app/(app)/resume/page.tsx               기존 파일 이동 (내용 동일)
  └─ src/app/(app)/interview/[sessionId]/page.tsx  기존 파일 이동

Phase 5  Sidebar.tsx  신규 생성
  └─ NAV_MAIN(내 자소서·면접시작) + NAV_COMING(대시보드·리포트·연습모드)
     usePathname으로 활성 메뉴 → nav-item-active
     disabled 아이템 tag-yellow "준비 중" 배지
     모바일 햄버거 토글 (useState + md:hidden)

Phase 6  UploadForm.tsx  (로직 불변)
  └─ glass-card 컨테이너 + drop zone (dashed border, indigo hover)
     tag-purple 파일명 배지 + btn-primary + animate-spin 로딩

Phase 7  QuestionList.tsx  (data-testid 불변)
  └─ CATEGORY_TAGS 색상 맵 (blue/green/yellow/purple)
     glass-card per category
     btn-outline 다시하기 + btn-primary 면접시작

Phase 8  interview/[sessionId]/page.tsx  (로직 불변)
  └─ tag-purple 진행 중 배지
     sticky bottom glass-card (input + submit)
     sessionComplete 완료 카드 (체크 SVG + TODO 주석)

Phase 9  InterviewChat.tsx  (data-testid 불변)
  └─ PERSONA_STYLE 맵 (hr/tech_lead/executive)
     페르소나별 bg/border/tag 색상 버블
     user-answer 들여쓰기 카드

Phase 10  GET /api/resumes  신규 생성  [백엔드]
  └─ src/app/api/resumes/route.ts — 목 데이터 반환
     (실 DB 연결은 인증 이슈 완료 후 별도 PR)

Phase 11  src/app/(app)/resumes/page.tsx  신규 생성
  └─ 자소서 목록 glass-card-hover 카드
     카테고리 태그 요약 + "이 자소서로 면접 시작" btn-primary
     빈 상태 UI + "새 자소서 업로드" btn-outline

Phase 12  src/app/(landing)/page.tsx  신규 생성
  └─ Nav(상단 고정) + Hero(오브 배경) + Features(lucide 아이콘)
     Personas + CTA(그라디언트) + Footer

Phase 13  디자인 시스템 고도화 — Pretendard + 레이어드 카드 + 인터랙티브 점수 그리드
  ├─ globals.css 전면 교체
  │   ├─ @import url(Pretendard CDN) — layout.tsx <link> 제거
  │   ├─ @theme inline — Tailwind v4 색상 토큰 자동 매핑
  │   ├─ :root shadcn 호환 변수 (--background, --primary, ...)
  │   ├─ layered-card-wrapper / lc-layer-1/2/3 CSS
  │   ├─ score-grid-wrapper / axis-row / axis-row__* CSS
  │   └─ glass-panel / glass-card-dark / tab-bar / gauge-* 추가
  ├─ layout.tsx — <link> 태그 제거, body 단순화
  ├─ components/landing/LayeredCardWrapper.tsx  신규
  │   └─ 3중 레이어 카드 래퍼 (lc-layer-3 → 2 → 1)
  │      hover 시 레이어 분리 효과 (CSS transition)
  ├─ components/landing/RadarChartInteractive.tsx  신규
  │   └─ 8축 인터랙티브 점수 그리드 (데모 데이터 하드코딩)
  │      axis-row CSS 클래스 기반 hover 인터랙션
  │      delta 배지 색상 (초록/레드/회색)
  ├─ (landing)/page.tsx  업데이트
  │   ├─ Hero 우측: LayeredCardWrapper + RadarChartInteractive 교체
  │   ├─ Features 카드: glass-card glass-card-hover 적용
  │   ├─ Personas 카드: glass-card glass-card-hover 적용
  │   └─ Hero 배경: bg-grid 패턴 적용
  └─ interview/[sessionId]/page.tsx  헤더 glass-panel 적용
```

---

## 구현 도구

> **`~/.claude/skills/ui-ux-pro-max`** 스킬로 각 Phase 구현
> - Tailwind v4 클래스 정확성 검증
> - 반응형 레이아웃 (320px ~ 1280px) 보장
> - 접근성 (color contrast ratio, focus-visible) 확인
> - glassmorphism 크로스브라우저 (`backdrop-filter` fallback)

---

## 불변식 체크리스트

```
✓ data-testid 변경 없음
    answer-input · submit-answer · chat-message · persona-label
    user-answer  · session-complete · question-item · start-interview

✓ API URL 변경 없음
    /api/resume/questions
    /api/interview/start
    /api/interview/answer

✓ 상태 로직 변경 없음   (UploadState 전이, history, sessionComplete)
✓ import 경로 변경 없음
✓ export default 함수명 유지
```

---

## 검증

```bash
cd .worktree/000063-siw-pretendard-glassmorphism/services/siw
npm install
npm run dev     # http://localhost:3002

체크 항목:
  /             랜딩 — Nav(glass) + Hero(bg-grid + LayeredCardWrapper + RadarChartInteractive)
                       + Features(glass-card-hover) + Personas(glass-card-hover)
                       + CTA(dark) + Footer
  /             Hero 우측 카드: 3중 레이어 카드 hover 시 레이어 분리 효과 확인
  /             RadarChartInteractive: 각 axis-row hover 시 active/inactive 전환 확인
  /resume       glass-card + gradient-text 헤더 + drop zone
  (업로드 후)    QuestionList — 카테고리 태그 색상 4종
  /interview    헤더 glass-panel + 페르소나 버블 색상 + sticky 입력창
  (완료 후)     체크 완료 카드
  전체          Pretendard 폰트 로드 확인 (CDN @import)
  전체          배경색 #F8F9FB, 텍스트 #1F2937 확인

npm run test    # Vitest — data-testid 보존 확인 (32/32)
npm run build   # next build — 타입 에러 없음 확인
```
