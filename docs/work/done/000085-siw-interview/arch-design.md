# 000085 — Interview 신뢰성 개선: 아키텍처 설계

## 1. Zod 스키마 설계

파일 위치: `src/lib/interview/schemas.ts`

```typescript
import { z } from "zod";

// ─── 기본 열거형 ───────────────────────────────────────────
export const PersonaTypeSchema = z.enum(["hr", "tech_lead", "executive"]);

export const QuestionTypeSchema = z.enum(["main", "follow_up"]);

export const FollowupTypeSchema = z.enum(["CLARIFY", "CHALLENGE", "EXPLORE"]);

// ─── DB JSON 필드 스키마 ──────────────────────────────────
export const QueueItemSchema = z.object({
  persona: PersonaTypeSchema,
  type: QuestionTypeSchema,
});

export const HistoryItemSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  answer: z.string(),
  type: QuestionTypeSchema,
});

// ─── 엔진 응답 스키마 ─────────────────────────────────────

/** POST /api/interview/start 엔진 응답 */
export const QuestionWithPersonaSchema = z.object({
  persona: PersonaTypeSchema,
  personaLabel: z.string(),
  question: z.string(),
  type: QuestionTypeSchema.optional(),
});

export const EngineStartResponseSchema = z.object({
  firstQuestion: QuestionWithPersonaSchema,
  questionsQueue: z.array(QueueItemSchema),
});

/** POST /api/interview/answer 엔진 응답 */
export const EngineAnswerResponseSchema = z.object({
  nextQuestion: QuestionWithPersonaSchema.nullable(),
  updatedQueue: z.array(QueueItemSchema),
  sessionComplete: z.boolean(),
});

/** POST /api/interview/followup 엔진 응답 */
export const EngineFollowupResponseSchema = z.object({
  followupQuestion: z.string(),
  followupType: FollowupTypeSchema,
});

// ─── DB JSON 배열 스키마 (findById 파싱용) ────────────────
export const QueueItemArraySchema = z.array(QueueItemSchema);
export const HistoryItemArraySchema = z.array(HistoryItemSchema);

// ─── 리포트 관련 스키마 ───────────────────────────────────
export const AxisScoresSchema = z.object({
  communication: z.number(),
  problemSolving: z.number(),
  logicalThinking: z.number(),
  jobExpertise: z.number(),
  cultureFit: z.number(),
  leadership: z.number(),
  creativity: z.number(),
  sincerity: z.number(),
});

export const AxisFeedbackSchema = z.object({
  axis: z.string(),
  axisLabel: z.string(),
  score: z.number(),
  type: z.enum(["strength", "improvement"]),
  feedback: z.string(),
});

export const ReportResponseSchema = z.object({
  scores: AxisScoresSchema,
  totalScore: z.number(),
  summary: z.string(),
  axisFeedbacks: z.array(AxisFeedbackSchema),
  growthCurve: z.null(),
});
```

### 타입 호환성 검토

`z.infer<typeof XxxSchema>`로 추출한 타입은 기존 `types.ts`의 수동 타입과 **구조적으로 동일**하다.

| 기존 타입 (`types.ts`) | Zod 스키마 | 호환 |
|---|---|---|
| `PersonaType` | `z.infer<typeof PersonaTypeSchema>` = `"hr" \| "tech_lead" \| "executive"` | 동일 |
| `QueueItem` | `z.infer<typeof QueueItemSchema>` = `{ persona: PersonaType; type: "main" \| "follow_up" }` | 동일 |
| `HistoryItem` | `z.infer<typeof HistoryItemSchema>` | 동일 |
| `QuestionWithPersona` | `z.infer<typeof QuestionWithPersonaSchema>` | 동일 (`type?` optional 포함) |
| `InterviewAnswerResponse` | `z.infer<typeof EngineAnswerResponseSchema>` | 동일 |

