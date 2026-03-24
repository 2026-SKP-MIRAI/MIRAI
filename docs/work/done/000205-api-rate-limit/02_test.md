# [#205] feat: [seung] API Rate Limiting — 테스트 결과

> 작성: 2026-03-24

---

## 최종 테스트 결과

### Vitest 단위 테스트

```
Test Files  16 passed (16)
Tests       152 passed (152)
Duration    ~4s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/lib/rate-limit.test.ts` | 5 | ✅ 전체 통과 | 신규 — 허용/차단/창 리셋/키 독립성/limit=1, `not.toBe(true)` + `typeof number` 검증 |
| `tests/api/questions.test.ts` | 21 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-answer.test.ts` | 13 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-generate.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-feedback.test.ts` | 14 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | makeRequest에 headers 모킹 추가 |
| `tests/api/dashboard.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-session.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/InterviewChat.test.tsx` | 17 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/AnswerInput.test.tsx` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 | 변경 없음 |

### TypeScript 빌드

```
npx tsc --noEmit → 에러 0건
```

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

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/lib/rate-limit.ts` | in-memory Map 기반 범용 rate limiter. `rateLimit(key, limit, windowMs): true \| number` + `_clearStoreForTesting()` | ✅ |
| `tests/lib/rate-limit.test.ts` | rateLimit 단위 테스트 5개 (허용/차단/창 리셋/키 독립성/limit=1) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/app/api/resume/questions/route.ts` | auth 체크 직후 userId 기반 rate limit (10/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/app/api/interview/start/route.ts` | auth 체크 직후 userId 기반 rate limit (10/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/app/api/interview/answer/route.ts` | auth 체크 직후 userId 기반 rate limit (30/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/app/api/report/generate/route.ts` | auth 체크 직후 userId 기반 rate limit (5/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/app/api/resume/feedback/route.ts` | auth 체크 직후 userId 기반 rate limit (10/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/app/api/practice/feedback/route.ts` | x-forwarded-for IP 기반 rate limit (20/min) + `Retry-After` 헤더 삽입 | ✅ |
| `src/lib/types.ts` | `ERROR_MESSAGES`에 429 추가 | ✅ |
| `src/app/api/dashboard/route.ts` | `Prisma.ResumeGetPayload` → 명시적 인터페이스 교체 (#208 성격의 기존 빌드 에러, 동일 브랜치에서 함께 수정) | ✅ |
| `tests/api/practice-feedback.test.ts` | `makeRequest`에 headers 모킹 추가 (IP: '127.0.0.1') | ✅ |
| `tests/setup.ts` | `beforeEach`에 `_clearStoreForTesting()` 추가 — 테스트 격리 | ✅ |
| `services/seung/.ai.md` | Phase 8 추가, rate-limit.ts·tests/lib/ 구조 업데이트, 에러 코드 표에 429 추가 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `tests/lib/rate-limit.test.ts` 5개 작성 → `src/lib/rate-limit.ts` 구현 → 5/5 통과
- 기존 147개 테스트 회귀 없음, 신규 5개 추가 → 152개 전체 통과

### 주요 디버깅

- **테스트 간 rate limit store 공유 문제**: in-memory Map이 모듈 싱글턴이므로 vitest 동일 프로세스 내 테스트 파일 간 상태 공유 발생
  → `_clearStoreForTesting()` 함수 추가 후 `tests/setup.ts`의 `beforeEach`에서 호출하여 해결

- **`practice-feedback.test.ts` headers 누락**: 기존 mock request에 `headers` 없어 `request.headers.get(...)` TypeError 발생
  → `makeRequest`에 `headers: { get: (key) => ... }` 모킹 추가하여 해결

- **`dashboard/route.ts` TypeScript 에러 (기존 버그)**: `Prisma.ResumeGetPayload`가 설치된 Prisma 버전에서 미지원
  → `SessionWithReport`, `ResumeWithSessions` 명시적 인터페이스로 교체하여 해결
