#!/bin/sh
set -e

# 필수 환경변수 확인
if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ] || [ -z "$ENGINE_BASE_URL" ]; then
  echo "ERROR: DATABASE_URL, DIRECT_URL, and ENGINE_BASE_URL must be set" >&2
  exit 1
fi

# Prisma 마이그레이션 실행 (DIRECT_URL로 PgBouncer 우회 — prisma.config.ts 대신 env 오버라이드)
DATABASE_URL="$DIRECT_URL" node node_modules/prisma/build/index.js migrate deploy

# Next.js 서버 시작
exec node server.js
