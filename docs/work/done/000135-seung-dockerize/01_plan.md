# [#135] chore: services/seung Dockerize — 구현 계획

> 작성: 2026-03-18

---

## 완료 기준

- [ ] `services/seung/Dockerfile` 작성 (node:20-alpine, multi-stage build)
- [ ] `services/seung/entrypoint.sh` 작성 (Prisma migrate deploy + node server.js)
- [ ] `docker build` 로컬 빌드 성공
- [ ] `docker run` 으로 서비스 정상 응답 확인
- [ ] `services/seung/.dockerignore` 작성 (node_modules/, .next/, .env* 등 제외)
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 구현 계획

### 사전 분석 (완료)

| 항목 | 상태 | 비고 |
|------|------|------|
| `GET /api/health` | ✅ 이미 존재 | 이슈 #132에서 완료 |
| `output: 'standalone'` | ❌ 없음 | next.config.ts 수정 필요 |
| `prisma.config.ts` | ❌ 없음 | siw와 달리 불필요, Dockerfile에서 복사 생략 |
| `DATABASE_URL` + `DIRECT_URL` | 필요 | schema.prisma에 directUrl 사용 |
| `pdf-parse` | serverExternalPackages 설정 있음 | 별도 처리 불필요 |

**참조 파일:** `services/siw/Dockerfile`, `services/siw/entrypoint.sh` (동일 패턴 적용)

---

### Step 1 — `next.config.ts` 수정

**파일:** `services/seung/next.config.ts`

`output: 'standalone'` 추가:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pdf-parse'],
};
```

> standalone 출력 없이는 runner 스테이지에서 `server.js`가 생성되지 않아 컨테이너가 기동 불가.

---

### Step 2 — `services/seung/Dockerfile` 작성

siw Dockerfile과 동일한 3-stage 구조. 아래 차이점만 반영:

1. `prisma.config.ts` COPY 라인 없음 (seung에 해당 파일 없음)
2. CRLF 제거 적용 (`RUN sed -i 's/\r$//' ./entrypoint.sh`) — Windows 체크아웃 환경 대응
3. 헬스체크: `/api/health` 엔드포인트 사용

```dockerfile
# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Stage 2: Next.js 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 타임 환경변수 (NEXT_PUBLIC_*는 빌드 시 번들에 인라인)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

RUN npx prisma generate
RUN npm run build

# Stage 3: 프로덕션 런너
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN sed -i 's/\r$//' ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./entrypoint.sh"]
```

---

### Step 3 — `services/seung/entrypoint.sh` 작성

siw entrypoint.sh와 동일:

```sh
#!/bin/sh
set -e

if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ]; then
  echo "ERROR: DATABASE_URL and DIRECT_URL must be set" >&2
  exit 1
fi

node node_modules/prisma/build/index.js migrate deploy

exec node server.js
```

---

### Step 4 — `services/seung/.dockerignore` 작성

```
node_modules/
.next/
.env*
coverage/
tests/
*.test.ts
*.test.tsx
*.spec.ts
playwright-report/
test-results/
.git/
```

---

### Step 5 — 로컬 빌드 검증

```bash
# services/seung 디렉토리에서 실행
docker build -t mirai-seung:local .
```

빌드 성공 확인 후:

```bash
docker run --rm \
  -e DATABASE_URL="..." \
  -e DIRECT_URL="..." \
  -p 3000:3000 \
  mirai-seung:local
```

`http://localhost:3000/api/health` → `{"status":"ok"}` 응답 확인.

---

### Step 6 — `services/seung/.ai.md` 최신화

Dockerfile, entrypoint.sh, .dockerignore 추가 내용을 `.ai.md`에 반영.

---

## 주의사항

- **`prisma.config.ts` 없음**: siw와 달리 seung에는 이 파일이 없으므로 Dockerfile에서 복사 생략. `migrate deploy`는 `DATABASE_URL` / `DIRECT_URL` 환경변수를 직접 사용.
- **CRLF 문제**: Windows에서 체크아웃 시 entrypoint.sh에 `\r` 삽입될 수 있음. Dockerfile에서 `sed -i 's/\r$//'`로 제거.
- **빌드 타임 NEXT_PUBLIC_* 변수**: `deploy-seung.yml`이 `--build-arg NEXT_PUBLIC_SUPABASE_URL`, `--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY`를 넘기므로 builder 스테이지에 ARG/ENV 선언 필수. 미선언 시 빌드는 성공하지만 값이 번들에 인라인되지 않음.
- **pdf-parse**: `serverExternalPackages`에 이미 등록되어 있어 standalone 빌드에서 자동 처리됨.
