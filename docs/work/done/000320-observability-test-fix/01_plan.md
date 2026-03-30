# [#320] chore: [siw] observability-page 테스트 수정 — PR #313 변경사항 반영

> 작성: 2026-03-30

---

## 완료 기준

- [ ] `getByText("42")` → `getAllByText("42")` 사용으로 중복 허용
- [ ] `getByTestId("bar-chart")` → `<Bar>` 제거됨, 모드 그룹 섹션("기능 그룹별 현황") 렌더 검증으로 대체
- [ ] `Deploy siw to EC2` CI 통과

---

## 구현 계획

`services/siw/tests/ui/observability-page.test.tsx` 2개 assertion 수정.
컴포넌트 변경 없음.

### 변경 대상
- `tests/ui/observability-page.test.tsx`
  1. line 83: `getByText("42")` → `getAllByText("42").length > 0`
  2. line 87-94: 테스트명 + `bar-chart` testid → `기능 그룹별 현황` 텍스트 검증
