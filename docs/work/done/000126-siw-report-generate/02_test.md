# [#126] fix: SIW report/generate 멱등성 & 동기화 수정 — 테스트 명세

> 작성: 2026-03-19

---

## 요약

| 항목 | 값 |
|------|-----|
| 총 테스트 수 | 6 |
| PASS | 6 |
| FAIL | 0 |
| 대상 파일 | `services/siw/tests/api/report-generate-route.test.ts` |
| 실행 명령 | `pnpm --filter siw test` |

---

## 파일별 테스트 목록

### `tests/api/report-generate-route.test.ts`

| # | 케이스 | HTTP | 상태 | 비고 |
|---|--------|------|------|------|
| 1 | history 5개 이상 세션 → 리포트 반환 | 200 | ✅ | `saveReport` 1회 호출 검증 포함 |
| 2 | sessionId 없을 때 | 400 | ✅ | body 없이 요청 |
| 3 | history < 5개 세션 | 422 | ✅ | `message`에 "최소 5개" 포함 검증 |
| 4 | Prisma P2025 에러 (존재하지 않는 sessionId) | 404 | ✅ | `PrismaClientKnownRequestError` code P2025 |
| 5 | engine fetch 실패 | 500 | ✅ | `global.fetch` reject 시뮬레이션 |
| 6 | sessionComplete === false 세션 (면접 미완료) | 400 | ✅ | `message === "면접이 완료되지 않은 세션입니다."` 검증 **(신규)** |

---

## 테스트 설계 상세

### 케이스 1 — 200: 정상 리포트 생성

**목적:** 세션 history 5개 이상 + sessionComplete=true 조건에서 엔진 호출 → DB 저장 → 응답 흐름 검증

**검증 포인트:**
- `res.status === 200`
- `data.totalScore === 76`
- `data.axisFeedbacks.length === 8`
- `interviewRepository.saveReport`가 정확히 1회 호출됨 (`toHaveBeenCalledOnce`)

**주요 Mock:**
```ts
global.fetch = vi.fn().mockResolvedValue({
  ok: true,      // ← saveWithRetry 실행 조건
  status: 200,
  json: async () => mockReportResponse,
});
```
> `ok: true` 누락 시 `saveReport`가 호출되지 않음. 이 케이스에서 발견된 숨겨진 버그.

---

### 케이스 2 — 400: sessionId 없을 때

**목적:** 요청 body에 `sessionId`가 없을 때 즉시 400 반환

**검증 포인트:**
- `res.status === 400`

---

### 케이스 3 — 422: history < 5개

**목적:** history가 5개 미만이면 422 반환

**검증 포인트:**
- `res.status === 422`
- `data.message`에 `"최소 5개"` 포함

**Mock 설정:**
```ts
history: mockSession.history.slice(0, 3)  // 5개 → 3개로 축소
```

---

### 케이스 4 — 404: Prisma P2025

**목적:** 존재하지 않는 sessionId 조회 시 DB에서 P2025 에러 → 404 반환

**검증 포인트:**
- `res.status === 404`

**Mock 설정:**
```ts
const p2025 = new Prisma.PrismaClientKnownRequestError("Not found", {
  code: "P2025",
  clientVersion: "5.0.0",
});
interviewRepository.findById.mockRejectedValueOnce(p2025);
```

---

### 케이스 5 — 500: engine fetch 실패

**목적:** 엔진 서버 통신 오류 시 500 반환

**검증 포인트:**
- `res.status === 500`

**Mock 설정:**
```ts
global.fetch.mockRejectedValueOnce(new Error("fetch failed"));
```

---

### 케이스 6 — 400: sessionComplete === false (신규 추가)

**목적:** 면접이 완료되지 않은 세션에 대해 리포트 생성 요청 시 400 반환 (AC #3)

**검증 포인트:**
- `res.status === 400`
- `data.message === "면접이 완료되지 않은 세션입니다."`

**Mock 설정:**
```ts
{ ...mockSession, userId: "user-123", sessionComplete: false }
```

**관련 상수:**
```ts
// services/siw/src/lib/error-messages.ts
sessionNotComplete: "면접이 완료되지 않은 세션입니다."
```

---

## Mock 구조 요약

| Mock 대상 | 방식 | 기본값 |
|-----------|------|--------|
| `interviewRepository.findById` | `vi.fn().mockResolvedValue(mockSession)` | 정상 세션 반환 |
| `interviewRepository.saveReport` | `vi.fn().mockResolvedValue(undefined)` | 성공 |
| `next/headers cookies` | `vi.fn().mockResolvedValue({ getAll: () => [] })` | 빈 쿠키 |
| `supabase auth.getUser` | `vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } })` | 인증 성공 |
| `global.fetch` | `beforeEach`에서 `ok: true, status: 200, json: mockReportResponse` | 엔진 정상 응답 |

---

## 작업 로그

| 날짜 | 내용 |
|------|------|
| 2026-03-19 | 케이스 1~5 기존 존재 확인, `saveReport` mock 누락 추가 |
| 2026-03-19 | fetch mock에 `ok: true` 누락 발견 및 수정 |
| 2026-03-19 | 케이스 6 (`sessionComplete === false → 400`) 신규 작성 (AC #3) |
| 2026-03-19 | 전체 6/6 PASS 확인 |

---

## 범례

| 아이콘 | 의미 |
|--------|------|
| ✅ | PASS |
| ❌ | FAIL |
| ⏭️ | SKIP |
