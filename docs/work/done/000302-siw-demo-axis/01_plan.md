# [#302] feat: [siw] 데모 모드 전면 디벨롭 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] 데모 모드 리포트에서 상위 3개 점수 축만 동적으로 표시
- [x] AbortController로 페이지 이탈 시 in-flight fetch 취소
- [x] evaluate.test.ts mock axisFeedbacks 8개 (엔진 계약 준수)
- [x] 모바일(390px~) 결과 섹션 정상 표시
- [x] 회원가입 "*필수" 텍스트 제거
- [x] tech_lead 페르소나 질문 도메인 중립화

---

## 1차 구현 계획 — 평가 축 동적화 + AbortController

> 합의 방식: Planner → Architect → Critic (APPROVE) | 2026-03-27

### ADR

- **Decision**: Option A — 프론트엔드 전용 필터링 (엔진 변경 없음)
- **Drivers**: (1) `ReportResponse.axisFeedbacks: min_length=8, max_length=8` 계약 보존, (2) 데모 전용 범위 한정
- **Alternatives considered**:
  - Option B (엔진 API에 personas 파라미터 추가): 파괴적 변경, 4개 서비스 regression risk — 기각
  - Option C (데모 API route 필터링): Option A 대비 파일 2배 변경 — 기각
- **Why chosen**: 최소 변경, 파괴적 변경 없음
- **Consequences**: 엔진이 불필요한 5축도 계산하나 비용 무시 가능
- **Follow-ups**: 향후 페르소나별 리포트 기능 도입 시 엔진 API 확장 검토

### Step 1: `demo/page.tsx` — topAxes 동적 계산

**파일**: `services/siw/src/app/(landing)/demo/page.tsx`

- 고정 `DEMO_AXES` 제거 → `topAxes` useMemo (axisFeedbacks 상위 3축 동적 계산)
- `demoAxesFeedbacks`, `improvements`, `strengths` 필터를 `topAxes` 기반으로 통일
- 플레이스홀더: `Object.keys(ALL_AXIS_LABELS).slice(0, 3)` (evaluation 없을 때)

### Step 2: `demo/page.tsx` — AbortController

- `abortRef = useRef<AbortController | null>(null)` 추가
- `useEffect` cleanup: `abortRef.current?.abort()`
- `handleSelectRole`, `handleSubmit` 각각 새 AbortController 생성 + signal 전달
- catch: `if (e instanceof Error && e.name === "AbortError") return`

### Step 3: `evaluate.test.ts` — mock 데이터 계약 정합성

- mock `axisFeedbacks` 3개 → 8개 (엔진 계약 `min_length=8, max_length=8` 준수)
- `toHaveLength(3)` → `toHaveLength(8)`

### Step 4: `demo/.ai.md` 최신화

---

## 2차 구현 계획 — 모바일 반응형

> 합의 방식: Planner → Architect (APPROVE) → Critic (OKAY) | 2026-03-27

### ADR

- **Decision**: Option A — `page.tsx` Tailwind 클래스만 수정, `globals.css` 불변
- **Drivers**: globals.css Line 772-794에 `.score-grid-wrapper`, `.axis-row` 모바일 미디어쿼리 이미 존재
- **Alternatives considered**:
  - Option B (globals.css 미디어쿼리 추가): 이미 존재하므로 중복 — 기각
- **Why chosen**: 최소 변경
- **Consequences**: 인라인 style → Tailwind 클래스로 스타일 일관성 향상
- **Follow-ups**: 모바일 전용 점수 카드 대체 고려

### Step A1: 결과 섹션 그리드

| 위치 | 현재 | 변경 후 |
|------|------|---------|
| 결과 grid | `grid grid-cols-2 gap-10` | `grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-10` |
| 레이더 div | `className="relative"` | `className="relative order-last md:order-none"` |

### Step A2: 점수 폰트 Tailwind화

| 위치 | 현재 | 변경 후 |
|------|------|---------|
| 점수 숫자 | `style={{ fontSize:"80px", letterSpacing:"-3px" }}` | `text-[48px] md:text-[80px] tracking-[-3px]` |

### Step A3: 레이더 overflow 방지

`max-w-[420px]` → `max-w-full md:max-w-[420px]`

### Step A4: 패딩 축소

- 점수 배너: `p-8` → `p-5 md:p-8`
- 요약 카드: `p-8` → `p-4 md:p-8`

### Step A5: 오버레이 팝업 패딩

`px-5 py-4` → `px-3 py-3 md:px-5 md:py-4`

---

## 3차 구현 계획 — 회원가입 UI + 엔진 프롬프트

### Step B1: `signup/page.tsx` — "*필수" 텍스트 제거

**파일**: `services/siw/src/app/(auth)/signup/page.tsx`

- `[이용약관]에 동의합니다 <span className="text-destructive">*필수</span>` → span 제거
- `[개인정보처리방침]에 동의합니다 (국외이전 포함) <span className="text-destructive">*필수</span>` → span 제거
- 체크박스 필수 검증 로직 유지 (기능 변경 없음)

### Step B2: `interview_tech_lead_v3.md` — Few-Shot 예시 도메인 중립화

**파일**: `engine/app/prompts/interview_tech_lead_v3.md`

- 기존: `[도구/방법론]을 사용하셨는데` (소프트웨어 편향)
- 변경: `[직무 도메인]에서 [특정 방법/접근법]을` (도메인 중립)
- 기존: `[프로젝트명]에서 [방법론/도구]를 적용하셨는데`
- 변경: `[직무 도메인]의 실무에서 [특정 상황/과제]를 처리할 때`

**배경**: few-shot 예시가 소프트웨어 편향 → 바리스타 등 비개발 직군에 개발 질문 생성

---

## 전체 검증 방법

| 항목 | 방법 |
|------|------|
| 동적 축 표시 | 데모 완료 후 상위 3축만 피드백 카드에 노출 확인 |
| AbortController | 로딩 중 뒤로가기 → 콘솔 에러 없음 확인 |
| 모바일 레이아웃 | DevTools 390px — 1컬럼 스택, 점수 먼저 표시 |
| 데스크탑 레이아웃 | 1280px — 2컬럼 유지 |
| 비개발 직군 질문 | "바리스타"로 데모 → 도메인 맞는 질문 확인 |
| 회원가입 UI | signup 페이지 — "*필수" 텍스트 없음 확인 |
| 테스트 | `services/siw` 테스트 전체 통과 |
