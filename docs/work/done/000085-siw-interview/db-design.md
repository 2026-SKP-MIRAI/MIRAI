# DB 설계 — Prisma 마이그레이션 + P2025 처리

> 작성일: 2026-03-13 | 담당: db-expert

---

## 1. Prisma 스키마 변경안

### 분석: `answerDraft String?` vs `engineResultCache Json?`

현재 `interviewService.answer()`의 흐름:
1. `findById()` — 세션 조회
2. engine fetch (최대 55초)
3. 결과로 history/queue 업데이트
4. `updateAfterAnswer()` — DB 저장

engine 결과를 임시 저장하는 목적은 **engine 중복호출 방지**다.
engine 응답(`nextQuestion`, `updatedQueue`, `sessionComplete`)은 JSON 구조이므로 `Json?` 타입이 더 자연스럽다.
그러나 `answerDraft String?` 하나로도 JSON.stringify/parse 패턴으로 충분히 처리 가능하다.

**결론**: `answerDraft String?` 단독으로 충분하다.
- `Json?`은 Prisma가 내부적으로 `jsonb` 컬럼으로 매핑하므로 별도 직렬화 불필요
- 그러나 캐시 구조가 단순하고(engine 응답 1개), 추후 타입 안전성을 위해 `Json?` 사용을 권장
- 두 필드 모두 추가할 이유 없음 — **`engineResultCache Json?` 하나로 통합**

### 변경 후 완전한 스키마

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}

datasource db {
  provider = "postgresql"
}

model InterviewSession {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  resumeText          String
  currentQuestion     String   @default("")
  currentPersona      String   @default("")
  currentQuestionType String   @default("main")
  questionsQueue      Json     @default("[]")
  history             Json     @default("[]")
  sessionComplete     Boolean  @default(false)
  userId              String?
  engineResultCache   Json?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @default(now()) @updatedAt

  @@map("interview_sessions")
}

model ResumeSession {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  resumeText String
  createdAt  DateTime @default(now())

  @@map("resume_sessions")
}
```

**변경사항**: `engineResultCache Json?` 필드 추가 (`@default(DbNull)` 불필요 — nullable 필드는 기본값이 NULL)

---

## 2. 마이그레이션 전략

### 실행 명령어

```bash
cd D:/project/T아카데미/MIRAI/MIRAI/.worktree/000085-siw-interview/services/siw
npx prisma migrate dev --name add-engine-result-cache
```

### Backward Compatibility

- `Json?` nullable 필드이므로 기존 레코드는 자동으로 `NULL` — 기존 데이터 영향 없음
- `@default(DbNull)` 어노테이션 불필요: Prisma는 nullable 필드에 대해 `DEFAULT NULL`을 PostgreSQL에 명시하지 않아도 됨 (PostgreSQL 기본 동작이 NULL)
- `NOT NULL` 제약 없으므로 기존 행에 대한 backfill 마이그레이션 불필요

### Supabase PostgreSQL 고려사항

- Supabase는 `jsonb` 타입을 네이티브 지원 — `Json?`은 `jsonb` 컬럼으로 생성됨
- `prisma migrate dev`는 shadow database가 필요: Supabase 프로젝트 설정 > Database > Connection string에서 `?pgbouncer=true` 제거한 direct URL 사용
- `DATABASE_URL`에 direct connection URL 설정 확인 필요 (pgBouncer 경유 시 migration 실패 가능)
- 실제 배포 시: `npx prisma migrate deploy` (shadow DB 불필요)

---

## 3. P2025 에러 처리 설계

### 현재 코드 분석

| 메서드 | 동작 |
|--------|------|
| `findUniqueOrThrow()` | 레코드 없으면 `PrismaClientKnownRequestError { code: "P2025" }` 자동 throw |
| `update({ where: { id } })` | 레코드 없으면 `PrismaClientKnownRequestError { code: "P2025" }` throw |

**현재 문제**: `updateAfterAnswer()`의 `prisma.interviewSession.update()`는 P2025를 throw하지만, 호출 스택 어디에서도 이를 잡지 않아 route.ts의 catch 블록까지 전파된다.

`route.ts` 현재 catch:
```typescript
const status =
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
```
이미 P2025 → 404 매핑이 있다. **route.ts 수준 처리는 이미 올바르다.**

### 처리 위치 결정: Repository 계층

**결론: `interview-repository.ts`의 `updateAfterAnswer()`에서 처리한다.**

이유:
- Repository는 DB 계층의 에러를 도메인 에러로 변환하는 책임을 가짐
- Service 계층이 Prisma 내부 에러 코드(`P2025`)에 의존하지 않아야 함 (계층 분리)
- Route.ts의 P2025 catch는 `findById()`의 `findUniqueOrThrow()`가 throw하는 경우를 위한 것으로 남겨둠
- `updateAfterAnswer()`에서 P2025 → 의미있는 도메인 에러(`session_not_found`)로 변환

### 구체적 코드 패턴

```typescript
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

