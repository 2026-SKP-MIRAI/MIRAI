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
| `Record<string, unknown>` ✅ | 이슈 명세 일치, 가드 통과 후 타입 정확, node_modules 미설치 환경에서 즉시 확인 가능 |
| `Prisma.InputJsonObject` | Prisma v6 native 타입이나 node_modules 없어 존재 확인 불가, 추후 필요 시 전환 |

---

### 구현 단계

**Step 1 — 타입 캐스팅 수정** (`route.ts:89`)

```ts
// Before
data: { diagnosisResult: data as Prisma.JsonObject }

// After
data: { diagnosisResult: data as Record<string, unknown> }
```

근거: line 81 가드(`typeof data !== 'object' || data === null || Array.isArray(data)`)를 통과한 후이므로 `Record<string, unknown>` 캐스팅은 타입적으로 정확.

**Step 2 — 불필요 import 제거** (`route.ts:2`)

```ts
// 삭제
import { Prisma } from '@prisma/client'
```

근거: 파일 내 `Prisma.` 사용처가 line 89 하나뿐. Step 1 수정 후 완전히 불필요.

**Step 3 — 빌드 검증**

```bash
cd services/seung && npx next build
```

**Step 4 — 테스트 회귀 확인**

```bash
npx vitest run
```

기존 92개 테스트 전부 PASS 확인.

---

### 변경 범위
- `services/seung/src/app/api/resume/feedback/route.ts` — `Prisma.JsonObject` → `Prisma.InputJsonValue` (1줄 수정)
- `services/seung/src/app/api/resume/questions/route.ts` — `catch((err)` → `catch((err: unknown)` (1줄 수정, 추가 발견)
- DB 스키마·API 계약·런타임 동작: 변경 없음
