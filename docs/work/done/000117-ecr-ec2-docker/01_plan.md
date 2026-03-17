# [#117] chore: ECR + EC2 Docker CI/CD 파이프라인 구축 (siw) — 구현 계획

> 작성: 2026-03-17 | 개정: 2026-03-17 (Architect/Critic 피드백 반영)

---

## 완료 기준

### 코드 작업
- [x] `services/siw/next.config.ts`에 `output: 'standalone'` 추가 (기존 `serverExternalPackages` 유지)
- [x] `services/siw/Dockerfile` 생성 — Next.js standalone 멀티스테이지 빌드 (`node:20-alpine`), non-root user, Prisma runner-stage 복사 적용
- [x] `services/siw/entrypoint.sh` 생성 — `set -e`, env guard, `prisma migrate deploy`, `exec node server.js`
- [x] `services/siw/.dockerignore` 생성 — `.next`, `node_modules`, `.env*` 제외
- [x] `.github/workflows/deploy-siw.yml` 생성 — main push 시 ECR 빌드·푸시 → EC2 SSH 접속 → 컨테이너 cleanup → 재시작, `--restart unless-stopped` 포함
- [x] `services/siw/README.md` 작성 — 로컬 빌드·구동·환경변수 운영·네트워크 가이드 포함

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인 (`mirai-siw:test`, 532MB, 2026-03-17 18:47)
- [x] `docker run` 로컬 실행 후 `http://localhost:3000` 응답 확인 (HTTP 200)

### siw 특수 처리
- [x] `NEXT_PUBLIC_` 환경변수 빌드 타임 주입 처리 — `deploy-siw.yml`에서 `docker build --build-arg`로 주입
- [x] Prisma 마이그레이션 처리 — entrypoint.sh에서 `prisma migrate deploy` 실행
- [x] `DIRECT_URL` — EC2 env-file에 포함
- [ ] `ENGINE_BASE_URL` — EC2 env-file에 engine 호스트 주소로 설정 (**블로커**: engine 담당자 IP 대기 중)

### 인프라 (수동 작업)
- [ ] Elastic IP 할당 → EC2에 연결 (`SIW_EC2_HOST` Secrets에 등록)
- [ ] GitHub Secrets 등록 (9개)
- [ ] ALB 생성 + 타겟 그룹(포트 3000, 헬스체크 `/`) + EC2 등록
- [ ] ACM 인증서 발급 + ALB HTTPS 리스너 연결
- [ ] Route53 A 레코드(Alias) → ALB 연결
- [ ] WAF Web ACL 생성 (`AWSManagedRulesCommonRuleSet`) → ALB 연결

---

## 구현 계획

### Step 1: next.config.ts 수정 + .dockerignore 생성

**수정 파일:** `services/siw/next.config.ts`

기존 `nextConfig` 객체에 `output: 'standalone'` 추가. 기존 `serverExternalPackages: ["pdf-parse"]`는 유지.

**생성 파일:** `services/siw/.dockerignore`

```
node_modules
.next
.env*
*.test.*
tests/
.git
*.md
test-results/
playwright-report/
```

> **주의**: `prisma/migrations/` 전체를 제외하면 안 됨. `migration_lock.toml`은 `prisma migrate deploy` 실행에 필요하므로 반드시 포함되어야 함.

**검증:** `next.config.ts`에 `output: 'standalone'`과 `serverExternalPackages` 둘 다 존재하는지 확인.

---

### Step 2: Dockerfile 생성 (멀티스테이지 빌드 + Prisma)

**생성 파일:** `services/siw/Dockerfile`

`services/lww/Dockerfile`을 템플릿으로 사용하되, Prisma 관련 추가 사항 반영.

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

# 빌드 타임 환경변수 (NEXT_PUBLIC_*는 빌드 시 번들에 인라인)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

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
# NOTE: services/siw/public/ 디렉토리가 없으므로 COPY 생략 (생기면 추가)

# Prisma CLI + client + schema + migrations 복사 (entrypoint에서 migrate deploy 실행용)
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma

# entrypoint 스크립트 복사
COPY --chown=nextjs:nodejs entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

ENTRYPOINT ["./entrypoint.sh"]
```

**주의사항:**
- `npm ci` (deps stage)에서 `postinstall`로 `prisma generate`가 자동 실행됨
- `public/` 디렉토리: `services/siw/public/`이 현재 없으므로 COPY 라인 제거. 추후 생기면 추가.
- `pdf-parse`가 `serverExternalPackages`이므로 standalone에서 `node_modules/pdf-parse`가 자동 포함됨

**검증:** Dockerfile이 3-stage 구조이고, runner stage에 Prisma 관련 COPY 5줄이 포함되어 있는지 확인.

---

### Step 3: entrypoint.sh 생성

**생성 파일:** `services/siw/entrypoint.sh`

```bash
#!/bin/sh
set -e

# 필수 환경변수 확인
if [ -z "$DATABASE_URL" ] || [ -z "$DIRECT_URL" ]; then
  echo "ERROR: DATABASE_URL and DIRECT_URL must be set" >&2
  exit 1
fi

# Prisma 마이그레이션 실행
npx prisma migrate deploy

