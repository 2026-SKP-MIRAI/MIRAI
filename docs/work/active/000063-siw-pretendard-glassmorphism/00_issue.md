# feat: [siw] 디자인 시스템 적용 — Pretendard + glassmorphism + 랜딩 페이지

## 사용자 관점 목표
siw 서비스에 MirAI 디자인 시스템을 적용해 사용자가 일관성 있고 세련된 UI에서 면접 준비를 경험할 수 있도록 한다.

## 배경
이전 MirAI Python 프로젝트의 완성된 디자인 시스템(Pretendard 폰트 + 인디고/보라/시안 브랜드 컬러 + glassmorphism + gradient text)을 현재 Next.js siw 서비스에 이식한다.

현재 siw는 Tailwind 미설치 + 모든 컴포넌트/페이지가 class 없는 bare HTML 상태.

**핵심 원칙: 로직·API 엔드포인트·data-testid 변경 없음 — 스타일(className)만 추가/교체.**

## 완료 기준
- [ ] Tailwind v4 설치 및 postcss 설정 완료
- [ ] globals.css — 디자인 토큰 + 유틸 클래스 전체 (glass-card, gradient-text, btn-primary, tag variants 등)
- [ ] Pretendard 폰트 로드 (Network 탭 확인)
- [ ] glass-card glassmorphism 효과 (backdrop-blur) 동작
- [ ] gradient-text MirAI 로고 렌더링
- [ ] btn-primary 그라디언트 버튼 적용
- [ ] 카테고리 태그 색상 4종 (QuestionList: 직무역량=blue, 경험=green, 성과=yellow, 기술=purple)
- [ ] 페르소나 버블 색상 3종 (InterviewChat: hr=blue, tech_lead=green, executive=purple)
- [ ] 세션 완료 결과 카드 (체크 아이콘 + 미구현 안내 + TODO 주석)
- [ ] 랜딩 페이지 (/): Nav + Hero + Features + Personas + CTA + Footer
- [ ] 기존 Vitest 테스트 통과 (data-testid 보존)
- [ ] 모바일 반응형 (320px~)
- [ ] API 엔드포인트 변경 없음

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

