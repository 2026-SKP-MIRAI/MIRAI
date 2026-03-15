# [#92] feat: siw 랜딩페이지 핵심 기능 섹션 문구 업그레이드 — 테스트

> 작성: 2026-03-15

---

## 테스트 파일

`services/siw/tests/ui/landing-page.test.tsx` (신규 생성)

---

## Mock 설정

| Mock 대상 | 이유 |
|-----------|------|
| `global.IntersectionObserver` | jsdom에 미구현 — FadeInSection이 사용 |
| `next/navigation` (useRouter) | 클라이언트 라우팅 의존성 차단 |
| `@/lib/supabase/browser` | 인증 상태 확인 로직 격리 |
| `@/components/landing/RadarChartInteractive` | 차트 렌더링 의존성 차단 |
| `@/components/landing/LayeredCardWrapper` | 래퍼 컴포넌트 의존성 차단 |

---

## 테스트 케이스

| # | 설명 | 검증 방법 | 결과 |
|---|------|----------|------|
| 1 | FEATURES 배지 "핵심 기능" 렌더링 | `getByText("핵심 기능")` | ✅ |
| 2 | FEATURES h2 "면접 준비의 새로운 기준" 렌더링 | `getByText("면접 준비의 새로운 기준")` | ✅ |
| 3 | PERSONAS h2 "실제 면접처럼, 더 실전같이" 렌더링 | `getByText(/실제 면접처럼/)` | ✅ |
| 4 | evaluation 섹션 id="evaluation" 존재 | `container.querySelector("#evaluation")` | ✅ |
| 5 | EVALUATION h2 "단순 점수가 아닌," 렌더링 | `getByText(/단순 점수가 아닌/)` | ✅ |
| 6 | NAV "평가시스템" 링크 href="#evaluation" | `getByRole("link", { name: "평가시스템" })` + `toHaveAttribute` | ✅ |

---

## 전체 테스트 결과

```
npx vitest run
✓ 106 tests passed (23 test files)
  - 기존 100개 통과 유지
  - 신규 landing-page.test.tsx 6개 추가
```
