# feat: [seung] API Rate Limiting — LLM 호출 엔드포인트 요청 제한

## 사용자 관점 목표

일부 사용자의 반복 요청이 다른 사용자의 서비스 품질에 영향을 주지 않는다.

## 배경

엔진을 호출하는 API들은 LLM API를 사용하므로 호출당 비용이 발생한다. Rate limiting 없이 공개될 경우 반복 요청으로 인한 비용 과다 및 서비스 불안정 위험이 있다.

> **구현 방식**: 내부 테스트 단계이므로 in-memory Map 기반으로 구현한다.
> **⚠️ 한계**: in-memory는 단일 프로세스 내에서만 유효하다. Vercel 등 서버리스 환경에서는 인스턴스 간 공유가 안 되므로, 외부 공개 전 Upstash Redis로 교체가 필요하다.

제한 대상 엔드포인트:

| 엔드포인트 | 인증 여부 | Rate limit 기준 |
|-----------|---------|----------------|
| `POST /api/resume/questions` | 인증 필요 | userId 기준 |
| `POST /api/interview/start` | 인증 필요 | userId 기준 |
| `POST /api/interview/answer` | 인증 필요 | userId 기준 |
| `POST /api/report/generate` | 인증 필요 | userId 기준 |
| `POST /api/resume/feedback` | 인증 필요 | userId 기준 |
| `POST /api/practice/feedback` | **인증 없음** | **IP 기준** |

**작업 위치:** `services/seung`

## 완료 기준

- [x] 인증 필요 5개 엔드포인트에 userId 기반 rate limit 적용
- [x] `practice/feedback`에 IP 기반 rate limit 적용
- [x] 제한 초과 시 429 응답 + 친화적 메시지 반환
- [x] 클라이언트에서 429 수신 시 안내 메시지 표시

## 구현 플랜

### 1. Rate limiter 유틸 (`src/lib/rate-limit.ts`)

userId 또는 IP 키 기반으로 동작하는 범용 인터페이스:

```ts
const store = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const record = store.get(key)
  if (!record || now > record.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (record.count >= limit) return false
  record.count++
  return true
}
```

### 2. userId 기반 적용 (인증 엔드포인트 5개)

```ts
const allowed = rateLimit(`${user.id}:resume/questions`, 10, 60_000) // 1분 10회
if (!allowed) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429 }
  )
}
```

### 3. IP 기반 적용 (`practice/feedback`)

```ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
const allowed = rateLimit(`ip:${ip}:practice/feedback`, 20, 60_000) // 1분 20회
```

### 4. 클라이언트 429 처리 (`src/lib/types.ts`)

```ts
export const ERROR_MESSAGES: Record<number, string> = {
  // 기존...
  429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
}
```

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/lib/rate-limit.ts` | 신규 — in-memory rate limiter |
| `src/app/api/resume/questions/route.ts` | userId 기반 rate limit 적용 |
| `src/app/api/interview/start/route.ts` | userId 기반 rate limit 적용 |
| `src/app/api/interview/answer/route.ts` | userId 기반 rate limit 적용 |
| `src/app/api/report/generate/route.ts` | userId 기반 rate limit 적용 |
| `src/app/api/resume/feedback/route.ts` | userId 기반 rate limit 적용 |
| `src/app/api/practice/feedback/route.ts` | IP 기반 rate limit 적용 |
| `src/lib/types.ts` | ERROR_MESSAGES에 429 추가 |

## 개발 체크리스트

- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음
- [ ] 추후 Upstash Redis 교체 가능하도록 인터페이스 분리 (`rateLimit` 함수 시그니처 유지)


---

## 작업 내역

### 구현 요약

LLM API를 호출하는 6개 엔드포인트에 in-memory Map 기반 rate limiting을 적용했다.

### 변경 파일

| 파일 | 내용 |
|------|------|
| `src/lib/rate-limit.ts` (신규) | `rateLimit(key, limit, windowMs)` — 단일 프로세스 in-memory Map 구현. 추후 Upstash Redis 교체를 위해 시그니처 고정. `_clearStoreForTesting()` 테스트 격리용 포함. |
| `api/resume/questions/route.ts` | auth 체크 직후 `${userId}:resume/questions` 키로 10회/분 제한 |
| `api/interview/start/route.ts` | auth 체크 직후 `${userId}:interview/start` 키로 10회/분 제한 |
| `api/interview/answer/route.ts` | auth 체크 직후 `${userId}:interview/answer` 키로 30회/분 제한 (연속 답변 고려) |
| `api/report/generate/route.ts` | auth 체크 직후 `${userId}:report/generate` 키로 5회/분 제한 (비용 큰 엔드포인트) |
| `api/resume/feedback/route.ts` | auth 체크 직후 `${userId}:resume/feedback` 키로 10회/분 제한 |
| `api/practice/feedback/route.ts` | `x-forwarded-for` IP 기준 `ip:{ip}:practice/feedback` 키로 20회/분 제한 (미인증 엔드포인트) |
| `src/lib/types.ts` | `ERROR_MESSAGES`에 429 추가 |
| `api/dashboard/route.ts` | `Prisma.ResumeGetPayload` 미지원 TypeScript 에러 수정 (기존 버그) — 명시적 인터페이스로 교체 |
| `tests/lib/rate-limit.test.ts` (신규) | 허용/차단/창 리셋/키 독립성/limit=1 단위 테스트 5개 |
| `tests/api/practice-feedback.test.ts` | `makeRequest`에 `headers` 모킹 추가 |
| `tests/setup.ts` | `beforeEach`에서 `_clearStoreForTesting()` 호출 — 테스트 간 Map 상태 격리 |

### 기술적 결정

- **in-memory 선택 이유**: 내부 테스트 단계이므로 Redis 설정 없이 빠르게 구현. 함수 시그니처를 고정해 Redis 교체 시 구현만 교체.
- **`interview/answer` 30회/분**: 면접 세션 중 연속 답변 흐름을 막지 않도록 다른 엔드포인트보다 여유 있게 설정.
- **`report/generate` 5회/분**: LLM 호출 비용이 가장 크므로 가장 엄격하게 제한.
- **테스트 격리**: 모듈 싱글턴 Map이 vitest 동일 프로세스 내 공유되어 테스트 간 카운터 누적 → `_clearStoreForTesting()`으로 해결.

