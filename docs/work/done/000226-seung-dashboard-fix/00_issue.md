# fix: [seung] dashboard route.ts diagnosisResult 타입 에러 — 빌드 차단

## 문제

\`services/seung/src/app/api/dashboard/route.ts\` 의 \`ResumeWithSessions\` 타입에서 빌드 에러 발생.

\`\`\`
Type error: Type 'JsonValue' is not assignable to type 'object | null'.
  Type 'string' is not assignable to type 'object'.
\`\`\`

PR #217 머지 후 \`deploy-seung.yml\` 자동 트리거 → Docker 빌드 실패 → main 배포 차단 중.

## 원인

\`diagnosisResult: object | null\` 타입이 Prisma가 반환하는 \`JsonValue\` (string 포함)와 불일치.

## 수정 내용

\`\`\`ts
// before
diagnosisResult: object | null

// after
diagnosisResult: unknown
\`\`\`

\`diagnosisResult\`는 \`!== null\` 체크에만 사용되므로 \`unknown\`으로 충분.

## 완료 기준

- [x] \`npx tsc --noEmit\` 에러 0건
- [ ] \`deploy-seung.yml\` 빌드 성공

---

## 작업 내역

`services/seung/src/app/api/dashboard/route.ts` 의 `ResumeWithSessions` 타입에서
`diagnosisResult: object | null` → `diagnosisResult: unknown` 으로 1줄 수정.

Prisma의 `JsonValue` 타입은 `string | number | boolean | object | null` 의 유니온이므로
`object | null` 로 좁히면 타입 불일치 에러가 발생한다.
`diagnosisResult` 는 `!== null` 체크에만 사용되므로 `unknown` 으로 충분하며,
이것이 TypeScript에서 권장하는 타입 안전한 방식이다.

수정 후 `tsc --noEmit` 에러 0건 확인.
