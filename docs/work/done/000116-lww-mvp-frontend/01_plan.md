# [#116] feat: lww MVP 프론트엔드 구현 — 브랜딩 컬러 확정 및 전체 화면 개발 — 구현 계획

> 작성: 2026-03-17

---

## 완료 기준

- [x] 옵션 A(Violet) · B(Teal) · C(Rose) 목업 비교 후 최종 키 컬러 선정 및 `docs/specs/lww/branding.md` 확정
- [ ] Tailwind 디자인 토큰 설정 (컬러, 타이포, 간격)
- [ ] 랜딩/온보딩 화면 구현
- [ ] 자소서 업로드 화면 리디자인
- [ ] 면접 채팅 UI 구현 (카카오톡 스타일)
- [ ] 면접 결과/리포트 화면 구현
- [ ] 성장 추이/대시보드 화면 구현
- [ ] 반응형 모바일 레이아웃 적용
- [ ] 빈 상태 / 에러 상태 화면 구현
- [ ] `services/lww/.ai.md` 최신화

---

## 구현 계획

> MVP 범위에 집중한다. Phase 1/2+ 전용 화면(홈 피드, 페르소나 마켓, 쪽지, 코인 충전, 현직자 온보딩 등)은 이번 구현에서 제외한다.
> 아키텍처 불변식: 외부 AI API 호출은 엔진(FastAPI)에서만. 프론트는 `/api/*` 프록시만 호출한다.
> **데이터 전략(MVP)**: 엔진이 stateless이므로 클라이언트(useInterview 훅)가 `history`·`questionsQueue`를 메모리에 유지하고, 매 API 호출 시 request body에 포함해 전달한다. DB 저장은 Phase 1에서 추가한다.

---

### 단계 1: 프로젝트 기반 — Tailwind CSS + Shadcn UI 설치 및 디자인 토큰 적용

**작업 내용:**

1. **Tailwind v4 설치 방식 사전 확인** (착수 전 필수)
   - `npx shadcn@latest init`이 v4 환경에서 생성하는 `globals.css` 구조 확인
   - v4는 CSS-first (`@theme` directive in `globals.css`), `tailwind.config.ts`는 옵션
   - Shadcn v4 공식 문서 기준으로 설치 방식 결정 후 진행

2. Tailwind CSS v4, `tailwindcss-animate`, `class-variance-authority`, `clsx`, `tailwind-merge` 설치
3. Shadcn UI 초기화 (`npx shadcn@latest init`) — `components.json` 생성
4. `globals.css` 생성: 옵션 B(Teal) CSS 토큰 적용 (`branding.md` §2 옵션 B 그대로), Tailwind directives, `@theme` 블록 (v4 방식)
5. **Pretendard 폰트**: CDN 방식 사용 금지. `next/font/local`로 `public/fonts/PretendardVariable.woff2` 로드 (LCP 최적화)
6. `layout.tsx` 수정: `globals.css` import, `lang="ko"`, metadata 설정, `next/font/local` Pretendard 적용
7. Shadcn UI 기본 컴포넌트 설치: `button`, `card`, `input`, `badge`, `toast`, `dialog`, `progress`, `separator`
8. `lib/utils.ts` 생성 (`cn` 헬퍼)
9. `lucide-react` 설치 (아이콘)
10. **디렉토리 구조**: Route Group 적용
    - `src/app/(main)/` — 탭 바 있는 화면 (홈, 면접 목록, 대시보드 등)
    - `src/app/(interview)/interview/[sessionId]/` — 면접 채팅 (탭 바 없음, 별도 레이아웃)
    - 각 그룹에 `layout.tsx` 분리 → `app/layout.tsx`는 서버 컴포넌트 유지 가능
11. **Rate Limiting** (`src/middleware.ts`): IP당 분당 10회 제한 (Vercel Edge Middleware + Upstash Redis 또는 in-memory fallback)
    - 대상: `/api/interview/*`, `/api/resume/*`

