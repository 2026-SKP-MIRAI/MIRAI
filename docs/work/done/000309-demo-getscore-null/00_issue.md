# fix: [siw] demo 페이지 getScoreColor null score 타입 에러로 빌드 실패

## 목적
demo 페이지 빌드 타입 에러를 수정한다.

## 배경
`item.score`가 `number | null` 타입인데 `getScoreColor(score: number)`에 직접 전달하여 TypeScript 빌드 실패 발생. PR #307 머지 후 Deploy siw to EC2 CI가 실패함.

```
./src/app/(landing)/demo/page.tsx:466:105
Type error: Argument of type 'number | null' is not assignable to parameter of type 'number'.
```

## 완료 기준
- [x] `item.score != null` 가드 추가로 TypeScript 빌드 통과
- [ ] Deploy siw to EC2 CI 성공

## 구현 플랜
1. `services/siw/src/app/(landing)/demo/page.tsx:439`
2. `getScoreColor(item.score)` → `item.score != null ? getScoreColor(item.score) : undefined`

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

`services/siw/src/app/(landing)/demo/page.tsx` 2곳 수정:
- `getScoreColor(item.score)` → `item.score != null ? getScoreColor(item.score) : undefined`
- `getBarStyle(item.score)` → `item.score != null ? getBarStyle(item.score) : undefined`

`AxisFeedback.score`가 `number | null`임에도 `number`만 받는 함수에 직접 전달해 빌드 타입 에러 발생. null 체크 가드를 추가해 해결. 로컬 `npm run build` 통과 확인.