**권장:** 기존 `types.ts`의 interview 관련 타입을 `z.infer<>`로 **대체**하지 않고, `schemas.ts`에서 스키마만 export하고 `types.ts`는 그대로 유지한다. 이유:

1. `types.ts`는 interview 외 다른 타입(Category, QuestionsResponse, UploadState 등)도 포함
2. 스키마와 수동 타입이 구조적으로 동일하므로 TypeScript가 자동 호환 처리
3. 점진적 마이그레이션 가능 — 나중에 `types.ts`에서 `z.infer<>`로 교체해도 breaking change 없음

---

## 2. 엔진 응답 캐싱 아키텍처

### 문제 시나리오

```
answer() 호출
  ├─ 1. engine POST /api/interview/answer  ← 성공 (LLM 비용 발생)
  ├─ 2. prisma.interviewSession.update()   ← 실패 (P2025, 네트워크 등)
  └─ 3. 클라이언트 재시도 → engine 다시 호출 → 중복 비용 + history 오염
```

### 해결: `answerDraft` 필드 기반 write-ahead 캐싱

#### 2-1. Prisma 스키마 변경

```prisma
model InterviewSession {
  // ... 기존 필드 ...
  answerDraft     String?   // engine 응답 JSON을 임시 저장
}
```

#### 2-2. 캐싱 로직 (pseudo-code)

```typescript
async answer(sessionId: string, currentAnswer: string) {
  const session = await interviewRepository.findById(sessionId);
  if (session.sessionComplete) throw new Error("session_complete");

  let engineResult: EngineAnswerResponse;

  // ── STEP 1: 캐시 확인 ──
  if (session.answerDraft) {
    // 이전 시도에서 engine 성공 → DB 실패한 경우
    // engine 재호출 없이 캐시된 응답 사용
    engineResult = EngineAnswerResponseSchema.parse(
      JSON.parse(session.answerDraft)
    );
  } else {
    // ── STEP 2: engine 호출 ──
    const resp = await callEngine("/api/interview/answer", { ... });
    engineResult = EngineAnswerResponseSchema.parse(await resp.json());

    // ── STEP 3: draft 저장 (write-ahead) ──
    // 이 시점에서 DB 쓰기가 실패해도 draft가 남아 재시도 가능
    await interviewRepository.saveAnswerDraft(
      sessionId,
      JSON.stringify(engineResult)
    );
  }

  // ── STEP 4: 최종 상태 업데이트 + draft 클리어 (원자적) ──
  const updatedHistory = [
    ...session.history,
    {
      persona: session.currentPersona,
      personaLabel: PERSONA_LABELS[session.currentPersona] ?? session.currentPersona,
      question: session.currentQuestion,
      answer: currentAnswer,
      type: session.currentQuestionType,
    },
  ];

  await interviewRepository.updateAfterAnswer(sessionId, {
    history: updatedHistory,
    questionsQueue: engineResult.updatedQueue,
    currentQuestion: engineResult.nextQuestion?.question ?? "",
    currentPersona: engineResult.nextQuestion?.persona ?? "",
    currentQuestionType: engineResult.nextQuestion?.type ?? "main",
    sessionComplete: engineResult.sessionComplete,
    answerDraft: null,  // ← draft 클리어 (원자적으로 같은 UPDATE문)
  });

  return engineResult;
}
```

#### 2-3. Prisma transaction 검토

**결론: transaction 불필요.**

- `saveAnswerDraft`와 `updateAfterAnswer`는 순차 실행이며 같은 row에 대한 단일 UPDATE
- `updateAfterAnswer`에서 `answerDraft: null`을 포함해 **하나의 `prisma.update()` 호출로 원자적 처리**
- PostgreSQL의 단일 UPDATE는 이미 원자적이므로 추가 transaction wrapper 불필요
- draft 저장(`saveAnswerDraft`)은 별도 UPDATE지만, 이것이 실패해도 engine 응답은 메모리에 있으므로 다음 `updateAfterAnswer`에서 정상 처리됨