**수정/생성 파일:**
- `services/lww/package.json` (의존성 추가)
- `services/lww/src/app/globals.css` (신규)
- `services/lww/src/app/layout.tsx` (수정)
- `services/lww/src/app/(main)/layout.tsx` (신규 — MobileShell + BottomTabBar)
- `services/lww/src/app/(interview)/layout.tsx` (신규 — 탭 바 없는 레이아웃)
- `services/lww/src/lib/utils.ts` (신규)
- `services/lww/src/middleware.ts` (신규 — Rate Limiting)
- `services/lww/components.json` (신규, shadcn 설정)
- `services/lww/src/components/ui/*.tsx` (shadcn 컴포넌트, 자동 생성)
- `services/lww/public/fonts/PretendardVariable.woff2` (신규)

**의존 관계:** 없음 (첫 단계)

**완료 기준:**
- `npm run build` 성공
- `globals.css`에 Teal 토큰이 적용되어 있음
- Tailwind 유틸리티 클래스(`bg-primary`, `text-foreground` 등)가 CSS 변수를 참조함
- Shadcn Button 컴포넌트가 import 가능하고 Teal 컬러로 렌더링됨
- Rate limiting middleware가 `/api/interview/start`에 429 응답 가능

---

### 단계 2: 공통 레이아웃 — 모바일 셸 + 하단 탭 바 + 상단 바

**작업 내용:**

1. `MobileShell` 레이아웃 컴포넌트: 375px 중앙 정렬, 좌우 여백 16px, `min-h-[100dvh]` (동적 뷰포트)
2. `TopBar` 컴포넌트: 로고("lww"), 뒤로가기 버튼(조건부), 높이 56px
3. `BottomTabBar` 컴포넌트 — **반드시 `'use client'` 선언** (`usePathname` 사용)
   - 5탭: 홈(`/`), 면접(`/interview`), 마켓, 커뮤, 나
   - MVP 활성 탭: 홈, 면접 (히스토리 포함)
   - 준비 중 탭(마켓/커뮤/나): 회색 아이콘 + 탭 클릭 시 **"곧 오픈해요!" 토스트** (탭 바는 항상 표시)
   - **면접 채팅 중 탭 클릭** → "면접 중에는 다른 화면으로 이동할 수 없습니다" 토스트 (탭 바 숨기지 않음)
   - Lucide 아이콘 사용 (`Home`, `Mic`, `ShoppingBag`, `MessageCircle`, `User`)
   - 활성 탭: `text-primary`, 비활성: `text-muted-foreground`
   - 탭 바에 `padding-bottom: env(safe-area-inset-bottom)` 적용 (iPhone 홈 인디케이터 영역)
4. `Toast` / `Toaster` 설정 (Shadcn sonner 또는 toast)
5. 빈 상태 공통 컴포넌트 `EmptyState` — props: `{ icon, title, description, ctaLabel?, ctaHref? }`
6. **`(main)/layout.tsx`**: MobileShell + TopBar + BottomTabBar 포함 (서버 컴포넌트 wrapper + 클라이언트 탭 바)
7. **`(interview)/layout.tsx`**: MobileShell만 포함 (탭 바 없음, 면접 전용)

**수정/생성 파일:**
- `services/lww/src/components/layout/MobileShell.tsx` (신규)
- `services/lww/src/components/layout/TopBar.tsx` (신규)
- `services/lww/src/components/layout/BottomTabBar.tsx` (신규, `'use client'`)
- `services/lww/src/components/common/EmptyState.tsx` (신규)
- `services/lww/src/app/(main)/layout.tsx` (신규)
- `services/lww/src/app/(interview)/layout.tsx` (신규)

**의존 관계:** 단계 1 완료 후

**완료 기준:**
- 모든 페이지에서 상단 바 + 하단 탭 바가 표시됨
- 모바일 375px 기준 좌우 여백 16px, 콘텐츠 중앙 정렬
- 준비 중 탭 클릭 시 토스트 표시
- EmptyState 컴포넌트가 props(icon, title, description, ctaLabel, ctaHref)로 재사용 가능

---

### 단계 3: 랜딩/온보딩 + 직군 선택 화면

**작업 내용:**