# Next.js 서버 시작
exec node server.js
```

**설계 근거:**
- `set -e`: migration 실패 시 즉시 종료 (컨테이너 crash -> `--restart unless-stopped`로 재시작 시도)
- env guard: 환경변수 미설정 시 명확한 에러 메시지 출력
- `exec`: PID 1로 node 프로세스를 교체하여 시그널 전달 보장
- `dotenv` 관련: `prisma.config.ts`에 `import "dotenv/config"` 있으나, Docker `--env-file`로 이미 주입되고 `.env` 파일 부재 시 dotenv는 silent skip하므로 별도 처리 불필요

**검증:** `entrypoint.sh`에 `set -e`, env guard, `prisma migrate deploy`, `exec node server.js`가 순서대로 있는지 확인.

---

### Step 4: deploy-siw.yml 생성 (GitHub Actions CI/CD)

**생성 파일:** `.github/workflows/deploy-siw.yml`

**워크플로우 구조:**

```yaml
name: Deploy siw to EC2
on:
  push:
    branches: [main]
    paths:
      - 'services/siw/**'
  workflow_dispatch:  # GitHub Actions 탭에서 수동 트리거 가능

jobs:
  build-and-push-siw:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
        id: ecr-login
      - name: Build and push siw
        env:
          ECR_REGISTRY: ${{ steps.ecr-login.outputs.registry }}
        run: |
          docker build \
            --build-arg NEXT_PUBLIC_SUPABASE_URL=${{ secrets.SIW_NEXT_PUBLIC_SUPABASE_URL }} \
            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=${{ secrets.SIW_NEXT_PUBLIC_SUPABASE_ANON_KEY }} \
            -t $ECR_REGISTRY/mirai-siw:latest \
            -t $ECR_REGISTRY/mirai-siw:${{ github.sha }} \
            -f services/siw/Dockerfile \
            services/siw
          docker push $ECR_REGISTRY/mirai-siw --all-tags

  deploy:
    needs: [build-and-push-siw]
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SIW_EC2_HOST }}
          username: ${{ secrets.SIW_EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            # ECR 로그인
            aws ecr get-login-password --region ${{ secrets.AWS_REGION }} | \
              docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}

            # 기존 컨테이너 정리
            docker stop siw || true && docker rm siw || true

            # 최신 이미지 pull
            docker pull ${{ secrets.ECR_REGISTRY }}/mirai-siw:latest

            # siw 시작
            docker run -d --name siw \
              --restart unless-stopped \
              --env-file ~/.env.siw \
              -p 3000:3000 \
              ${{ secrets.ECR_REGISTRY }}/mirai-siw:latest
```

> **engine 배포는 별도 담당자가 `deploy-engine.yml`로 관리한다.** siw의 `ENGINE_BASE_URL`은 EC2 서버의 `~/.env.siw`에 engine 호스트 주소로 직접 설정한다.

**EC2 env-file 내용 (수동 설정 필요):**

`~/.env.siw`:
```
DATABASE_URL=postgresql://...  (Supabase pooler, port 6543)
DIRECT_URL=postgresql://...    (Supabase direct, port 5432)
SUPABASE_SERVICE_ROLE_KEY=...
ENGINE_BASE_URL=http://<engine-host>:8000
SUPABASE_STORAGE_BUCKET=...
```

**GitHub Secrets 전체 목록:**
| Secret | 용도 |
|--------|------|
| `AWS_ACCESS_KEY_ID` | AWS 인증 |
| `AWS_SECRET_ACCESS_KEY` | AWS 인증 |
| `AWS_REGION` | ECR/EC2 리전 |
| `ECR_REGISTRY` | ECR 레지스트리 URL (`{account}.dkr.ecr.{region}.amazonaws.com`) |
| `SIW_NEXT_PUBLIC_SUPABASE_URL` | 빌드 타임 주입 (siw) |
| `SIW_NEXT_PUBLIC_SUPABASE_ANON_KEY` | 빌드 타임 주입 (siw) |
| `SIW_EC2_HOST` | siw EC2 SSH 접속 |
| `SIW_EC2_USER` | siw EC2 SSH 접속 |
| `EC2_SSH_KEY` | EC2 SSH 접속 (팀 공용 PEM 키) |

**검증:**
- workflow syntax 검증: `act` 또는 GitHub Actions UI에서 확인
- 컨테이너 cleanup (`stop/rm`) 포함 확인
- `--restart unless-stopped` 포함 확인

---

### Step 5: README.md 작성 + 로컬 검증 + .ai.md 최신화

**생성 파일:** `services/siw/README.md`

내용:
- 로컬 Docker 빌드 명령어 (`docker build --build-arg ...`)
- 로컬 Docker 실행 명령어 (`docker run --network mirai --env-file ...`)
- 환경변수 목록 (빌드 타임 vs 런타임 구분, `DIRECT_URL` 포함)
- Docker 네트워크 설정 (`docker network create mirai`, `ENGINE_BASE_URL=http://engine:8000`)
- GitHub Secrets 동기화 가이드
- Prisma 마이그레이션 가이드

**로컬 검증:**

```bash
cd services/siw
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=http://test \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=test-key \
  -t mirai-siw:test .
# exit code 0 확인

docker network create mirai || true
docker run -d --name siw-test --network mirai -p 3000:3000 \
  -e DATABASE_URL=<test-db-url> \
  -e DIRECT_URL=<test-direct-url> \
  -e ENGINE_BASE_URL=http://engine:8000 \
  mirai-siw:test
curl http://localhost:3000  # 응답 확인

# 정리
docker stop siw-test && docker rm siw-test
```

**.ai.md 최신화:**
- `services/siw/.ai.md` — Dockerfile, entrypoint.sh, Docker 빌드/네트워크 관련 내용 추가
- `.github/workflows/.ai.md` — deploy-siw.yml 설명 추가/생성
