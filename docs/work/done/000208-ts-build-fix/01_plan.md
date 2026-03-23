# [#208] fix: [seung] TypeScript 빌드 에러 수정 — dashboard implicit any · Prisma.InputJsonValue — 구현 계획

> 작성: 2026-03-23

---

## 완료 기준

- [x] `src/app/api/dashboard/route.ts` implicit any 제거 (`let resumes` 타입 추론 실패)
- [x] `src/app/api/resume/feedback/route.ts` `Prisma.InputJsonValue` 타입 참조 오류 수정
- [x] `npx tsc --noEmit` 에러 0건

---

## 구현 계획

### 개요

두 파일의 TypeScript 타입 에러를 최소 변경으로 수정한다. 런타임 동작은 변경하지 않는다.

---

### Step 1 — `dashboard/route.ts` implicit any 수정

**파일:** `services/seung/src/app/api/dashboard/route.ts`

**문제:** `let resumes`를 타입 없이 선언 → try 블록 안에서 Prisma 반환값을 할당해도 TS가 타입 추론 불가 → `.map((resume) => ...)` 콜백 파라미터가 implicit any

**수정 방향:** `let resumes`에 명시적 타입 어노테이션 추가

```ts
// Before
let resumes

// After
import type { Prisma } from '@prisma/client'

let resumes: Awaited<ReturnType<typeof prisma.resume.findMany<{
  include: { sessions: { include: { report: true }; orderBy: { createdAt: 'asc' } } }
}>>>
```

또는 더 간단하게, try 블록에서 에러 시 early return하고 `const resumes = ...`를 try 블록 안에 두는 구조로 리팩토링:

```ts
// try 블록 안에서 const로 선언, 에러 시 return
const resumes = await prisma.resume.findMany({ ... })
// try 블록 끝에서 resumes 반환값 사용
```

→ **선택:** early return 방식이 더 단순하고 이슈 수정 방향과 일치 — try/catch 안에서 `const resumes`로 선언하고 정상 흐름을 try 안에 완성, catch에서 500 반환.

---

### Step 2 — `feedback/route.ts` Prisma.InputJsonValue 수정

**파일:** `services/seung/src/app/api/resume/feedback/route.ts`

**문제:** `Prisma.InputJsonValue`가 현재 설치된 Prisma client 버전에 export되지 않음

**수정:** `Prisma.InputJsonValue` → `Prisma.JsonValue`로 교체

```ts
// Before
data: { diagnosisResult: data as Prisma.InputJsonValue },

// After
data: { diagnosisResult: data as Prisma.JsonValue },
```

> 주의: `Prisma.JsonValue`도 없으면 `unknown` 또는 `object`로 fallback. 먼저 Prisma 버전 확인 후 결정.

---

### Step 3 — 타입 검증

```bash
cd services/seung && npx tsc --noEmit
```

에러 0건 확인.

---

### Step 4 — `.ai.md` 최신화

수정 완료 후 해당 디렉토리 `.ai.md`에 변경 내용 반영.

---

### 주의사항

- 런타임 동작 변경 없음 — 타입 어노테이션·캐스트만 수정
- Prisma 버전에 따라 사용 가능한 타입명이 다를 수 있음 → Step 2 전에 `package.json`에서 Prisma 버전 확인
- `InputJsonValue` vs `JsonValue`: Prisma v5+에서는 `InputJsonValue`가 제거됐을 가능성 있음
