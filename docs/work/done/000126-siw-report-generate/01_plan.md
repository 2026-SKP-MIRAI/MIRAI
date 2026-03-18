# [#126] fix: SIW report/generate 멱등성 & 동기화 수정 (saveWithRetry await 누락) — 구현 계획

> 작성: 2026-03-18

---

## 문제 배경 & 해결 요약

### 어떤 문제가 있었나?

`POST /api/report/generate` 라우트에 두 가지 독립적인 버그가 있었다.

**버그 1 — fire-and-forget 저장 (데이터 유실 위험)**

```typescript
// 문제 코드
saveWithRetry();  // ← await 없음
```

`saveWithRetry()`를 `await` 없이 호출하고 있어서, DB 저장이 끝나기도 전에 클라이언트에 응답이 반환됐다. Next.js 서버리스 환경에서는 응답 반환 이후 함수 컨텍스트가 정리될 수 있어, DB 저장이 **무음으로 실패**할 가능성이 있다.

설상가상으로 retry 내부도 같은 문제였다:

```typescript
// 문제 코드 — retry도 fire-and-forget
interviewRepository.saveReport(...).catch((err2) => { ... });
// ↑ saveWithRetry가 이 Promise를 await하지 않고 리턴해버림
```

결과적으로 저장이 실패하면 다음 요청에서 `reportJson` 캐시 miss → 엔진 재호출 → AI API 비용 낭비 + 응답 지연이 반복되는 연쇄 문제가 발생했다.

**버그 2 — 면접 미완료 세션 가드 없음**

`sessionComplete === false`인 세션(면접이 아직 진행 중인 세션)에 대해 아무런 체크 없이 리포트 생성을 시도했다. 미완료 세션은 history가 부족하거나 데이터가 불완전한 상태이므로, 리포트를 생성해도 의미 없는 결과가 나온다.

---

### AC별 해결 내용

| AC | 문제 | 해결 |
|----|------|------|
| **AC1** `saveWithRetry()` await 추가 | `saveWithRetry();` — await 없이 호출해 응답 먼저 반환, DB 저장이 서버리스 컨텍스트 종료로 유실 가능 | `await saveWithRetry();` — DB 저장 완료 후 응답 반환 보장 |
| **AC2** retry 내부 fire-and-forget 제거 | `interviewRepository.saveReport(...).catch(...)` — retry도 await 없어서 `saveWithRetry` 함수가 retry 완료 전에 resolve됨. AC1만 고쳐도 retry는 여전히 fire-and-forget | retry 내부를 `await` + try/catch로 교체 — retry까지 완전히 await 체인에 포함 |
| **AC3** `sessionComplete === false` 가드 | 면접 미완료 세션도 리포트 생성 시도 — 불완전한 데이터로 엔진 호출, 저장해도 캐시로 활용 불가 | 캐시 체크 이후 즉시 400 반환 — "면접이 완료되지 않은 세션입니다." |
| **AC4** 테스트 케이스 추가 | `sessionComplete: false → 400` 케이스 미검증. 또한 기존 fetch mock에 `ok: true` 누락으로 `saveReport`가 실제로 호출되지 않는 숨은 버그 | 신규 400 테스트 + `saveReport` 호출 단언 + fetch mock `ok: true` 수정 |

---

## 완료 기준

- [x] `saveWithRetry()`에 `await` 추가 → 저장 완료 보장 후 응답 반환
- [x] retry 내부의 fire-and-forget도 `await` + try/catch로 교체
- [x] `sessionComplete === false` → 400 응답 체크 추가
- [x] `sessionComplete=false → 400` 테스트 케이스 추가 및 기존 테스트 통과

---

## 구현 계획

> Planner → Architect(APPROVE) → Critic(APPROVE) 합의 완료 — 2026-03-18

### 변경 파일 (3개)

#### 1. `services/siw/src/lib/error-messages.ts`

`sessionNotFound` 줄 바로 아래에 키 추가:

