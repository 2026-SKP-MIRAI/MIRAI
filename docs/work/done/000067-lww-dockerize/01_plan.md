# [#67] chore: services/lww Dockerize — 구현 계획

> 작성: 2026-03-12

---

## 완료 기준

- [ ] `services/lww/next.config.ts` 에 `output: 'standalone'` 추가
- [ ] `services/lww/Dockerfile` 작성 (node:20-alpine, multi-stage 3단계)
- [ ] `docker build` 로컬 빌드 성공
- [ ] `docker run` 으로 `GET /` 응답 확인 (200 OK)
- [ ] `services/lww/.dockerignore` 작성 (node_modules/, .next/, .env* 등 제외)
- [ ] `services/lww/.ai.md` 최신화 (Docker 실행 정보 한 줄 추가)

---

## 구현 계획

### Step 1 — `services/lww/next.config.ts` 생성

**목표**: Next.js standalone 출력 활성화 (Docker runner 스테이지에서 `server.js`로 실행)

```ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

**근거**:
- `services/lww/package.json:14` — `"next": "^15.0.0"`, standalone output 지원
- standalone 모드: `.next/standalone/server.js`만으로 `node_modules` 없이 실행 → 이미지 크기 최소화
- 현재 `next.config.ts` 파일 없음 → 새로 생성

---

### Step 2 — `services/lww/Dockerfile` 작성

**목표**: 3단계 멀티스테이지 빌드로 경량 프로덕션 이미지 생성

```dockerfile
# Stage 1: 의존성 설치
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Next.js 빌드
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Stage 3: 프로덕션 런너 (standalone 출력만 포함)
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# 보안: non-root user 실행
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# standalone 빌드 결과물 복사
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# public/ 디렉토리 생기면 추가:
# COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
```

**근거**:
- `services/lww/package.json:6` — `"build": "next build"`
- `services/lww/.ai.md:13` — `src/app/page.tsx` ALB 헬스체크용 루트 페이지 → 포트 3000
- runner 스테이지: `node_modules` 불포함 → standalone이 최소 패키지 내장
- `HOSTNAME=0.0.0.0` — Docker 내부에서 외부 요청 수신 필수
- non-root user: 컨테이너 보안 모범 사례

---

### Step 3 — `services/lww/.dockerignore` 작성

```
node_modules/
.next/
.git/
.gitignore
*.md
.env
.env.*
tests/
playwright.config.ts
vitest.config.ts
```

**근거**:
- `node_modules/`, `.next/` — Dockerfile 내부에서 재생성
- `.env`, `.env.*` — 민감 정보 이미지 포함 방지
- `tests/`, `playwright.config.ts`, `vitest.config.ts` — 런타임 불필요

---

### Step 4 — 로컬 빌드·실행 검증

```bash
cd services/lww

# 빌드 (별도 build-arg 없음)
docker build -t mirai-lww .

# 실행 (현재 필요한 환경변수만)
docker run --rm -p 3000:3000 \
  -e ENGINE_BASE_URL=http://localhost:8000 \
  mirai-lww

# 헬스 확인
curl http://localhost:3000/
# 기대값: 200 OK (HTML 응답)
```

---

## 환경변수 처리

현재 코드에서 실제로 참조하는 환경변수만 관리한다.

| 변수 | 종류 | 주입 방식 |
|------|------|----------|
| `ENGINE_BASE_URL` | 서버 전용 (런타임) | `docker run -e` 또는 `--env-file` |

> Supabase 관련 변수(`NEXT_PUBLIC_SUPABASE_URL` 등)는 현재 코드에서 미사용. Auth/DB 구현 시 별도 이슈에서 추가.

---

## 검증 방법

| 항목 | 명령어 | 기대 결과 |
|------|--------|-----------|
| 빌드 성공 | `docker build -t mirai-lww .` | 오류 없이 완료 |
| 컨테이너 기동 | `docker run --rm -p 3000:3000 -e ENGINE_BASE_URL=... mirai-lww` | Next.js 서버 로그 출력 |
| 헬스 응답 | `curl http://localhost:3000/` | 200 OK (HTML) |
| non-root 확인 | `docker exec <id> id` | `uid=1001(nextjs)` |

---

## 환경변수 운영 가이드

### 로컬 개발

```bash
# services/lww/.env 파일로 관리 (git 미추적)
docker build -t mirai-lww .
docker run --rm -p 3000:3000 --env-file .env mirai-lww
```

### CI/CD (GitHub Actions + ECR)

```yaml
- name: Deploy to EC2
  run: |
    ssh ec2-user@<ip> "docker run -d -p 3000:3000 \
      -e ENGINE_BASE_URL=https://engine.mirainterview.com \
      <ecr-url>/mirai-lww:latest"
```

---

### Step 5 — `services/lww/.ai.md` 최신화

기존 `.ai.md`에 Docker 실행 정보 한 줄 추가:
- 실행 방식: Docker 컨테이너, 포트 3000, standalone 모드, `node server.js`

---

## 이번 이슈 범위 밖 (추후 고려)

- Supabase 환경변수 추가 — Auth/DB 구현 이슈에서 처리 (`NEXT_PUBLIC_SUPABASE_URL` 등)
- Graceful shutdown (ALB draining 대응) — Next.js `SIGTERM` 핸들링
- Docker 이미지 버전 고정 (`node:20.18-alpine`)
- ECR 리포지토리 생성 + GitHub Actions CI/CD 파이프라인

---

## 참고 파일

- `services/lww/package.json` — Next.js 15, Node 20 의존성
- `services/lww/src/app/page.tsx` — 루트 페이지 (ALB 헬스체크, 포트 3000)
- `services/lww/src/app/api/resume/questions/route.ts` — ENGINE_BASE_URL 사용 (서버 전용)
