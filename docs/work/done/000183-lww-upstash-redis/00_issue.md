# chore: [lww] middleware.ts in-memory rate limiter → Upstash Redis 교체

## 목적
Vercel 서버리스 멀티 인스턴스 환경에서 rate limit이 실질적으로 작동하도록 in-memory Map 방식을 Upstash Redis 공유 카운터로 교체한다.

## 배경
현재 `middleware.ts`의 IP당 10req/min 제한이 `Map<string, {count, resetAt}>`으로 구현돼 있다. Vercel은 요청마다 새 인스턴스가 뜰 수 있어 인스턴스별로 카운터가 분리되고, 실질적으로 rate limit이 우회 가능한 상태다. 홍보·트래픽 증가 전에 수정 필요.

## 완료 기준
- [x] Vercel 멀티 인스턴스 환경에서 IP당 10req/min 공유 카운터로 정상 작동
- [x] in-memory Map 코드 완전 제거
- [x] `.env.example`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 항목 추가
- [x] `services/fint/.ai.md` 환경변수 섹션 업데이트

## 구현 플랜
1. Upstash 콘솔에서 Redis DB 생성 → REST URL·Token 발급
2. `@upstash/ratelimit` + `@upstash/redis` 패키지 설치
3. `middleware.ts` — in-memory Map 제거, `Ratelimit.slidingWindow(10, '1 m')` 교체
4. Vercel 대시보드 환경변수 등록

## 참고
- Upstash Ratelimit 패턴: `@upstash/ratelimit` 공식 docs
- 현재 구현: `services/lww/src/middleware.ts` (in-memory, MVP only 주석 있음)

## 개발 체크리스트
- [ ] `services/lww/.ai.md` 최신화

---

## 작업 내역

### 2026-03-25

**현황**: 0/4 완료

**완료된 항목**:
- 없음

**미완료 항목**:
- Vercel 멀티 인스턴스 환경에서 IP당 10req/min 공유 카운터로 정상 작동
- in-memory Map 코드 완전 제거
- `.env.example`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 항목 추가
- `services/fint/.ai.md` 환경변수 섹션 업데이트

**변경 파일**: 0개 (구현 계획 작성 완료, 구현 시작 전)

### 2026-03-28

**현황**: 4/4 완료

**완료된 항목**:
- Vercel 멀티 인스턴스 환경에서 IP당 10req/min 공유 카운터로 정상 작동
- in-memory Map 코드 완전 제거
- `.env.example`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 항목 추가
- `services/fint/.ai.md` 환경변수 섹션 업데이트

**미완료 항목**:
- 없음

**변경 파일**: 5개 (`middleware.ts`, `.env.example`, `.ai.md`, `package.json`, `package-lock.json`) + `tests/api/middleware.test.ts` (신규)

### 2026-04-05

**현황**: 4/4 완료

**완료된 항목**:
- Vercel 멀티 인스턴스 환경에서 IP당 10req/min 공유 카운터로 정상 작동
- in-memory Map 코드 완전 제거
- `.env.example`에 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 항목 추가
- `services/fint/.ai.md` 환경변수 섹션 업데이트

**미완료 항목**:
- 없음

**변경 파일**: 6개 (미커밋 상태 — `middleware.ts`, `.env.example`, `.ai.md`, `package.json`, `package-lock.json`, `tests/api/middleware.test.ts`)

