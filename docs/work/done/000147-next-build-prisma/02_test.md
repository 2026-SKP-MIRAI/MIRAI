# [#147] fix: [seung] next build 실패 — Prisma.JsonObject 타입 오류 — 테스트 결과

> 작성: 2026-03-19

---

## 최종 테스트 결과

### next build

```
▲ Next.js 16.1.6 (Turbopack)

✓ Compiled successfully in 12.0s
✓ Generating static pages (17/17)
```

### Vitest 단위·컴포넌트 테스트

```
Test Files  11 passed (11)
Tests       94 passed (94)
Duration    4.02s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/questions.test.ts` | 15 | ✅ 전체 통과 |
| `tests/api/resume-feedback.test.ts` | 11 | ✅ 전체 통과 |
| `tests/api/resume-diagnosis.test.ts` | 5 | ✅ 전체 통과 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 |
| `tests/api/interview-start.test.ts` | 6 | ✅ 전체 통과 |
| `tests/api/interview-answer.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/report-generate.test.ts` | 9 | ✅ 전체 통과 |
| `tests/api/report-get.test.ts` | 3 | ✅ 전체 통과 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### `src/app/api/resume/feedback/route.ts`

| # | 변경 | 결과 |
|---|------|------|
| 1 | `Prisma.JsonObject` → `Prisma.InputJsonValue` (line 89) | ✅ |
| 2 | `import { Prisma }` 유지 (InputJsonValue 사용) | ✅ |

### `src/app/api/resume/questions/route.ts`

| # | 변경 | 결과 |
|---|------|------|
| 1 | `catch((err)` → `catch((err: unknown)` (line 68) — 암시적 any 제거 | ✅ |

---

## 트러블슈팅 기록

#### `Record<string, unknown>` → `Prisma.InputJsonValue` 전환

- **현상**: `prisma generate` 후 `Record<string, unknown>`이 `InputJsonValue`에 할당 불가 오류 발생
- **원인**: Prisma v6 `Json` 필드 write 타입은 `InputJsonValue`이며 `Record<string, unknown>`과 구조적으로 불호환
- **해결**: `Prisma.InputJsonValue`로 교체 — Architect 사전 권고 반영

#### `@prisma/client` 미초기화 오류

- **현상**: TypeScript 통과 후 page data 수집 단계에서 `@prisma/client did not initialize yet` 런타임 오류
- **원인**: worktree에 `node_modules`가 없어 `prisma generate` 미실행 상태
- **해결**: `npx prisma generate` 실행 후 빌드 재시도
