#!/bin/sh
set -e

# 필수 환경변수 확인
if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ]; then
  echo "ERROR: DATABASE_URL and DIRECT_URL must be set" >&2
  exit 1
fi

# Prisma 마이그레이션 실행
node node_modules/prisma/build/index.js migrate deploy

# Next.js 서버 시작
exec node server.js