1. `app/(main)/page.tsx` 리디자인 — 온보딩 슬라이드 3장 구현 (**`'use client'`** 필수, localStorage 접근)
   - 슬라이드 1: 스플래시 — **1.5초 자동 전환** 후 슬라이드 2로 이동 (스토리보드 명세)
   - 슬라이드 2: AI 면접 소개 (채팅 일러스트 + 카피)
   - 슬라이드 3: 결과 리포트 소개 + "지금 시작하기" CTA 버튼
   - 슬라이드 인디케이터 (도트), 건너뛰기 버튼(우상단)
   - 슬라이드 전환: CSS `scroll-snap-type: x mandatory` (라이브러리 없이 구현)
   - 온보딩 완료 후 localStorage에 `onboarding_done` 플래그 저장
   - 재방문 시 온보딩 스킵 → 직군 선택(`/onboarding`)으로 이동
2. `app/(main)/onboarding/page.tsx` — 직군 + 취준 단계 선택 (**`'use client'`** 필수)
   - 직군 칩 선택 (최대 3개): IT, 마케팅, PM, 금융, 컨설팅, HR, 디자인, 영업
   - 취준 단계 라디오: 서류 준비 중 / 면접 준비 중 / 최종합격 대기
   - "면접 시작하기" CTA (둘 다 선택 시 활성화)
   - 선택 결과를 localStorage에 저장 (MVP는 인증 없음)
   - CTA 클릭 시 면접 채팅 화면으로 이동

**수정/생성 파일:**
- `services/lww/src/app/page.tsx` (전면 리디자인)
- `services/lww/src/app/onboarding/page.tsx` (신규)
- `services/lww/src/components/onboarding/OnboardingSlider.tsx` (신규)
- `services/lww/src/components/onboarding/JobCategorySelector.tsx` (신규)

**의존 관계:** 단계 2 완료 후

**완료 기준:**
- 첫 방문 시 3장 슬라이드 표시, 스와이프/탭으로 전환 가능
- "지금 시작하기" 클릭 → 직군 선택 화면 이동
- 직군 + 취준 단계 둘 다 선택해야 CTA 활성화
- 재방문 시 온보딩 스킵
- 모바일 375px 레이아웃 정상

---

### 단계 4: 면접 API Route 핸들러 (Next.js → 엔진 프록시)

**작업 내용:**

엔진 stateless 패턴: 클라이언트(useInterview 훅)가 `history`·`questionsQueue`를 유지하며 매 호출 시 body에 포함. 기존 `lib/engine-client.ts` 공통 모듈 추출.

1. `lib/engine-client.ts` 신규 생성
   - `engineFetch(path, options, timeoutMs = 95000)`: per-call timeout 오버라이드 가능
   - **허용 경로 화이트리스트** 적용 (SSRF 방지):
     ```
     ALLOWED_PATHS = ["/api/interview/start", "/api/interview/answer", "/api/report/generate", "/api/resume/questions", "/api/resume/feedback"]
     ```
   - **ENGINE_BASE_URL 폴백 제거**: 환경변수 미설정 시 즉시 에러 throw (`process.env.ENGINE_BASE_URL!` 또는 명시적 검증)
   - AbortError vs 네트워크 에러 구분: `err.name === 'AbortError'` → 504 응답
   - 기존 `api/resume/questions/route.ts` 패턴 추출

2. `app/api/interview/start/route.ts`
   - **Zod 스키마 검증**: `{ jobCategories: z.array(z.string()).min(1).max(3), careerStage: z.string() }`
   - `resumeText` 조합: `"직군: {jobCategories.join(', ')} / 취준 단계: {careerStage}"` (min_length=1 충족)
   - `jobCategories` 빈 배열 방어: 검증 실패 시 400 반환
   - `sessionId`는 route 내에서 `crypto.randomUUID()`로 생성
   - 응답: `{ sessionId, firstQuestion, questionsQueue }` (sessionId는 Next.js route가 생성, 엔진 미반환)

