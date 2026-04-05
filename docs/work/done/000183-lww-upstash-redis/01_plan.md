# [#183] chore: [fint] middleware.ts in-memory rate limiter → Upstash Redis 교체 — 구현 계획

> 작성: 2026-03-25
> Ralplan consensus: Planner → Architect → Critic (ITERATE → 계획 완성)

---

## 완료 기준

- [ ] Vercel 멀티 인스턴스 환경에서 IP당 10req/min 공유 카운터로 정상 작동
- [ ] in-memory Map 코드 완전 제거
- [ ] `.env.example`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 항목 추가
- [ ] `services/fint/.ai.md` 환경변수 섹션 업데이트

---

## RALPLAN-DR 요약

### Principles
1. **Stateless 인프라 호환성** — Vercel 서버리스에서 카운터 공유 필수 (모듈 스코프 Map은 인스턴스 간 공유 안 됨)
2. **최소 변경** — rate limit 블록만 교체, Supabase 세션 로직 불변
3. **Graceful degradation (fail-open)** — Redis 장애 시 서비스 가용성 우선, 경고 로그 출력
4. **기존 동작 유지** — key 패턴 (`ip:routePrefix`), 429 응답 형태 (한국어 메시지 + Retry-After)

### Decision Drivers
1. 인스턴스 간 카운터 공유 (핵심 문제 해결)
2. 기존 엔드포인트별 분리 카운터 동작 유지
3. 운영 복잡도 최소화 (관리형 서비스)

### Options
| | Option A: @upstash/ratelimit SDK (선택) | Option B: @upstash/redis INCR/EXPIRE |
|---|---|---|
| Pros | sliding window 내장, race condition 처리, Edge Runtime 최적화 | 세밀한 제어 |
| Cons | 외부 의존성 | race condition 직접 처리, 코드 복잡도 |
| 판정 | **채택** | 기각 |

---

## 구현 계획

### Step 1: 패키지 설치

```bash
cd services/fint
npm install @upstash/ratelimit @upstash/redis
```

- 변경 파일: `services/fint/package.json`, `services/fint/package-lock.json`
- 검증: `npm ls @upstash/ratelimit @upstash/redis` 성공
- 참고: 두 패키지 모두 Next.js Edge Runtime 호환 (REST API 기반, TCP 커넥션 불필요)

---

### Step 2: middleware.ts 교체

**교체 대상 (제거):**
- `middleware.ts:4` — `const rateLimitMap = new Map<...>()` (모듈 스코프 in-memory Map)
- `middleware.ts:6-8` — `RATE_LIMIT`, `WINDOW_MS` 상수
- `middleware.ts:20-39` — rate limit 블록 전체

