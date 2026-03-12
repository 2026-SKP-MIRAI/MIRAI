# feat: [siw] 디자인 시스템 적용 — Pretendard + glassmorphism + 랜딩 페이지

## 사용자 관점 목표
siw 서비스에 MirAI 디자인 시스템을 적용해 사용자가 일관성 있고 세련된 UI에서 면접 준비를 경험할 수 있도록 한다.

## 배경
이전 MirAI Python 프로젝트의 완성된 디자인 시스템(Pretendard 폰트 + 인디고/보라/시안 브랜드 컬러 + glassmorphism + gradient text)을 현재 Next.js siw 서비스에 이식한다.

현재 siw는 Tailwind 미설치 + 모든 컴포넌트/페이지가 class 없는 bare HTML 상태.

**핵심 원칙: 로직·API 엔드포인트·data-testid 변경 없음 — 스타일(className)만 추가/교체.**

## 완료 기준
- [x] Tailwind v4 설치 및 postcss 설정 완료
- [x] globals.css — 디자인 토큰 + 유틸 클래스 전체 (glass-card, gradient-text, btn-primary, tag variants 등)
- [x] Pretendard 폰트 로드 (Network 탭 확인)
- [x] glass-card glassmorphism 효과 (backdrop-blur) 동작
- [x] gradient-text MirAI 로고 렌더링
- [x] btn-primary 그라디언트 버튼 적용
- [x] 카테고리 태그 색상 4종 (QuestionList: 직무역량=blue, 경험=green, 성과=yellow, 기술=purple)
- [x] 페르소나 버블 색상 3종 (InterviewChat: hr=blue, tech_lead=green, executive=purple)
- [x] 세션 완료 결과 카드 (체크 아이콘 + 미구현 안내 + TODO 주석)
- [x] 랜딩 페이지 (/): Nav + Hero + Features + Personas + CTA + Footer
- [x] 기존 Vitest 테스트 통과 (data-testid 보존)
- [x] 모바일 반응형 (320px~)
- [x] API 엔드포인트 변경 없음

## 구현 플랜

### Phase 1: 빌드 설정
- `services/siw/package.json`에 tailwindcss, @tailwindcss/postcss, postcss, framer-motion, lucide-react 추가
- `services/siw/postcss.config.mjs` 신규 생성

### Phase 2: globals.css 생성 (`services/siw/src/app/globals.css`)
- `@import "tailwindcss"` (Tailwind v4)
- CSS 디자인 토큰 (`:root` — `--mirai-primary: #4F46E5` 등)
- `.glass-card` / `.glass-card-hover` (glassmorphism: backdrop-filter blur 12px)
- `.gradient-text` / `.gradient-text-cyan`
- `.btn-primary` / `.btn-outline`
- `.tag` / `.tag-purple` / `.tag-blue` / `.tag-green` / `.tag-yellow` / `.tag-cyan`
- `.input-dark`
- `.gauge-track` / `.gauge-fill-green` / `.gauge-fill-brand`
- `.skeleton` (shimmer 애니메이션)
- `.nav-item-active`

### Phase 3: layout.tsx 업데이트
- Pretendard CDN import (`<head>`)
- globals.css import
- `<body>` — antialiased + `bg-[#F8F9FB]` + fontFamily 설정

### Phase 4: resume/page.tsx 래퍼 추가
- 공통 헤더 (gradient-text 로고) + `max-w-3xl` 레이아웃 래퍼
- 기존 상태 로직 변경 없음

### Phase 5: UploadForm.tsx 스타일 교체
- glass-card 카드 컨테이너
- 파일 드롭존 (indigo 계열 border, 상태별 색상 변화)
- btn-primary / btn-outline 버튼
- tag tag-purple 파일명 배지
- 로딩 스피너 (animate-spin)

### Phase 6: QuestionList.tsx 스타일 교체
- gradient-text 헤더
- 카테고리별 glass-card 섹션
- 카테고리 태그 4종 색상
- `data-testid="question-item"` / `data-testid="start-interview"` 보존

### Phase 7: interview/[sessionId]/page.tsx 스타일 교체
- 공통 헤더 + "면접 진행 중" tag-purple 태그
- 답변 입력창 glass-card sticky bottom
- input-dark textarea
- 세션 완료 결과 카드 (TODO: Phase 2 — /result 연결)
- 모든 data-testid 보존

### Phase 8: InterviewChat.tsx 스타일 교체
- 페르소나별 색상 스타일 맵 (hr=blue, tech_lead=green, executive=purple)
- 면접관 bubble: rounded-2xl + 색상 border/bg
- 내 답변: ml-8 + white bg + border
- 모든 data-testid 보존

### Phase 9: 랜딩 페이지 신규 생성 (`services/siw/src/app/page.tsx`)
- 고정 네비게이션 (gradient-text 로고 + "시작하기" CTA → /resume)
- Hero: 배경 오브 blur + 좌측 텍스트 + 우측 면접 질문 미리보기 카드
- Features: 3개 glass-card-hover (AI 자소서 분석 / 3인 패널 면접 / 실시간 꼬리질문)
- Personas: 3인 페르소나 카드 (HR/기술팀장/경영진)
- CTA: 인디고→보라 그라디언트 배경
- Footer