#### 2-4. repository 시그니처 변경

```typescript
// interview-repository.ts에 추가
async saveAnswerDraft(id: string, draft: string): Promise<void> {
  await prisma.interviewSession.update({
    where: { id },
    data: { answerDraft: draft },
  });
}

// updateAfterAnswer 시그니처 확장
async updateAfterAnswer(
  id: string,
  data: {
    history: HistoryItem[];
    questionsQueue: QueueItem[];
    currentQuestion: string;
    currentPersona: string;
    currentQuestionType: "main" | "follow_up";
    sessionComplete: boolean;
    answerDraft: string | null;  // ← 추가: null로 설정하여 draft 클리어
  }
): Promise<void> {
  await prisma.interviewSession.update({ where: { id }, data });
}
```

#### 2-5. SessionSnapshot 타입 확장

```typescript
export type SessionSnapshot = {
  // ... 기존 필드 ...
  answerDraft: string | null;  // ← 추가
};
```

`findById()`에서도 `answerDraft: s.answerDraft ?? null` 매핑 추가.

---

## 3. 수정 패턴 pseudo-code

### 3-1. `interview-repository.ts` findById() — Zod 파싱 적용

```typescript
import { QueueItemArraySchema, HistoryItemArraySchema } from "./schemas";

async findById(id: string): Promise<SessionSnapshot> {
  const s = await prisma.interviewSession.findUniqueOrThrow({ where: { id } });

  // Zod parse — 잘못된 데이터는 즉시 실패 (silent corruption 방지)
  const questionsQueue = QueueItemArraySchema.parse(s.questionsQueue);
  const history = HistoryItemArraySchema.parse(s.history);

  return {
    id: s.id,
    resumeText: s.resumeText,
    currentQuestion: s.currentQuestion,
    currentPersona: s.currentPersona,
    currentQuestionType: QuestionTypeSchema.parse(s.currentQuestionType ?? "main"),
    questionsQueue,
    history,
    sessionComplete: s.sessionComplete,
    answerDraft: s.answerDraft ?? null,
  };
}
```

**에러 전략: throw (기본값 fallback 아님)**

- `z.parse()`는 실패 시 `ZodError`를 throw
- 기본값 fallback은 **데이터 손상을 숨기므로** 사용하지 않음
- caller(service/API route)에서 ZodError를 catch하여 500 + 로그로 처리
- 이유: DB에 잘못된 JSON이 들어간 경우는 **근본 원인을 수정해야 하는 버그**이지, 조용히 넘길 상황이 아님

### 3-2. `interview-service.ts` start() — Zod 파싱 적용

```typescript
import { EngineStartResponseSchema } from "./schemas";

async start(resumeId: string, personas: PersonaType[]) {
  // ... fetch 로직 동일 ...

  const parsed = EngineStartResponseSchema.parse(await resp.json());

  const sessionId = await interviewRepository.create({
    resumeText,
    currentQuestion: parsed.firstQuestion.question,
    currentPersona: parsed.firstQuestion.persona,
    currentQuestionType: parsed.firstQuestion.type ?? "main",
    questionsQueue: parsed.questionsQueue,
  });

  return { sessionId, firstQuestion: parsed.firstQuestion };
}
```

### 3-3. `interview-service.ts` answer() — 캐싱 + Zod 통합 (완전한 흐름)

