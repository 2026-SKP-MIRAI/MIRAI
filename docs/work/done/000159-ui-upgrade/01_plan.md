# [#159] feat: [seung] UI 고도화 — 구현 계획

> 작성: 2026-03-22
> Planner → Architect(ITERATE) → Critic(ITERATE) → 피드백 반영 완료

---

## 완료 기준

- [x] `/login`, `/signup` 페이지 UI 고도화
- [x] `/resume` 페이지 UI 고도화 — 업로드 폼, 질문 리스트, 면접 시작/서류 진단 분기 카드
- [x] UploadForm 드래그&드롭 + 파일 크기(5MB 이하)·형식(PDF) 안내 텍스트 추가
- [x] `/interview` 페이지 UI 고도화 — 채팅 UI, 답변 입력 폼, 리포트 생성 버튼
- [x] `/report` 페이지 UI 고도화 — 총점, 8축 점수, 피드백 레이아웃
- [x] `/diagnosis` 페이지 UI 고도화 — 항목별 점수, 강점·약점·개선 방향
- [x] `/dashboard` 페이지 UI 고도화 (이슈 #157 이후)
- [x] 전체 페이지 공통 색상·타이포그래피·간격 일관성 확보
- [x] 로딩·에러·빈 상태 피드백 UI 일관성 확보
- [x] 모바일 반응형 대응
- [x] 기존 Vitest/E2E 회귀 없음 (UI 변경으로 인한 셀렉터 업데이트 포함)
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

> **dashboard 조건부 완료**: 이슈 #157이 미완료 상태이면 dashboard 페이지는 CSS 토큰 적용(최소 변경)만 진행하고 이번 PR AC에서 제외. #157 완료 후 별도 작업.

---

## RALPLAN-DR

### Principles (5)
1. **점진적 개선** — 기존 기능 로직(fetch, state, router)을 건드리지 않고 스타일링·마크업만 변경.
2. **디자인 토큰 우선** — `globals.css` CSS 변수에 색상/간격/radius를 정의하고 `@theme inline`에서 Tailwind 토큰으로 매핑.
3. **테스트 안정성** — 버튼 텍스트·role·aria-label 등 E2E/Vitest 셀렉터 의존 문자열 보존. 각 Step 완료 후 즉시 테스트 검증.
4. **외부 의존성 최소화** — 순수 Tailwind CSS v4 스택 유지, 외부 UI 라이브러리 미추가.
5. **모바일 우선 반응형** — 기본 레이아웃 모바일 기준, `sm:`/`md:`/`lg:` breakpoint으로 확장.

### Decision Drivers (Top 3)
1. **기존 테스트 회귀 방지** — 35+ Vitest + 26+ E2E 테스트, 텍스트/role 기반 셀렉터 사용 중.
2. **일관성 확보 속도** — CSS 변수 토큰으로 7개 페이지·4개 컴포넌트를 한 번에 통일.
3. **UploadForm 드래그&드롭** — AC 필수 기능, 기존 `<input>` 보존 전략이 핵심.

### ADR: 헤더 통합 방식 → **Option C (Hybrid)**

| Option | 장점 | 단점 |
|--------|------|------|
| A. layout.tsx 전면 통합 | 코드 중복 제거 | E2E 셀렉터 10+ 파일 파손 위험 |
| B. 페이지별 헤더 완전 유지 | 테스트 영향 제로 | 헤더 마크업 중복 (6개 페이지) |
| **C. Hybrid (선택)** | 최소 공통 요소만 layout, 페이지 제목은 page.tsx 유지 | 경계 관리 필요 |

**결정**: `layout.tsx`에 로고(좌) + 로그아웃(우) nav-bar만 추가. 페이지별 `<header>` 제목은 각 page.tsx에서 유지. `/login`·`/signup`에서는 pathname 기반으로 nav-bar 숨김.

### 셀렉터 보존 목록 (변경 금지)
- **버튼**: `질문 생성`, `다시 하기`, `면접 시작하기`, `서류 진단받기`, `실전 모드`, `연습 모드`, `확인`, `답변 제출`, `다시 시작`, `리포트 생성하기`, `리포트 생성 중...`, `다시 답변하기`, `다음 질문`, `진단하기`, `홈으로`, `나가기`, `새 면접 시작`, `로그인`, `가입 중...`, `회원가입`
- **텍스트**: `예상 면접 질문`, `면접 모드를 선택해주세요`, `면접이 완료되었습니다.`, `다음 단계를 선택하세요`, `꼬리질문`, `HR 면접관`, `기술 리드`, `항목별 점수`, `강점`, `약점`, `개선 방향`, `자소서 분석`
- **레이블/플레이스홀더**: `PDF 파일` (aria-label, **sr-only 유지 필수**), `답변을 입력하세요...`

---

## 구현 계획

### Step 1: 디자인 토큰 시스템 구축

**파일**: `src/app/globals.css`

**변경 내용**:
- `:root`에 CSS 변수 추가:
  ```
  --color-primary: #1a1a2e       /* 메인 버튼, 헤더 텍스트 */
  --color-primary-hover: #16213e
  --color-accent: #4361ee        /* 보조 버튼, 링크, 강조 */
  --color-accent-hover: #3a56d4
  --color-surface: #ffffff       /* 카드 배경 */
  --color-background: #f8f9fa   /* 페이지 배경 */
  --color-border: #e5e7eb        /* 카드 테두리 */
  --color-text-primary: #111827
  --color-text-secondary: #6b7280
  --color-text-muted: #9ca3af
  --color-success: #10b981
  --color-warning: #f59e0b
  --color-danger: #ef4444
  --radius-card: 1rem
  --radius-button: 0.5rem
  --radius-input: 0.5rem
  --shadow-card: 0 1px 3px rgba(0,0,0,0.08)
  --shadow-card-hover: 0 4px 12px rgba(0,0,0,0.1)
  --persona-hr: #3b82f6
  --persona-tech: #22c55e
  --persona-exec: #a855f7
  ```
- `@theme inline` 블록에 위 변수 Tailwind 토큰 매핑 추가
- **다크 모드**: 기존 `@media (prefers-color-scheme: dark)` 블록(line 15-20)에도 동일 변수 오버라이드 추가

**검증 게이트**: `pnpm build` 에러 없음

---

### Step 2: layout.tsx 최소 수정 (Option C nav-bar)

**파일**: `src/app/layout.tsx`

**변경 내용**:
- 현재 `fixed top-3 right-4` 로그아웃 버튼을 `<nav>` bar로 교체
- nav-bar 구조: 좌측 `MirAI` 로고 텍스트, 우측 로그아웃 버튼
- `/login`·`/signup`에서 nav-bar 숨김 (Next.js `headers()` 또는 pathname 기반)
- 클라이언트 상태 필요 시 별도 `<NavBar>` client component 분리
- **각 페이지 `<header>` 제목은 건드리지 않음**

**검증 게이트** (Step 2 완료 직후 — 가장 중요):
```bash
cd services/seung && pnpm test run        # Vitest 전체
# E2E는 dev server 필요 시 별도 실행
```
실패 즉시 원인 파악 + 수정.

---

### Step 3: 인증 페이지 UI 고도화 (login, signup)

**파일**: `src/app/login/page.tsx`, `src/app/signup/page.tsx`

**변경 내용**:
- 카드 상단 MirAI 브랜드 텍스트/로고
- 카드 스타일: `--radius-card`, `--shadow-card`, `--color-surface` 토큰 적용
- 입력 필드 포커스 링: accent 토큰으로 통일
- 에러 메시지: `bg-red-50 border border-red-200 text-red-700 rounded-lg p-3` 패턴
- 소셜 로그인 버튼 UI (카카오/구글) — Supabase Auth 연동 완료 (#179), UI만 추가
- 반응형: `max-w-sm sm:max-w-md`
- 배경 그라데이션 (순수 CSS)

**보존 필수**: `role="alert"`, `로그인`, `가입 중...`, `회원가입`

**검증 게이트**: `pnpm test run` 통과

---

### Step 4: 핵심 페이지 UI 고도화 (resume, interview)

**파일**: `src/components/UploadForm.tsx`, `src/components/QuestionList.tsx`, `src/app/resume/page.tsx`, `src/components/InterviewChat.tsx`, `src/components/AnswerInput.tsx`, `src/app/interview/page.tsx`

**UploadForm 드래그&드롭 구현 전략**:
- 드롭 존 wrapper `<div>` 추가 (`onDragOver` / `onDragLeave` / `onDrop`)
- 기존 `<input type="file" aria-label="PDF 파일">` → `className="sr-only"` 적용 (**`hidden`·`display:none` 절대 금지** — Playwright `setInputFiles()` 호환 필수)
- 드롭 시 `e.dataTransfer.files[0]` → 기존 `setSelectedFile` 파이프라인 전달
- 드래그 중 시각 피드백: `border-dashed` + 배경색 변경
- 상시 안내 텍스트: "PDF 파일만 가능, 최대 5MB"

**resume 페이지**:
- 분기 카드: 토큰 적용, `hover:scale-[1.02] transition-transform`
- 모드 선택 카드 시각적 구분 강화

**interview 페이지**:
- 채팅 버블: 질문(좌측) / 답변(우측) 정렬
- 페르소나 뱃지화 (텍스트 내용 `HR 면접관`, `기술 리드` 유지)
- 진행률 텍스트 → CSS `width` 기반 프로그레스 바

**검증 게이트**:
```bash
cd services/seung && pnpm test run
# UploadForm.test.tsx, QuestionList.test.tsx, InterviewChat.test.tsx, AnswerInput.test.tsx 통과 확인
```

---

### Step 5: 결과 페이지 UI 고도화 (report, diagnosis, dashboard)

**파일**: `src/app/report/page.tsx`, `src/app/diagnosis/page.tsx`, `src/app/dashboard/page.tsx`

**report 페이지**:
- 총점: 큰 숫자 + 색상 등급 텍스트 (SVG 게이지는 복잡도 대비 위험 있어 보류)
- 8축 프로그레스 바: `h-2` → `h-3` + `transition-[width]`
- `md:grid-cols-2` 2열 그리드

**diagnosis 페이지**:
- report와 동일한 프로그레스 바 스타일
- 강점/약점 섹션 아이콘 추가 (체크마크/경고)

**dashboard 페이지**:
- #157 미완료 시: CSS 토큰 + `md:grid-cols-2`만 적용 (최소 변경)
- #157 완료 시: 전면 고도화 (빈 상태 UI, 통계 요약 등)

**검증 게이트**: `pnpm test run` 통과

---

### Step 6: 모바일 반응형 통합 + 최종 테스트 + .ai.md 최신화

**파일**: 전체 페이지/컴포넌트, `tests/`, `services/seung/.ai.md`

**변경 내용**:
- 320px 이상 레이아웃 최종 확인
- `max-w-` 페이지별 조정: 인증 `max-w-sm sm:max-w-md` / 콘텐츠 `max-w-2xl md:max-w-3xl`
- 최종 전체 테스트 실행 + 잔여 셀렉터 수정:
  ```bash
  cd services/seung && pnpm test run
  cd services/seung && pnpm exec playwright test
  ```
- `.ai.md` 최신화: UI 고도화 완료 내용 반영

**최종 성공 기준**:
- `pnpm test run` 전체 통과 (138개+)
- `pnpm exec playwright test` 전체 통과 (26개+)
- 모바일 320px 레이아웃 깨짐 없음
- `.ai.md` 최신화 완료

---

## 변경 파일 요약

| 파일 | Step | 변경 유형 |
|------|------|-----------|
| `src/app/globals.css` | 1 | CSS 변수 토큰 추가 + dark mode 확장 |
| `src/app/layout.tsx` | 2 | 최소 nav-bar 추가 (Option C) |
| `src/app/login/page.tsx` | 3 | UI 고도화 + 소셜 로그인 버튼 |
| `src/app/signup/page.tsx` | 3 | UI 고도화 |
| `src/components/UploadForm.tsx` | 4 | 드래그&드롭 추가 (sr-only input 유지) |
| `src/components/QuestionList.tsx` | 4 | UI 고도화 |
| `src/app/resume/page.tsx` | 4 | UI 고도화 |
| `src/components/InterviewChat.tsx` | 4 | 채팅 UI 고도화 |
| `src/components/AnswerInput.tsx` | 4 | UI 고도화 |
| `src/app/interview/page.tsx` | 4 | UI 고도화 |
| `src/app/report/page.tsx` | 5 | UI 고도화 |
| `src/app/diagnosis/page.tsx` | 5 | UI 고도화 |
| `src/app/dashboard/page.tsx` | 5 | 토큰 적용 (조건부 고도화) |
| `tests/components/*.test.tsx` | 각 Step | 셀렉터 즉시 수정 |
| `tests/e2e/*.spec.ts` | 각 Step | 셀렉터 즉시 수정 |
| `services/seung/.ai.md` | 6 | 최신화 |
