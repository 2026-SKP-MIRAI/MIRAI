# [#116] feat: lww MVP 프론트엔드 구현 — 브랜딩 컬러 확정 및 전체 화면 개발

> 브랜치: `feat/000116-lww-mvp-frontend`

## 완료 기준

- [x] 옵션 A(Violet) · B(Teal) · C(Rose) 목업 비교 후 최종 키 컬러 선정 및 `docs/specs/lww/branding.md` 확정
- [x] Tailwind 디자인 토큰 설정 (컬러, 타이포, 간격)
- [x] 랜딩/온보딩 화면 구현
- [x] 자소서 업로드 화면 리디자인
- [x] 면접 채팅 UI 구현 (카카오톡 스타일)
- [x] 면접 결과/리포트 화면 구현
- [x] 성장 추이/대시보드 화면 구현 (면접 히스토리 탭 — MVP 범위)
- [x] 반응형 모바일 레이아웃 적용
- [x] 빈 상태 / 에러 상태 화면 구현
- [x] `services/lww/.ai.md` 최신화

## 작업 내역

### 브랜딩 & 디자인 토큰
- Teal #0D9488 (옵션 B) 최종 확정, `docs/specs/lww/branding.md` 업데이트
- `globals.css` Tailwind v4 `@theme` 블록에 Teal 팔레트·타이포·간격 토큰 적용
- Tailwind v4에서 포화 색상 CSS 변수가 임의값 문법(`bg-[--color-primary]`)에 적용되지 않는 문제 발견 → 하드코딩 `bg-[#0D9488]` 사용으로 회피

### 화면 구현
- **랜딩/온보딩**: `OnboardingSlider` — 3슬라이드 자동 전환(1.5s), 풀스크린 오버레이, 점 인디케이터, 스킵 버튼
- **직군 선택**: `JobCategorySelector` — 직군 칩(최대 3개) + 취준 단계 카드 선택, 44px 터치 타깃
- **자소서 업로드**: `/resume` — PDF 업로드 → 예상 질문 생성, 카드 레이아웃 리디자인
- **면접 채팅**: `/interview/[sessionId]` — 카카오톡 스타일 채팅 UI, AI/유저 버블, 페르소나 라벨, 진행 게이지, 30초 힌트
- **결과 리포트**: `/report/[sessionId]` — 총점(0–100) + 카테고리 점수 바, 강점/개선 피드백, 오브 미리보기(잠금)
- **면접 히스토리**: `/interview` — 기록 목록 or EmptyState
- **빈 상태**: `EmptyState` 공통 컴포넌트
- **에러 상태**: `NetworkError` + 재시도 버튼

### E2E 품질 개선 (Playwright 자동화 10라운드, 3회 연속 PASS)
- **채팅 레이아웃**: 상단 고정 방식 확정. 시스템 배너("🎙️ AI 면접이 시작됐어요!")를 메시지 div 첫 항목으로 삽입
- **진행 카운터 수정**: `Math.min(questionIndex + 1, total)` — Q1 시작 시 "1/5" 표시
- **면접 완료 카드**: `(state.status === "ending" || isEnding)` 조건 — questionIndex 기준 종료도 커버
- **ChatInput 텍스트 오버플로우**: `overflow-hidden` → `overflow-y-auto` (긴 답변 잘림 방지)
- **ScoreBar 색상**: 낮은 점수 `red` → `amber` (위협적 인상 완화)
- **터치 타깃**: 직군 칩 `min-h-[44px]`, 스킵 버튼 `min-h-[44px] min-w-[44px]`
- **resume 페이지 회색 거터**: 루트 div에 `w-full` 추가 (body `align-items:center` 때문)
- **CategoryScoreGrid, TypingIndicator, ChatBubble** 등 소폭 UX 폴리싱
- `play_log/` — 최종 E2E 스크린샷 21장 포함

### 텍스트 오버플로우 전수 수정 (ralph loop)
- **근본 원인 확인**: `MobileShell`의 `overflow-x-hidden`이 자식 컨테이너의 우측 패딩(`px-N`)을 시각 경계에서 잘라냄
- **수정 패턴**: 외부 컨테이너 `px-N` → `pl-N`, 내부 flex div에 `pr-N` 이동
- `ChatInput`: 외부 `pl-4`, 내부 flex에 `pr-4` — "답변을 입력하세요" + 전송 버튼 우측 잘림 해소
- `ChatTopBar`: 외부 `pl-4`, 내부 `flex-1 min-w-0`에 `pr-4` — "2/5" 카운터 우측 잘림 해소
- `ChatBubble`: `break-words` + `max-w-[240px]` — 긴 텍스트 버블 줄바꿈 보장
- `OnboardingSlider`: 채팅 미리보기 버블에 `break-words`, 제목에 `whitespace-pre-line`
- `CategoryScoreGrid`: `grid-cols-3` → `grid-cols-2` — 점수 카드 레이블 잘림 방지
- `interview/page.tsx` 헤더: `TopBar` 컴포넌트 대신 인라인 header로 교체, `pl-5` + Link에 `pr-5`
- Playwright E2E 21개 화면 전수 검증 완료 (스크린샷 `docs/work/done/…/screenshots/`)
