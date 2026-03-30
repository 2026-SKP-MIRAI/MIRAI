# chore: [siw] observability-page 테스트 수정 — PR #313 변경사항 반영

## 목적
PR #313 머지 후 `Deploy siw to EC2` CI가 테스트 2건 실패로 배포 중단 상태.
테스트를 실제 컴포넌트 변경사항에 맞게 수정하여 CI를 통과시킨다.

## 배경
PR #313(observability 대시보드 전면 디벨롭)에서 다음이 변경되었으나 테스트가 미반영됨.
1. `<Bar>` (react-chartjs-2) 제거 → CSS 기반 모드 그룹 카드로 대체
2. 모드 그룹 카드(`interview/practice/resume`)에 `totalCalls` 숫자가 추가 렌더됨
   → mock 데이터의 42가 DOM에 2곳에 표시되어 `getByText("42")` 실패

## 완료 기준
- [x] `getByText("42")` → `getAllByText("42")` 사용으로 중복 허용
- [x] `getByTestId("bar-chart")` → `<Bar>` 제거됨, 모드 그룹 섹션("기능 그룹별 현황") 렌더 검증으로 대체
- [x] `Deploy siw to EC2` CI 통과

## 구현 플랜
`services/siw/tests/ui/observability-page.test.tsx` 2개 assertion 수정.
컴포넌트 변경 없음.

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-30

- `services/siw/tests/ui/observability-page.test.tsx`
  - `getByText("42")` → `getAllByText("42").length > 0` 수정
    - PR #313에서 추가된 모드 그룹 카드(interview/practice/resume)가 `totalCalls`를 렌더하면서 동일 숫자가 DOM 2곳에 표시됨. `getByText`는 단일 매칭을 요구하므로 `getAllByText`로 변경.
  - 테스트명 `"정상 데이터 → 차트: bar-chart, line-chart 존재"` → `"정상 데이터 → 차트·섹션: line-chart + 모드 그룹 현황 존재"`
  - `getByTestId("bar-chart")` 제거, `getByText("기능 그룹별 현황")` 추가
    - PR #313에서 `<Bar>` (react-chartjs-2) 가 제거되고 CSS 기반 모드 그룹 카드로 대체됨. bar-chart testid는 더 이상 렌더되지 않으므로 실제 UI에 존재하는 섹션 헤더 텍스트로 검증 방식 전환.

