# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
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

# schema 변경 시 Docker 캐시가 재사용되어도 최신 client 보장
RUN npx prisma generate
RUN npm run build

# Stage 3: 프로덕션 런너 (standalone 출력만 포함)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Prisma query engine이 libssl에 동적 링크됨 — 제거 시 DB 연결 불가
RUN apk add --no-cache openssl

# 보안: non-root user 실행
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# NOTE: services/siw/public/ 디렉토리가 없으므로 COPY 생략 (생기면 추가)

# Prisma CLI + client + schema + migrations 복사 (entrypoint에서 migrate deploy 실행용)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
# prisma.config.ts: migrate deploy 시 DIRECT_URL 사용 및 schema 경로 설정
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# entrypoint 스크립트 복사
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# 헬스체크: 30초 후 시작, 30초 간격, 5초 타임아웃, 3회 실패 시 unhealthy
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./entrypoint.sh"]
