# [#261] feat: 전체 페이지 모바일 반응형 개선 — 구현 계획

> 작성: 2026-03-26

---

## 배경

대시보드·면접·이력서·성장 페이지가 고정 grid 레이아웃으로 구성되어 모바일 환경에서 컬럼이 겹치거나 잘려 보이는 문제가 있었다.

## 완료 기준

- [x] ObservabilityDashboard, GrowthPage, InterviewNew, ResumesPage에서 고정 다열 grid가 반응형으로 변경된다
- [x] sm:/md: 브레이크포인트 사용
- [x] ReportResult 컴포넌트 모바일 반응형 적용
- [x] 테스트 통과

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx` | KPI 4열, 차트 2열, 응답속도 3열 반응형 |
| `services/siw/src/app/(app)/growth/page.tsx` | 세션 목록·강점약점 2열 반응형 |
| `services/siw/src/app/(app)/interview/new/page.tsx` | 면접관 소개 3열 반응형 |
| `services/siw/src/app/(app)/resumes/page.tsx` | 버튼 flex-wrap |
| `services/siw/src/components/ReportResult.tsx` | 리포트 결과 반응형 |

### 구현 상세

모든 변경은 기존 Tailwind 클래스에 sm:/md: 접두사를 추가하는 방식. 기존 동작·스타일에 영향 없이 모바일 breakpoint 이하에서만 단열 레이아웃으로 전환.

**패턴 1 — 4열 → 모바일 2열:**
```tsx
// 기존
<div className="grid grid-cols-4 gap-4">
// 변경
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
```

**패턴 2 — 2열 → 모바일 1열:**
```tsx
// 기존
<div className="grid grid-cols-2 gap-4">
// 변경
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

**패턴 3 — col-span:**
```tsx
// 기존
<div className="col-span-2">
// 변경
<div className="md:col-span-2">
```

**패턴 4 — flex wrap (resumes 버튼):**
```tsx
// 기존
<div className="flex gap-2 mt-3 items-center">
// 변경
<div className="flex flex-wrap gap-2 mt-3 items-center">
```

### 테스트 전략
기존 테스트 통과 확인 (반응형 클래스 변경은 스냅샷 테스트 없음).
