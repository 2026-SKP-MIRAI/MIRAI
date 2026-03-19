# [#147] fix: [seung] next build 실패 — Prisma.JsonObject 타입 오류 (resume/feedback/route.ts) — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [x] `src/app/api/resume/feedback/route.ts`에서 `Prisma.JsonObject` → `Prisma.InputJsonValue`으로 교체 (node_modules 생성 후 `Record<string, unknown>` 불호환 확인 → InputJsonValue로 전환)
- [x] `import { Prisma }` 유지 (InputJsonValue 사용으로 필요)
- [x] `next build` 성공 확인
- [x] 기존 Vitest 94개 전부 통과 (회귀 없음)

---

## 구현 계획

> Planner → Architect → Critic 컨센서스 완료 (APPROVE)

### RALPLAN-DR 요약

**Principles**
1. 최소 변경 — 빌드 오류만 제거, 동작 변경 없음
2. 타입 정확성 — 런타임 가드(line 81)를 근거로 캐스팅 근거 명확화
3. 의존성 정리 — 불필요해진 import 즉시 제거

**Decision Drivers**
1. `@prisma/client` v6에서 `Prisma.JsonObject` 타입 제거 → 빌드 차단
2. 변경 범위를 1파일/2줄로 최소화 → 회귀 위험 없음
3. 이슈 명세에서 교체 타입 명시 (`Record<string, unknown>`)

**Options**
| 옵션 | 선택 이유 |
|------|-----------|
| `Prisma.InputJsonValue` ✅ | Prisma v6 네이티브 타입, `prisma generate` 후 `Record<string, unknown>` 불호환 확인 → 전환 |
| `Record<string, unknown>` | 이슈 명세 초안이었으나 Prisma Json write 타입과 구조적 불호환으로 제외 |

---

### 구현 단계

**Step 1 — 타입 캐스팅 수정** (`route.ts:89`)

```ts
// Before
data: { diagnosisResult: data as Prisma.JsonObject }

// After
data: { diagnosisResult: data as Prisma.InputJsonValue }
```

근거: line 81 가드 통과 후 `data`는 non-null object임이 보장됨. `Prisma.InputJsonValue`는 Prisma v6에서 Json 필드 write 타입으로 `Record<string, unknown>` 대비 구조적으로 호환됨.

**Step 2 — import 유지** (`route.ts:2`)

```ts
// 유지 (InputJsonValue 사용)
import { Prisma } from '@prisma/client'
```

근거: `Prisma.InputJsonValue` 사용으로 import 필요.

**Step 3 — 빌드 검증**

```bash
cd services/seung && npx next build
```

**Step 4 — 테스트 회귀 확인**

```bash
npx vitest run
```

기존 94개 테스트 전부 PASS 확인.

---

### 변경 범위
- `services/seung/src/app/api/resume/feedback/route.ts` — `Prisma.JsonObject` → `Prisma.InputJsonValue` (1줄 수정)
- `services/seung/src/app/api/resume/questions/route.ts` — `catch((err)` → `catch((err: unknown)` (1줄 수정, 추가 발견)
- DB 스키마·API 계약·런타임 동작: 변경 없음
