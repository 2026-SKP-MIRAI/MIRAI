#!/bin/sh
set -e

# 필수 환경변수 확인
if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ] || [ -z "$ENGINE_BASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "ERROR: DATABASE_URL, DIRECT_URL, ENGINE_BASE_URL, and SUPABASE_ANON_KEY must be set" >&2
  exit 1
fi

# Prisma 마이그레이션 실행 (DIRECT_URL로 PgBouncer 우회)
DATABASE_URL="$DIRECT_URL" ./node_modules/.bin/prisma migrate deploy

# Next.js 서버 시작
exec node server.js