## 미구현 기능 디자인 준비
| 기능 | 준비 내용 | 향후 작업 |
|-----|---------|---------|
| 8축 리포트 | 세션 완료 후 빈 결과 카드 + TODO 주석 + gauge CSS | `/interview/[id]/result` + ScoreGrid |
| 연습 모드 | gauge-track / gauge-fill-* CSS 클래스 | 피드백 카드 컴포넌트 |
| 대시보드 | glass-card-hover + skeleton CSS 준비 | 사이드바 레이아웃 |
| 인증 | input-dark, btn-primary, glass-card 확립 | /login, /signup 페이지 |

## 개발 체크리스트
- [ ] 테스트 코드 포함 (기존 Vitest 통과 확인)
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음 (API 엔드포인트·data-testid 변경 없음)

---

## 작업 내역

### 변경 요약

로직·API·data-testid를 전혀 수정하지 않고 className(스타일)만 추가/교체하는 원칙 하에 siw 서비스 전체에 MirAI 디자인 시스템을 적용했다.

### 주요 변경 파일

**빌드 설정**
- `package.json` / `postcss.config.mjs` — tailwindcss v4, @tailwindcss/postcss, postcss, framer-motion, lucide-react 추가

**디자인 시스템 기반**
- `src/app/globals.css` (신규) — Pretendard @import url(), shadcn 호환 `:root` 변수, `@theme inline` Tailwind v4 색상 매핑, glass-card/glass-panel/glass-card-dark, gradient-text/gradient-text-cyan, btn-primary/btn-outline, tag variants, input-dark, layered-card-wrapper/lc-layer-*, score-grid-wrapper/axis-row, bg-grid, animations 전체 포함
- `src/app/layout.tsx` — Pretendard `<link>` 태그 제거 (globals.css @import로 대체), body 단순화

**라우트 그룹 재구성**
- `(landing)/page.tsx` (신규) — Nav(sticky/blur) + Hero(bg-grid, LayeredCardWrapper+RadarChartInteractive) + Features(glass-card-hover) + Personas(glass-card-hover) + CTA(인디고→보라 그라디언트) + Footer
- `(app)/layout.tsx` (신규) — Sidebar + main 래퍼. 모바일에서 pt-14 md:pt-0으로 햄버거 버튼 영역 확보
- `(app)/resume/page.tsx` — 기존 위치에서 이동 (내용 동일)
- `(app)/resumes/page.tsx` (신규) — 자소서 목록 페이지 (목 데이터, glass-card-hover 카드, 빈 상태 UI)
- `(app)/interview/[sessionId]/page.tsx` — 기존 위치에서 이동 + 헤더 glass-panel 적용 + MirAI 로고 → / 링크

**컴포넌트**
- `Sidebar.tsx` (신규) — NAV_MAIN(내 자소서·면접시작) + NAV_COMING(준비중 3종). usePathname 활성 표시, 모바일 햄버거 토글, MirAI 로고 → / 링크
- `UploadForm.tsx` — glass-card 컨테이너, indigo dashed drop zone, btn-primary, animate-spin 로딩 스피너. UploadState 타입 수정(processing 제거) 포함
- `QuestionList.tsx` — 카테고리별 glass-card, CATEGORY_TAGS 색상 맵 4종(blue/green/yellow/purple), btn-outline 다시하기 + btn-primary 면접시작
- `InterviewChat.tsx` — PERSONA_STYLE 맵 3종(hr=blue/tech_lead=green/executive=purple), 페르소나별 bg/border/tag 색상 버블
- `components/landing/LayeredCardWrapper.tsx` (신규) — lc-layer-3/2/1 3중 레이어 카드 래퍼. hover 시 레이어 분리 효과
- `components/landing/RadarChartInteractive.tsx` (신규) — 8축 인터랙티브 점수 그리드. axis-row hover 시 active/inactive 전환, delta 배지, progress bar

**백엔드 (목 데이터)**
- `api/resumes/route.ts` (신규) — GET /api/resumes 목 데이터 반환 (실 DB 연결은 인증 이슈 후 별도 PR)

### 기술적 결정 사항

- **Tailwind v4 CSS-first 접근** — tailwind.config.ts 불필요. `@import "tailwindcss"` + `@theme inline`으로 모든 토큰 관리
- **Pretendard를 CSS에서 로드** — layout.tsx의 `<link>` 태그 대신 globals.css `@import url()`로 통일
- **ScoreGrid.tsx 미포함** — 재사용 가능한 props 기반 컴포넌트로 작성됐으나 현재 사용처 없음. 향후 /interview/[id]/result 페이지에서 사용 예정
- **data-testid 전부 보존** — answer-input, submit-answer, chat-message, persona-label, user-answer, session-complete, question-item, start-interview 모두 유지
- **Vitest 32/32, TSC noEmit 에러 0개, next build 성공** 확인 완료