3. `app/api/interview/answer/route.ts`
   - **Zod 스키마 검증**: `history` 배열 최대 20개, 각 필드 길이 상한 적용
   - 입력: `{ resumeText, currentAnswer, history, questionsQueue, currentQuestion: string, currentPersona }`
   - **`currentQuestion`은 반드시 `string` 타입** (QuestionWithPersona 객체 아님 — 엔진 422 방지)
   - 엔진 `POST /api/interview/answer` 호출
   - **`updatedHistory` 엔진 미반환**: 엔진은 `{ nextQuestion, updatedQueue, sessionComplete }` 반환. `history`는 클라이언트(`useInterview` 훅)가 직접 누적 (`[...prevHistory, { question: currentQuestion, answer: currentAnswer, persona: currentPersona }]`)
   - 응답: `{ nextQuestion, updatedQueue, sessionComplete }` — `updatedHistory` 없음, 클라이언트가 관리

4. `app/api/interview/end/route.ts`
   - **Zod 스키마 검증**: `{ resumeText, history: z.array(...).min(1) }`
   - 엔진 `POST /api/report/generate` 동기 호출, `timeoutMs = 105000` (마진 확보)
   - `export const maxDuration = 110` 설정
   - 응답: `{ report }` (완성된 리포트 즉시 반환, 별도 폴링 불필요)

**수정/생성 파일:**
- `services/lww/src/lib/engine-client.ts` (신규)
- `services/lww/src/app/api/interview/start/route.ts` (신규)
- `services/lww/src/app/api/interview/answer/route.ts` (신규)
- `services/lww/src/app/api/interview/end/route.ts` (신규, maxDuration=110)
- `services/lww/src/app/api/resume/questions/route.ts` (수정 — engine-client 사용)

**의존 관계:** 단계 1 완료 후 (단계 2와 병렬 가능)

**완료 기준:**
- `npm run build` 성공, 타입 에러 없음
- 각 route.ts의 입출력 타입이 `lib/types.ts`에 정의됨
- engine-client 공통 모듈 적용으로 fetch 코드 중복 없음

---

### 단계 5: 면접 채팅 UI (카카오톡 스타일)

**작업 내용:**

1. `app/(interview)/interview/[sessionId]/page.tsx` — 채팅형 모의면접 화면 (신규, **`'use client'`**)
   - 레이아웃: `h-[100dvh] flex flex-col` (동적 뷰포트, 키보드 올라올 때 대응)
   - 상단: 뒤로가기 + "AI 면접관" + `● 면접 진행 중` 상태 점 + 진행도 게이지 (N/5)
   - 채팅 영역: 스크롤 가능, 새 메시지 시 **`containerRef.current.scrollTop = containerRef.current.scrollHeight`** (scrollIntoView 사용 금지 — iOS Safari 버그)
   - AI 메시지 버블: 왼쪽 정렬, `bg-muted`, `rounded-2xl rounded-bl-sm`, 아바타(32px)
   - 유저 메시지 버블: 오른쪽 정렬, `bg-primary text-primary-foreground`, `rounded-2xl rounded-br-sm`
   - 하단 입력창: `rounded-3xl`, `pb-[env(safe-area-inset-bottom)]`, 전송 버튼(Primary 원형 40px)
   - 입력창 멀티라인 자동 확장 (최대 120px)

2. **`useInterview` 훅 상태 인터페이스** (명시적 정의 필수):
   ```typescript
   interface InterviewState {
     sessionId: string | null;
     resumeText: string;              // 직군 정보 조합 문자열
     currentQuestion: string;         // string 타입 (QuestionWithPersona.question 필드만 추출)
     currentPersona: PersonaType;
     history: HistoryItem[];          // 훅이 직접 누적 ([...prev, { question, answer, persona }])
     questionsQueue: QueueItem[];
     questionIndex: number;           // 0-based
     status: 'idle' | 'loading' | 'answering' | 'submitting' | 'ending' | 'complete' | 'error';
   }
   ```
   - **`sessionStorage` 백업**: `useEffect`에서 상태 변경 시마다 `sessionStorage.setItem('interview_state', JSON.stringify(state))` 동기화 → 새로고침 시 복구
   - **`beforeunload` 이벤트**: 면접 중 탭 닫기/브라우저 닫기 시 경고 표시

