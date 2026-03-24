# [#205] feat: [seung] API Rate Limiting — LLM 호출 엔드포인트 요청 제한 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

- [x] 인증 필요 5개 엔드포인트에 userId 기반 rate limit 적용
- [x] `practice/feedback`에 IP 기반 rate limit 적용
- [x] 제한 초과 시 429 응답 + 친화적 메시지 반환
- [x] 클라이언트에서 429 수신 시 안내 메시지 표시

---

## 구현 계획

### Step 1. `src/lib/rate-limit.ts` 신규 생성

in-memory Map 기반 범용 rate limiter. 추후 Upstash Redis 교체를 위해 함수 시그니처 고정.

```ts
// key: "{userId}:{endpoint}" 또는 "ip:{ip}:{endpoint}"
// limit: 창 내 최대 요청 수
// windowMs: 창 크기 (ms)
// 반환: true(허용) / false(초과)
export function rateLimit(key: string, limit: number, windowMs: number): boolean
```

**Rate limit 값 (이슈 기준)**

| 엔드포인트 | 키 형식 | limit | window |
|-----------|---------|-------|--------|
| `resume/questions` | `{userId}:resume/questions` | 10 | 60s |
| `interview/start` | `{userId}:interview/start` | 10 | 60s |
| `interview/answer` | `{userId}:interview/answer` | 30 | 60s |
| `report/generate` | `{userId}:report/generate` | 5 | 60s |
| `resume/feedback` | `{userId}:resume/feedback` | 10 | 60s |
| `practice/feedback` | `ip:{ip}:practice/feedback` | 20 | 60s |

> `interview/answer`는 면접 흐름상 연속 호출이 많으므로 30회로 넉넉하게 설정.
> `report/generate`는 비용이 가장 크므로 5회로 제한.

### Step 2. 인증 엔드포인트 5개에 userId 기반 rate limit 적용

각 route 파일에서 `supabase.auth.getUser()` 직후 (기존 auth 체크 바로 아래) 삽입:

```ts
const allowed = rateLimit(`${user.id}:resume/questions`, 10, 60_000)
if (!allowed) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429 }
  )
}
```

수정 파일:
- `src/app/api/resume/questions/route.ts`
- `src/app/api/interview/start/route.ts`
- `src/app/api/interview/answer/route.ts`
- `src/app/api/report/generate/route.ts`
- `src/app/api/resume/feedback/route.ts`

### Step 3. `practice/feedback`에 IP 기반 rate limit 적용

인증 없는 엔드포인트. `request` 객체에서 IP 추출 후 rate limit 체크:

```ts
const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
const allowed = rateLimit(`ip:${ip}:practice/feedback`, 20, 60_000)
if (!allowed) {
  return NextResponse.json(
    { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    { status: 429 }
  )
}
```

수정 파일:
- `src/app/api/practice/feedback/route.ts`

### Step 4. `src/lib/types.ts` — ERROR_MESSAGES에 429 추가

기존 `ERROR_MESSAGES` 객체에 항목 추가:

```ts
429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
```

### Step 5. 클라이언트 429 처리 확인

`ERROR_MESSAGES`를 사용하는 클라이언트 컴포넌트에서 429가 자동으로 처리되는지 확인.
별도 분기 코드가 필요한 경우 추가.

### Step 6. 테스트 작성

`services/seung/tests/lib/rate-limit.test.ts` 신규 생성:
- 허용 케이스: 한도 이하 요청 → `true` 반환
- 차단 케이스: 한도 초과 요청 → `false` 반환
- 창 리셋 케이스: 창 만료 후 → 카운트 초기화
- 키 독립성: 다른 키는 서로 영향 없음

### Step 7. `.ai.md` 최신화

`services/seung/.ai.md`에 rate limiting 관련 내용 업데이트.

---

## 주의사항

- **in-memory 한계**: 단일 프로세스에서만 유효. Vercel 서버리스 환경에서는 인스턴스 간 공유 불가 → 외부 공개 전 Upstash Redis 교체 필요 (함수 시그니처는 동일하게 유지)
- **IP 스푸핑**: `x-forwarded-for`는 신뢰할 수 없으나, 내부 테스트 단계에서는 충분
- **`interview/answer` 동시성**: 면접 세션 중 빠른 연속 답변이 가능하도록 한도 여유 있게 설정