```typescript
import { EngineAnswerResponseSchema } from "./schemas";
import type { InterviewAnswerResponse, PersonaType } from "@/lib/types";

async answer(sessionId: string, currentAnswer: string): Promise<InterviewAnswerResponse> {
  // 1. 세션 로드 (Zod 파싱된 안전한 데이터)
  const session = await interviewRepository.findById(sessionId);

  // 2. 완료 세션 차단
  if (session.sessionComplete) throw new Error("session_complete");

  let engineResult: z.infer<typeof EngineAnswerResponseSchema>;

  // 3. answerDraft 캐시 확인
  if (session.answerDraft) {
    engineResult = EngineAnswerResponseSchema.parse(
      JSON.parse(session.answerDraft)
    );
  } else {
    // 4. engine 호출 (기존 retry 로직 유지)
    const historyForEngine = session.history.map(({ type: _type, ...rest }) => rest);

    let resp: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      resp = await fetch(`${ENGINE_BASE_URL}/api/interview/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: session.resumeText,
          history: historyForEngine,
          questionsQueue: session.questionsQueue,
          currentQuestion: session.currentQuestion,
          currentPersona: session.currentPersona,
          currentAnswer,
        }),
        signal: AbortSignal.timeout(55000),
      });
      if (resp.ok) break;
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
    if (!resp?.ok) throw new Error("engine_answer_failed");

    // 5. Zod 파싱
    engineResult = EngineAnswerResponseSchema.parse(await resp.json());

    // 6. write-ahead: draft 저장
    await interviewRepository.saveAnswerDraft(
      sessionId,
      JSON.stringify(engineResult)
    );
  }

  // 7. history 구성
  const updatedHistory = [
    ...session.history,
    {
      persona: session.currentPersona as PersonaType,
      personaLabel: PERSONA_LABELS[session.currentPersona] ?? session.currentPersona,
      question: session.currentQuestion,
      answer: currentAnswer,
      type: session.currentQuestionType,
    },
  ];

  // 8. 최종 업데이트 + draft 클리어 (원자적)
  await interviewRepository.updateAfterAnswer(sessionId, {
    history: updatedHistory,
    questionsQueue: engineResult.updatedQueue,
    currentQuestion: engineResult.nextQuestion?.question ?? "",
    currentPersona: engineResult.nextQuestion?.persona ?? "",
    currentQuestionType: engineResult.nextQuestion?.type ?? "main",
    sessionComplete: engineResult.sessionComplete,
    answerDraft: null,
  });

  return {
    nextQuestion: engineResult.nextQuestion,
    updatedQueue: engineResult.updatedQueue,
    sessionComplete: engineResult.sessionComplete,
  };
}
```

### 3-4. followup() — Zod 파싱 적용

```typescript
import { EngineFollowupResponseSchema } from "./schemas";

async followup(sessionId: string, question: string, answer: string, persona: PersonaType) {
  const { resumeText } = await interviewRepository.findById(sessionId);

  const resp = await fetch(`${ENGINE_BASE_URL}/api/interview/followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, answer, persona, resumeText }),
    signal: AbortSignal.timeout(30000),
  });
  if (!resp.ok) throw new Error("engine_followup_failed");

  return EngineFollowupResponseSchema.parse(await resp.json());
}
```

---

## 4. 스키마 파일 위치 결정

### 결정: `src/lib/interview/schemas.ts` 신규 파일

**이유:**

| 선택지 | 장점 | 단점 |
|---|---|---|
| `types.ts`에 추가 | 한 파일에서 관리 | types.ts가 비대해짐, interview 외 타입과 혼재 |
| `interview/schemas.ts` 신규 | interview 도메인 응집, 스키마와 service/repo 가까움 | 파일 1개 추가 |

- `schemas.ts`는 `interview-service.ts`, `interview-repository.ts`와 **같은 디렉토리**에 위치
- interview 도메인의 **런타임 검증 로직**을 모아두는 역할
- `types.ts`는 변경하지 않음 — 기존 import는 그대로 유지
- 나중에 `types.ts`의 interview 타입을 `z.infer<>`로 교체할 때 자연스럽게 마이그레이션 가능

### 최종 파일 구조

```
src/lib/interview/
  ├── schemas.ts              ← 신규: Zod 스키마 (런타임 검증)
  ├── interview-service.ts    ← 수정: 엔진 응답 Zod parse + 캐싱
  └── interview-repository.ts ← 수정: DB JSON Zod parse + saveAnswerDraft 추가
```