3. 채팅 로직 (MVP Non-streaming)
   - 면접 시작: `POST /api/interview/start` 호출 → `{ sessionId, firstQuestion, questionsQueue }` 수신
   - `firstQuestion.question` (string 추출) → `currentQuestion` 상태 저장
   - 답변 전송: **클라이언트 fetch에 `AbortSignal.timeout(120000)` 설정** (서버 maxDuration=110s 대응)
   - `POST /api/interview/answer` → `{ nextQuestion, updatedQueue, sessionComplete }` 수신
   - `history` 누적: `[...prev, { question: currentQuestion, answer, persona: currentPersona, personaLabel }]`
   - 로딩 상태: 타이핑 인디케이터 버블 ("AI 면접관이 생각 중이에요...")
   - 30초 무답변 힌트: 채팅 영역 하단에 인라인 텍스트 표시 (`clearTimeout` 클린업 필수)
   - `sessionComplete: true` 시 → `/api/interview/end` 호출 → 리포트 화면 이동

4. 면접 중 탭 처리 (탭 바 유지)
   - 뒤로가기: 확인 Dialog "면접을 중단할까요? 저장되지 않습니다" [중단 / 계속]
   - 다른 탭 클릭: `BottomTabBar`에서 인터뷰 중 상태 감지 → "면접 중에는 다른 화면으로 이동할 수 없습니다" 토스트

5. 에러 처리
   - AI 응답 오류/타임아웃: "응답에 문제가 생겼어요" + [다시 보내기] / [면접 종료]
   - 네트워크 오류: "연결이 끊겼어요. 잠깐 기다렸다가 다시 시도해주세요." + [다시 시도하기]

**수정/생성 파일:**
- `services/lww/src/app/(interview)/interview/[sessionId]/page.tsx` (신규)
- `services/lww/src/components/chat/ChatBubble.tsx` (신규 — AI/User 버블)
- `services/lww/src/components/chat/ChatInput.tsx` (신규 — 입력창 + 전송)
- `services/lww/src/components/chat/ChatTopBar.tsx` (신규 — 면접 상단 바)
- `services/lww/src/components/chat/TypingIndicator.tsx` (신규)
- `services/lww/src/hooks/useInterview.ts` (신규 — 면접 상태 관리 훅, `'use client'`)
- `services/lww/src/lib/types.ts` (수정 — InterviewState, HistoryItem, QueueItem, PersonaType 타입 추가)

**의존 관계:** 단계 2, 단계 4 완료 후

**완료 기준:**
- 카카오톡 스타일 채팅 버블이 좌/우로 정렬됨
- `/api/interview/start` → `/api/interview/answer` 플로우 정상 동작
- 진행도 게이지가 질문 수에 따라 갱신됨
- 5문항 완료 시 리포트 화면으로 자동 이동
- 뒤로가기 시 확인 팝업 표시
- AI 응답 지연/오류 시 적절한 에러 UI 표시
- 모바일 375px 레이아웃 정상, 키보드 올라올 때 입력창이 가려지지 않음

---

### 단계 6: 면접 결과 리포트 + 대시보드 화면

**작업 내용:**

1. `app/(interview)/report/[sessionId]/page.tsx` — 결과 리포트 화면 (신규, **`'use client'`**)
   - **로딩 UX** (12-18초 대기): 단순 스피너 대신 단계별 텍스트 순차 전환
     - 0-5초: "답변을 분석하고 있어요..."
     - 5-10초: "점수를 계산하고 있어요..."
     - 10초+: "피드백을 작성하고 있어요..." (4-5초 간격 자동 전환)
   - 상단: "면접 결과 리포트" + 날짜
   - 종합 점수: Progress 바 + 점수 숫자 (Primary 컬러)
   - 카테고리별 점수: 3축(논리력/표현력/자신감) 3열 그리드
   - 피드백 섹션: "잘 하셨어요" (체크) + "이렇게 해보세요" (렌치) + **"▶ 개선 예시 보기" expandable**
   - 합격 예언 오브: 블러 + "곧 열려요" 배너
   - 하단 CTA: [다시 연습하기] + [면접 기록 보기]
   - **결과 이탈 안내**: [면접 기록 보기] / [홈으로] 클릭 시 "이 결과는 저장되지 않아요. 계속할까요?" 확인 다이얼로그 (MVP 비저장 명시)
   - 리포트 데이터: `useInterview` 훅이 `/end` 응답으로 수신해 `router.push`로 전달 (또는 sessionStorage 임시 저장)