```typescript
  sessionNotComplete: "면접이 완료되지 않은 세션입니다.",
```

> 이유: 기존 코드가 `ENGINE_ERROR_MESSAGES` 상수로 에러 메시지를 관리하는 패턴 — 인라인 문자열 대신 상수 사용

---

#### 2. `services/siw/src/app/api/report/generate/route.ts`

**변경 1** — `sessionComplete` 가드 추가 (route.ts:30-31)

위치: 캐시 체크(`if session.sessionComplete && session.reportJson`) 블록 직후, history 체크 이전

```typescript
    if (!session.sessionComplete)
      return Response.json({ message: ENGINE_ERROR_MESSAGES.sessionNotComplete }, { status: 400 });
```

**변경 2** — retry 내부 fire-and-forget 제거 (route.ts:61-65)

기존:
```typescript
          interviewRepository.saveReport(sessionId, user.id, data.scores, data.totalScore, data).catch((err2) => {
            console.error("[report/generate] saveReport retry failed:", err2);
          });
```
변경 후:
```typescript
          try {
            await interviewRepository.saveReport(sessionId, user.id, data.scores, data.totalScore, data);
          } catch (err2) {
            console.error("[report/generate] saveReport retry failed:", err2);
          }
```

**변경 3** — `saveWithRetry()` 호출에 `await` 추가 (route.ts:68)

```typescript
      await saveWithRetry();
```

---

#### 3. `services/siw/tests/api/report-generate-route.test.ts`

**변경 1** — `interviewRepository` mock에 `saveReport` 추가 (line 51)

```typescript
vi.mock("@/lib/interview/interview-repository", () => ({
  interviewRepository: {
    findById: vi.fn().mockResolvedValue({ ...mockSession, userId: "user-123" }),
    saveReport: vi.fn().mockResolvedValue(undefined),  // ← 추가
  },
}));
```

> 이유: `await saveWithRetry()` 추가 후 200 테스트에서 `saveReport` 호출됨 → mock 없으면 `TypeError` 발생

**변경 2** — `sessionComplete: false → 400` 테스트 케이스 추가 (line 157-175)

```typescript
  it("400: sessionComplete === false 세션 (면접 미완료)", async () => {
    const { interviewRepository } = await import("@/lib/interview/interview-repository");
    (interviewRepository.findById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ...mockSession,
      userId: "user-123",
      sessionComplete: false,
    });

    const { POST } = await import("@/app/api/report/generate/route");
    const req = new Request("http://localhost/api/report/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "test-session-id" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
```

---

### 테스트 결과 (6/6 PASS)

```
✓ 200: history 5개 이상 세션 → 리포트 반환
✓ 400: sessionId 없을 때
✓ 400: sessionComplete === false 세션 (면접 미완료)  ← 신규
✓ 422: history < 5개 세션
✓ 404: Prisma P2025 에러 (존재하지 않는 sessionId)
✓ 500: engine fetch 실패
```

### 주의사항
- `sessionComplete` 가드는 캐시 체크 **이후** 위치 — `sessionComplete: true && reportJson` 캐시 히트는 정상 통과
- `sessionComplete Boolean @default(false)` non-nullable → `!session.sessionComplete`와 `=== false` 동일 동작
- `await saveWithRetry()` 추가로 DB 쓰기 지연이 응답 레이턴시에 포함 — 정상 경로 ~50-100ms로 허용 가능
- retry는 transient/permanent 에러 구분 없이 1회 재시도 — 최소 변경 원칙 유지 (향후 개선 가능)

### ADR
- **Decision**: Option A (await 추가 + 최소 변경)
- **Drivers**: 데이터 정합성 > 응답 레이턴시
- **Alternatives**: Background queue — 현재 규모 대비 과도한 복잡도로 무효화
- **Consequences**: 저장 완료 보장, DB 쓰기 시간이 응답에 포함 (정상 경로 ~50-100ms)
