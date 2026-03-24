# [#226] fix: [seung] dashboard route.ts diagnosisResult 타입 에러 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

- [ ] `npx tsc --noEmit` 에러 0건
- [ ] `deploy-seung.yml` 빌드 성공

---

## 구현 계획

`services/seung/src/app/api/dashboard/route.ts` 의 `ResumeWithSessions` 타입에서
`diagnosisResult: object | null` → `diagnosisResult: unknown` 으로 변경.

`diagnosisResult`는 `!== null` 체크에만 사용되므로 `unknown`으로 충분.