2. `app/(main)/interview/page.tsx` — **면접 탭 메인 화면** (히스토리 리스트 + 새 면접 시작)
   - 면접 탭(`/interview`)이 대시보드 역할 겸임 (별도 `/dashboard` 라우트 없음)
   - 상단: "내 면접 기록" + [새 면접 시작] 버튼
   - 면접 히스토리 리스트: 날짜, 직군, 종합 점수 요약 카드 (localStorage 기반, MVP)
   - 빈 상태: `EmptyState("아직 면접 기록이 없어요.", "오늘 첫 면접 시작해볼까요? 🎯", ctaLabel="면접 시작하기")`
   - 성장 추이 차트 → Phase 1 예정, MVP는 리스트만

**수정/생성 파일:**
- `services/lww/src/app/(interview)/report/[sessionId]/page.tsx` (신규)
- `services/lww/src/app/(main)/interview/page.tsx` (신규 — 면접 탭 메인/히스토리)
- `services/lww/src/components/report/ScoreBar.tsx` (신규)
- `services/lww/src/components/report/CategoryScoreGrid.tsx` (신규)
- `services/lww/src/components/report/FeedbackSection.tsx` (신규)
- `services/lww/src/components/report/OrbPreviewCard.tsx` (신규 — 합격 예언 오브 잠금)
- `services/lww/src/components/report/LoadingPhaseText.tsx` (신규 — 단계별 로딩 텍스트)
- `services/lww/src/components/interview/InterviewHistoryCard.tsx` (신규)

**의존 관계:** 단계 5 완료 후 (리포트는 면접 완료 후 진입)

**완료 기준:**
- 면접 완료 후 리포트 화면에 종합 점수 + 카테고리 점수 + 피드백 표시
- 리포트 생성 중(processing) 시 로딩 UI 표시, 완료 시 자동 갱신
- 합격 예언 오브가 블러 + 잠금 상태로 표시 ("곧 열려요")
- "다시 연습하기" 클릭 시 직군 선택 또는 면접 시작으로 이동
- 대시보드에서 면접 히스토리 리스트 표시 또는 빈 상태 표시
- 모바일 375px 레이아웃 정상

---

### 단계 7: 자소서 업로드 리디자인 + 빈 상태/에러 상태 + 마무리

**작업 내용:**

1. `app/resume/page.tsx` 리디자인 — 기존 UploadForm 스타일 적용
   - 점선 테두리 업로드 영역, 파일 아이콘, "PDF 최대 10MB" 안내
   - 업로드 후 "맞춤 질문 생성 중..." 로딩 상태
   - 업로드 성공 → 질문 목록 → "면접 시작하기" CTA
   - 업로드 실패 → 에러 메시지 + 재시도 버튼
   - 기존 `UploadForm.tsx`, `QuestionList.tsx` 로직 보존, 스타일만 적용
2. 빈 상태 화면 (design.md §6 기반)
   - 면접 히스토리 빈 상태 (대시보드에 적용)
   - 네트워크 에러 화면 (공통)
   - AI 응답 지연 화면 (채팅에 적용)
   - 서버 오류 500 화면
3. 에러 바운더리
   - `error.tsx` (App Router 에러 바운더리): 서버 오류 화면 렌더링
   - `not-found.tsx`: 404 화면
4. 반응형 점검
   - 320px ~ 430px 범위 레이아웃 확인
   - 폰트/패딩 미세 조정 (320px에서 1px 축소)
5. `services/lww/.ai.md` 최신화
   - 신규 디렉토리 구조 반영
   - 컴포넌트 목록 업데이트
   - MVP 프론트엔드 구현 완료 상태 기록

**수정/생성 파일:**
- `services/lww/src/app/resume/page.tsx` (수정 — 스타일 리디자인)
- `services/lww/src/components/UploadForm.tsx` (수정 — 스타일 적용)
- `services/lww/src/components/QuestionList.tsx` (수정 — 스타일 적용)
- `services/lww/src/app/error.tsx` (신규)
- `services/lww/src/app/not-found.tsx` (신규)
- `services/lww/src/components/common/NetworkError.tsx` (신규)
- `services/lww/.ai.md` (수정)

