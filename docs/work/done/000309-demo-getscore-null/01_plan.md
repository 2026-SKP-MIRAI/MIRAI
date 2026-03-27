# [#309] fix: [siw] demo 페이지 getScoreColor null score 타입 에러로 빌드 실패 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [ ] `item.score != null` 가드 추가로 TypeScript 빌드 통과
- [ ] Deploy siw to EC2 CI 성공

---

## 구현 계획

`services/siw/src/app/(landing)/demo/page.tsx:466`
- `getScoreColor(item.score)` → `item.score != null ? getScoreColor(item.score) : undefined`