**교체 내용 (추가):**

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// 환경변수 미설정 시: development → skip (경고만), production → 에러
let ratelimit: Ratelimit | null = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
  });
} else if (process.env.NODE_ENV === "production") {
  console.error("[middleware] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 미설정 — rate limit 비활성화됨 (보안 위험)");
} else {
  console.warn("[middleware] Upstash 환경변수 미설정 — rate limit 비활성화 (개발 환경)");
}
```

**rate limit 체크 로직 (기존 블록 교체):**

```typescript
// 기존 pathname 조건 그대로 유지
if (
  ratelimit &&
  (pathname.startsWith("/api/interview/") || pathname.startsWith("/api/resume/"))
) {
  const ip = getClientIP(request);
  // 기존 key 패턴 유지: ip:routePrefix
  const routePrefix = pathname.split("/").slice(0, 4).join("/");
  const key = `${ip}:${routePrefix}`;

  try {
    const { success, reset } = await ratelimit.limit(key);
    if (!success) {
      const retryAfter = Math.ceil((reset - Date.now()) / 1000);
      return NextResponse.json(
        { message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }
  } catch (err) {
    // fail-open: Redis 장애 시 서비스 가용성 우선
    console.error("[middleware] Redis rate limit 오류 (fail-open):", err);
  }
}
```

- Supabase 세션 갱신 로직 (`middleware.ts:42-69`) 불변
- 변경 파일: `services/fint/src/middleware.ts`
- 검증: `npm run build` 성공, TypeScript 에러 없음

---

### Step 3: 환경변수 업데이트

**`services/fint/.env.example`에 추가:**

```
# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token-here
```

**`services/fint/.ai.md` 업데이트:**
- 환경변수 테이블에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 두 항목 추가
- Rate limiting 설명에 "Upstash Redis sliding window 기반" 추가
- `.ai.md`의 `services/lww` 참조가 있으면 `services/fint`로 정정

- 변경 파일: `services/fint/.env.example`, `services/fint/.ai.md`
- 검증: 두 파일에 Upstash 변수 명시 확인

---

### Step 4: Vercel 대시보드 환경변수 등록 (별도 작업)

> **코드 변경과 별개로** Vercel 프로젝트 대시보드에서 등록 필요

- `UPSTASH_REDIS_REST_URL`: Upstash 콘솔 → Redis DB → REST URL
- `UPSTASH_REDIS_REST_TOKEN`: Upstash 콘솔 → Redis DB → REST Token
- PR 설명에 "Vercel 환경변수 등록 필요" 안내 포함

---

### Step 5: 테스트 작성

프레임워크: vitest (unit)

**테스트 파일:** `services/fint/tests/api/middleware.test.ts`
(vitest 설정: `tests/api/**` → node 환경. `src/__tests__/` 경로 사용 시 환경 불일치 가능)

**필수 케이스:**

1. **정상 요청 통과** — 10회 이하 요청 시 200 통과
2. **10회 초과 시 429** — `success: false` 반환 시 429 + Retry-After 헤더 포함, 한국어 메시지
3. **Retry-After 헤더 값** — `reset` 타임스탬프 기반 초 단위 계산 검증
4. **key 분리 동작** — 동일 IP + 다른 routePrefix가 별도 카운터 사용하는지 검증 (예: `/api/interview/start` ≠ `/api/resume/questions`)
5. **graceful degradation** — Redis 장애(`limit()` throw) 시 요청 통과 (fail-open)
6. **환경변수 미설정 (development)** — ratelimit null, rate limit 비활성화, 경고 로그 출력
7. **환경변수 미설정 (production)** — ratelimit null, 에러 로그 출력, 요청은 통과

---

## 엣지 케이스 및 주의사항

| 항목 | 내용 |
|------|------|
| **Redis 장애** | fail-open: 요청 통과, `console.error` 경고 로그 출력 |
| **환경변수 미설정 (dev)** | rate limit 비활성화 + `console.warn` |
| **환경변수 미설정 (prod)** | rate limit 비활성화 + `console.error` (서비스 중단 없음) |
| **sliding window vs fixed window** | 기존은 fixed window (`resetTime = now + WINDOW_MS`). Sliding window는 이전 윈도우 가중 카운트 포함 → 동일 패턴에서 더 일찍 429 발생 가능. 의도적 변경으로 간주 |
| **Redis RTT** | rate limit 대상 경로 (`/api/interview/`, `/api/resume/`)에만 Redis 호출 발생. matcher가 해당 경로에만 적용되는지 확인 필요 |
| **Upstash free tier** | 10,000 commands/day 한도. 트래픽 규모 확인 후 유료 플랜 검토 |
| **Edge Runtime 호환성** | `@upstash/ratelimit` + `@upstash/redis` 모두 Edge Runtime 지원 확인됨 |
| **롤백** | Redis 장애 또는 배포 문제 시 이전 커밋으로 revert (in-memory Map 복구) |

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `services/fint/package.json` | `@upstash/ratelimit`, `@upstash/redis` 추가 |
| `services/fint/src/middleware.ts` | in-memory Map 제거, Upstash SDK 교체 |
| `services/fint/.env.example` | Upstash 환경변수 2개 추가 |
| `services/fint/.ai.md` | 환경변수 섹션 + rate limiting 설명 업데이트 |
| `services/fint/tests/api/middleware.test.ts` | 테스트 7개 케이스 추가 |