**의존 관계:** 단계 2 완료 후 (단계 3~6과 병렬 가능, 단 .ai.md 최신화는 전체 완료 후)

**완료 기준:**
- 자소서 업로드 화면이 브랜드 디자인 적용된 상태
- 각 빈 상태 화면이 design.md 가이드대로 렌더링됨 (아이콘 + 제목 + 설명 + CTA)
- error.tsx, not-found.tsx가 브랜드 스타일로 렌더링됨
- 320px~430px 범위에서 레이아웃 깨지지 않음
- `.ai.md`에 최종 디렉토리 구조와 컴포넌트 목록이 반영됨
- `npm run build` 성공, 타입 에러 없음

---

### 단계 8: 테스트 코드 작성

**작업 내용:**

기존 vitest + @testing-library/react + playwright 인프라 활용.

1. **단위 테스트 (vitest + @testing-library/react)**
   - `useInterview.ts` 훅: 상태 전이(초기화→질문→답변→완료), API 에러 처리
   - `ChatBubble.tsx`: AI/User 버블 렌더링, 좌/우 정렬
   - `EmptyState.tsx`: props(icon, title, description, ctaLabel) 렌더링
   - `OnboardingSlider.tsx`: 슬라이드 전환, localStorage `onboarding_done` 저장
   - `JobCategorySelector.tsx`: 칩 선택/해제, CTA 활성화 조건

2. **API Route 테스트 (vitest + fetch mock)**
   - `api/interview/start/route.ts`: resumeText 조합 로직, 정상 응답, 엔진 오류 시 에러 전파
   - `api/interview/answer/route.ts`: 정상 응답, 5문항 완료 `sessionComplete: true`
   - `api/interview/end/route.ts`: report 동기 반환 확인 (mock 엔진 응답)

3. **E2E 테스트 (playwright)**
   - 온보딩 → 직군 선택 → 면접 시작 흐름 (엔진 mock)
   - 채팅 버블 렌더링 확인

**수정/생성 파일:**
- `services/lww/src/hooks/__tests__/useInterview.test.ts` (신규)
- `services/lww/src/components/__tests__/ChatBubble.test.tsx` (신규)
- `services/lww/src/components/__tests__/EmptyState.test.tsx` (신규)
- `services/lww/src/components/__tests__/OnboardingSlider.test.tsx` (신규)
- `services/lww/src/app/api/interview/__tests__/start.test.ts` (신규)
- `services/lww/tests/interview-flow.spec.ts` (신규 — playwright)

**의존 관계:** 단계 5, 6, 7 완료 후

**완료 기준:**
- `npm run test` 전체 통과
- `npm run test:e2e` 핵심 흐름 통과
- 커버리지: 훅·공통 컴포넌트 70% 이상

---

### 단계 간 의존 관계 요약

```
단계 1 (기반 + Route Group + Rate Limiting)
  ├── 단계 4 (API Route 핸들러 + Zod 검증) ─────────────┐
  └── 단계 2 (공통 레이아웃 — (main)/(interview) 분리)   │
        ├── 단계 3 (온보딩/직군 선택 — (main) 그룹)      │
        ├── 단계 5 (채팅 UI — (interview) 그룹) ←─────────┤
        │     └── 단계 6 (리포트 + 면접 히스토리)         │
        └── 단계 7 (업로드 리디자인 + 빈/에러 상태 + .ai.md)
                          ↓
                  단계 8 (테스트)
```

- 단계 3, 7은 단계 2 이후 병렬 진행 가능
- 단계 5는 단계 2 + 단계 4 완료 후
- 단계 6은 단계 5 완료 후
- 단계 8은 단계 5, 6, 7 완료 후
- `.ai.md` 최신화는 단계 8 완료 후 최종 실행

---

### 범위 외 (이번 구현에서 제외)

- Phase 1: 소셜 로그인, 코인 시스템, 음성 입력, DB 기반 세션 저장
- Phase 2+: 홈 피드, 페르소나 마켓, 쪽지, 커뮤니티, 코인 충전, 직무 MBTI, 아차 포인트
- 다크모드 (v2 예정, CSS 토큰은 사전 정의 완료)
