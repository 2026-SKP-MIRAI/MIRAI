# lww MVP 프론트엔드 — 디자인 리뷰 로그

> ralph 모드: 3 clean pass까지 반복. 각 라운드별 발견 이슈 → 수정 → 검증

---

## Round 1 — 2026-03-19

### 발견된 이슈

| 화면 | 이슈 | 심각도 |
|------|------|--------|
| 면접 기록 | EmptyState CTA 버튼이 기본 Shadcn 검정 스타일 — 브랜드 teal과 불일치 | 중 |
| 면접 기록 | "총 0회" 배지 스타일이 단순 `bg-teal-50` 클래스 | 낮음 |
| 온보딩 직군 선택 | 콘텐츠 절반 이하 → 하단 절반이 빈 `bg-gray-50` | 중 |
| 자소서 업로드 | 헤더 그라디언트 영역에 장식 요소 없음, py 여백 좁음 | 낮음 |

### 수정 사항

**1. `EmptyState.tsx` 리스타일**
- `Button` 컴포넌트 제거 → teal gradient CTA로 교체
- 아이콘 컨테이너: `rounded-full bg-muted` → `rounded-2xl rgba(13,148,136,0.08)`
- 버튼: `h-12 px-8 rounded-2xl` + `gradient(135deg, #0D9488, #0F766E)` + `boxShadow`
- gap: `4` → `5`

**2. `interview/page.tsx` 배지 스타일 개선**
- `bg-teal-50 text-[#0D9488] rounded-full px-3 py-1` → `background: rgba(13,148,136,0.1)` 인라인 스타일
- flex 레이아웃 추가: `flex items-center justify-between`
- py-4 → py-5, mb-4 → mb-5

**3. `JobCategorySelector.tsx` 하단 팁 섹션 추가**
- CTA 버튼 아래 팁 카드 추가
- `rgba(13,148,136,0.06)` 배경 + 1px teal border
- 💡 팁: 직군 선택 시 혜택 안내

**4. `resume/page.tsx` 헤더 장식 개선**
- `py-8` → `py-12` (단계적 증가)
- 장식 원 2개 추가 (절대 위치, opacity 10%)
- 그라디언트: `135deg` 방향 + `#134E4A` 끝 색상

---

## Round 2 — 2026-03-19

### 발견된 이슈

| 화면 | 이슈 | 심각도 |
|------|------|--------|
| 온보딩 슬라이더 slide 2,3 | 콘텐츠가 화면 하단에 몰림, 상단 40% 빈 공간 | 중 |
| 자소서 업로드 | 샘플 질문 카드에 번호 표시 없고 구분이 약함 | 낮음 |

### 수정 사항

**1. `OnboardingSlider.tsx` 슬라이드 레이아웃 개선**
- 슬라이드 div에 `h-full` 추가 (overflow-x-auto 컨테이너에서 height 명시적 상속)
- splash 슬라이드: `justify-center` 유지
- intro/result 슬라이드: `justify-center + paddingBottom: 200px` (inline style)
- gap: `gap-10` → `gap-7`
- 결과: 콘텐츠가 화면 상단 1/4 지점에서 시작, 빈 공간이 상단에서 하단으로 이동 ✅

**2. `resume/page.tsx` 샘플 질문 카드 리스타일**
- 번호 뱃지(1, 2, 3) teal 원 추가
- 카드: `rounded-2xl` + `border-left: 3px solid #0D9488`
- 라벨: 좌우 hr 구분선 + "이런 질문을 받을 수 있어요"

---

## Round 3 — 2026-03-19 ✅ Clean Pass 1/3

전체 화면 점검: 추가 수정사항 없음

| 화면 | 상태 |
|------|------|
| 01 스플래시 | ✅ |
| 02 온보딩 슬라이더 slide2 | ✅ |
| 02 온보딩 직군 선택 | ✅ |
| 03 면접 기록 | ✅ |
| 04 자소서 업로드 | ✅ |

---

## Round 4 — 2026-03-19 ✅ Clean Pass 2/3

전체 화면 점검: 추가 수정사항 없음 — Round 3와 동일 상태 유지

---

## Round 5 — 2026-03-19 ✅ Clean Pass 3/3

전체 화면 점검: 추가 수정사항 없음 — **3 consecutive clean passes 완료 → 작업 종료**

---

## 최종 변경사항 요약

| 파일 | 변경 내용 |
|------|-----------|
| `components/common/EmptyState.tsx` | CTA 버튼 teal gradient, 아이콘 rounded-2xl 컨테이너 |
| `app/(main)/interview/page.tsx` | "총 0회" 배지 스타일 개선, 레이아웃 조정 |
| `components/onboarding/JobCategorySelector.tsx` | 하단 팁 박스 추가 |
| `components/onboarding/OnboardingSlider.tsx` | slide h-full + paddingBottom 200px, gap-7 |
| `app/resume/page.tsx` | 헤더 py-12 + 장식 원 + 샘플 질문 번호 배지 카드 |
