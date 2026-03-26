# feat: [siw] 전체 페이지 모바일 반응형 개선

Issue #261

## 배경
대시보드·면접·이력서·성장 페이지가 고정 grid 레이아웃으로 구성되어 모바일 환경에서 컬럼이 겹치거나 잘려 보이는 문제가 있었다.

## 완료 기준
- [x] 주요 페이지(ObservabilityDashboard, GrowthPage, InterviewNew, ResumesPage)에서 고정 다열 grid가 반응형으로 변경된다
- [x] sm:/md: 브레이크포인트 사용
- [x] ReportResult 컴포넌트 모바일 반응형 적용
- [x] 테스트 통과

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `grid-cols-4` → `grid-cols-2 md:grid-cols-4`, `grid-cols-2` → `grid-cols-1 md:grid-cols-2` 패턴으로 일관되게 변경
- `col-span-2` → `md:col-span-2` — 모바일에서 full-width, 데스크탑에서 2칸
- `flex gap-2` → `flex flex-wrap gap-2` — 버튼 줄바꿈 지원

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx` | KPI 카드, 차트 2열, 응답속도+토큰 비율 grid 반응형 |
| `services/siw/src/app/(app)/growth/page.tsx` | 세션 목록·강점약점 패턴 grid 반응형 |
| `services/siw/src/app/(app)/interview/new/page.tsx` | 면접관 소개 3열 grid 반응형 |
| `services/siw/src/app/(app)/resumes/page.tsx` | 이력서 카드 버튼 flex-wrap 추가 |
| `services/siw/src/components/ReportResult.tsx` | 리포트 결과 컴포넌트 반응형 |
| `services/siw/src/app/(app)/dashboard/observability/.ai.md` | 신규 생성 |
| `services/siw/src/app/(app)/growth/.ai.md` | 신규 생성 |
| `services/siw/src/app/(app)/interview/new/.ai.md` | 신규 생성 |
| `services/siw/src/components/.ai.md` | 신규 생성 |

### 구현 상세
모든 변경은 기존 Tailwind 클래스에 `sm:` 또는 `md:` 접두사를 추가하는 방식으로 이루어졌다. 기존 동작·스타일에 영향 없이 모바일 breakpoint 이하에서만 단열 레이아웃으로 전환된다.