async updateAfterAnswer(
  id: string,
  data: {
    history: HistoryItem[];
    questionsQueue: QueueItem[];
    currentQuestion: string;
    currentPersona: string;
    currentQuestionType: "main" | "follow_up";
    sessionComplete: boolean;
    engineResultCache?: object | null;
  }
): Promise<void> {
  try {
    await prisma.interviewSession.update({ where: { id }, data });
  } catch (e) {
    if (e instanceof PrismaClientKnownRequestError && e.code === "P2025") {
      throw new Error("session_not_found");
    }
    throw e;
  }
}
```

---

## 4. updateAfterAnswer() 시그니처 변경

```typescript
async updateAfterAnswer(
  id: string,
  data: {
    history: HistoryItem[];
    questionsQueue: QueueItem[];
    currentQuestion: string;
    currentPersona: string;
    currentQuestionType: "main" | "follow_up";
    sessionComplete: boolean;
    engineResultCache?: object | null; // null = 캐시 클리어, undefined = 변경 안 함
  }
): Promise<void>
```

**캐싱 사용 패턴 (service 계층):**

```typescript
// 1단계: engine 호출 전 캐시 확인 (선택적 최적화)
// 현재 구현에서는 engine 호출 후 결과를 캐시에 저장하는 단방향 흐름이 더 단순

// engine 결과 저장 시:
await interviewRepository.updateAfterAnswer(sessionId, {
  history: updatedHistory,
  questionsQueue: updatedQueue,
  currentQuestion: nextQuestion?.question ?? "",
  currentPersona: nextQuestion?.persona ?? "",
  currentQuestionType: nextQuestion?.type ?? "main",
  sessionComplete,
  engineResultCache: null, // 업데이트 완료 후 캐시 클리어
});
```

---

## 5. interview-answer/route.ts 에러 처리 매핑

### 현재 route.ts 분석

```typescript
// 현재 (route.ts:23-28)
try {
  const result = await interviewService.answer(sessionId, trimmedAnswer);
  return Response.json(result);
} catch (e) {
  if (e instanceof Error && e.message === "session_complete")
    return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
  const status =
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
  return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
}
```

### 추가 필요 사항

`updateAfterAnswer()`가 `session_not_found` 도메인 에러를 throw하도록 변경하면, route.ts에서도 이를 처리해야 한다:

```typescript
// 변경 후 route.ts
} catch (e) {
  if (e instanceof Error && e.message === "session_complete")
    return Response.json({ message: "이미 완료된 면접 세션입니다." }, { status: 400 });
  if (e instanceof Error && e.message === "session_not_found")
    return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status: 404 });
  const status =
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025" ? 404 : 500;
  return Response.json({ message: ENGINE_ERROR_MESSAGES.interviewAnswerFailed }, { status });
}
```

**주의**: 기존 `P2025` 직접 체크(`Prisma.PrismaClientKnownRequestError`)는 `findById()`의 `findUniqueOrThrow()`가 throw하는 경우를 위해 유지한다. `updateAfterAnswer()`의 P2025는 이제 `session_not_found`로 변환되어 위의 분기에서 처리됨.

---

## 요약

| 항목 | 결정 |
|------|------|
| 새 필드 | `engineResultCache Json?` (nullable, default NULL) |
| `answerDraft` 추가 여부 | 불필요 — `engineResultCache`로 통합 |
| 마이그레이션 | `npx prisma migrate dev --name add-engine-result-cache` |
| Backward compat | nullable이므로 기존 데이터 영향 없음 |
| P2025 처리 위치 | `interview-repository.ts`의 `updateAfterAnswer()` |
| 도메인 에러 변환 | P2025 → `throw new Error("session_not_found")` |
| route.ts 추가 | `session_not_found` → 404 분기 추가 |
