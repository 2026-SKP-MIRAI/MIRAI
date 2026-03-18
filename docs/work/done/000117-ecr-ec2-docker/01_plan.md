# [#117] chore: ECR + EC2 Docker CI/CD 파이프라인 구축 (siw) — 구현 계획

> 작성: 2026-03-17 | 개정: 2026-03-18 (코드 리뷰 반영 — entrypoint.sh Prisma 경로, workflow_dispatch skip_build, README Secrets 이름, EC2 IAM Role 전환)

---

## 완료 기준

### 코드 작업
- [x] `services/siw/next.config.ts`에 `output: 'standalone'` 추가 (기존 `serverExternalPackages` 유지)
- [x] `services/siw/Dockerfile` 생성 — Next.js standalone 멀티스테이지 빌드 (`node:20-alpine`), non-root user, Prisma runner-stage 복사 적용
- [x] `services/siw/entrypoint.sh` 생성 — `set -e`, env guard, `prisma migrate deploy`, `exec node server.js` (2026-03-18: Prisma 실행 경로를 내부 빌드 경로에서 `./node_modules/.bin/prisma`로 수정)
- [x] `services/siw/.dockerignore` 생성 — `.next`, `node_modules`, `.env*` 제외
- [x] `.github/workflows/deploy-siw.yml` 생성 — main push 시 ECR 빌드·푸시 → EC2 SSH 접속 → 컨테이너 cleanup → 재시작, `--restart unless-stopped` 포함 (2026-03-18: `workflow_dispatch`에 `skip_build` input 추가 — 서버 재시작 시 빌드 생략 가능)
- [x] `services/siw/README.md` 작성 — 로컬 빌드·구동·환경변수 운영·네트워크 가이드 포함 (2026-03-18: GitHub Secrets 이름 `SIW_` prefix 누락 수정 — `EC2_HOST` → `SIW_EC2_HOST` 등)

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인 (`mirai-siw:test`, 532MB, 2026-03-17 18:47)
- [x] `docker run` 로컬 실행 후 `http://localhost:3000` 응답 확인 (HTTP 200)

### siw 특수 처리
- [x] `NEXT_PUBLIC_` 환경변수 빌드 타임 주입 처리 — `deploy-siw.yml`에서 `docker build --build-arg`로 주입
- [x] Prisma 마이그레이션 처리 — entrypoint.sh에서 `prisma migrate deploy` 실행
- [x] `DIRECT_URL` — EC2 env-file에 포함
- [ ] `ENGINE_BASE_URL` — EC2 env-file에 engine 호스트 주소로 설정 (**블로커**: engine 담당자 IP 대기 중)

### 인프라 (수동 작업)
> **참고**: 000064에서 engine/lww용 ALB 2개, Route53(`engine.mirainterview.com`, `mirainterview.com`), ACM, WAF가 이미 구성됨. siw용으로 추가 필요.

- [x] EC2 IAM Role(`mirai-siw-ec2-role`) 생성 → 인스턴스에 연결, `~/.aws/credentials` 삭제 — Instance Profile 방식으로 전환 완료 (2026-03-18)
- [x] Elastic IP 할당 → EC2에 연결 (`SIW_EC2_HOST` Secrets에 등록, EC2 재시작 시 IP 고정)
- [ ] GitHub Secrets 등록 (9개)
- [ ] ALB 생성 (siw용) + 타겟 그룹(포트 3000, 헬스체크 `/`) + EC2 등록
  - EC2 보안 그룹: 포트 3000을 ALB 보안 그룹에서만 허용 (퍼블릭 직접 오픈 금지)
  - EC2 보안 그룹: SSH(22), HTTP(80), HTTPS(443) 만 퍼블릭 오픈
- [ ] ACM 인증서 발급 + ALB HTTPS 리스너 연결
- [ ] Route53 A 레코드(Alias) → ALB 연결 (예: `siw.mirainterview.com`)
- [ ] WAF Web ACL 생성 (`AWSManagedRulesCommonRuleSet`) → ALB 연결
  - ⚠️ **`SizeRestrictions_BODY` → Count로 변경 필수** (이력서 PDF 업로드. 000064에서 동일하게 처리한 선례 있음)

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
--------------------------------------------------------------------------------------
 AWS 인프라 세팅 상세 가이드

  ---
  1단계. Elastic IP 할당 → EC2 연결

  목적: EC2 재시작해도 IP 고정

  1. AWS 콘솔 → 상단 검색창에 EC2 검색 → 클릭
  2. 왼쪽 메뉴 → 네트워크 및 보안 → 탄력적 IP
  3. 오른쪽 상단 탄력적 IP 주소 할당 클릭
  4. 그냥 할당 클릭 (기본값 유지)
  5. 방금 만들어진 IP 선택 → 작업 → 탄력적 IP 주소 연결
  6. 인스턴스 칸 클릭 → siw EC2 선택 → 연결

  ▎ 이 IP가 SIW_EC2_HOST에 등록할 값입니다. 메모해두세요.

  ---
  2단계. GitHub Secrets 등록

  목적: GitHub Actions가 AWS/EC2에 접근할 수 있게 인증 정보 저장  

  1. GitHub → 2026-SKP-MIRAI/MIRAI 레포 → Settings 탭
  2. 왼쪽 메뉴 → Secrets and variables → Actions
  3. New repository secret 클릭해서 아래 9개 하나씩 등록

  ┌────────────────────────┬──────────────────────────────────┐   
  │          Name          │              Value               │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ AWS_ACCESS_KEY_ID      │ IAM 액세스 키                    │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ AWS_SECRET_ACCESS_KEY  │ IAM 시크릿 키                    │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ AWS_REGION             │ ap-northeast-2                   │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ ECR_REGISTRY           │ 64**********.dkr.ecr.ap-******** │   
  │                        │ ***.amazonaws.com                │   
  ├────────────────────────┼──────────────────────────────────┤   
  │                        │ mirai_key.pem 파일 전체 내용     │   
  │ EC2_SSH_KEY            │ (-----BEGIN RSA PRIVATE KEY----- │   
  │                        │  포함)                           │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ SIW_EC2_HOST           │ 1단계에서 받은 Elastic IP        │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ SIW_EC2_USER           │ ubuntu                           │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ SIW_NEXT_PUBLIC_SUPABA │ https://snkkprkqzoaodxirqjjx.sup │   
  │ SE_URL                 │ abase.co                         │   
  ├────────────────────────┼──────────────────────────────────┤   
  │ SIW_NEXT_PUBLIC_SUPABA │ .env의                           │   
  │ SE_ANON_KEY            │ NEXT_PUBLIC_SUPABASE_ANON_KEY 값 │   
  └────────────────────────┴──────────────────────────────────┘   

  ---
  3단계. EC2 보안 그룹 수정

  목적: 포트 3000을 ALB에서만 받고 외부 직접 접근 차단

  1. AWS 콘솔 → EC2 → 인스턴스
  2. siw EC2 클릭 → 하단 보안 탭 → 보안 그룹 링크 클릭
  3. 인바운드 규칙 편집 클릭
  4. 현재 규칙 확인:
    - 포트 3000이 0.0.0.0/0 (전체 공개)로 열려 있으면 → 삭제      
    - SSH(22), HTTP(80), HTTPS(443) 는 유지
  5. 규칙 저장

  ▎ ⚠️ 포트 3000은 ALB 만들고 나서 ALB 보안 그룹에서만 허용하도록 
  다시 추가합니다 (4단계에서)

  ---
  4단계. ALB 생성

  목적: 인터넷 → ALB(80/443) → EC2:3000 트래픽 라우팅

  4-1. 타겟 그룹 먼저 생성

  1. EC2 → 왼쪽 메뉴 → 로드 밸런싱 → 대상 그룹
  2. 대상 그룹 생성 클릭
  3. 설정:
    - 대상 유형: 인스턴스
    - 대상 그룹 이름: mirai-siw-tg
    - 프로토콜: HTTP
    - 포트: 3000
    - VPC: siw EC2와 같은 VPC 선택
    - 헬스 체크 경로: /
  4. 다음 → siw EC2 인스턴스 체크 → 아래에 보류 중인 항목으로 포함
   클릭 → 대상 그룹 생성

  4-2. ALB 생성

  1. EC2 → 로드 밸런싱 → 로드 밸런서
  2. 로드 밸런서 생성 → Application Load Balancer 선택
  3. 설정:
    - 이름: mirai-siw-alb
    - 체계: 인터넷 경계
    - IP 주소 유형: IPv4
    - VPC: siw EC2와 같은 VPC
    - 가용 영역: 체크박스 2개 이상 선택
  4. 보안 그룹 → 새 보안 그룹 생성 클릭:
    - 이름: mirai-siw-alb-sg
    - 인바운드: HTTP(80) 0.0.0.0/0, HTTPS(443) 0.0.0.0/0
    - 생성 후 이 보안 그룹 선택
  5. 리스너:
    - HTTP:80 → 대상 그룹: mirai-siw-tg
  6. 로드 밸런서 생성

  4-3. EC2 보안 그룹에 ALB만 허용

  1. EC2 보안 그룹 → 인바운드 규칙 편집
  2. 규칙 추가:
    - 유형: 사용자 지정 TCP
    - 포트: 3000
    - 소스: mirai-siw-alb-sg (ALB 보안 그룹 ID 검색해서 선택)     
  3. 규칙 저장

  ---
  5단계. ALB 동작 확인 (여기서 먼저 테스트)

  1. EC2 → 로드 밸런서 → mirai-siw-alb 클릭
  2. DNS 이름 복사 (예:
  mirai-siw-alb-123456.ap-northeast-2.elb.amazonaws.com)
  3. 브라우저에서 http://<DNS이름> 접속 → siw 페이지 뜨면 성공    

  ▎ 이 단계에서 먼저 서비스 동작 확인 후 도메인 연결로 넘어가세요.

  ---
  6단계. ACM 인증서 발급

  목적: HTTPS 적용을 위한 SSL 인증서

  1. AWS 콘솔 상단 검색 → Certificate Manager → 클릭
  2. 인증서 요청 → 퍼블릭 인증서 요청
  3. 도메인 이름 입력: siw.mirainterview.com
  4. 검증 방법: DNS 검증 선택
  5. 요청
  6. 인증서 클릭 → Route53에서 레코드 생성 버튼 클릭 (자동으로    
  CNAME 추가됨)
  7. 상태가 발급됨으로 바뀔 때까지 대기 (5~10분)

  ---
  7단계. ALB HTTPS 리스너 추가

  1. EC2 → 로드 밸런서 → mirai-siw-alb
  2. 리스너 및 규칙 탭 → 리스너 추가
  3. 설정:
    - 프로토콜: HTTPS, 포트: 443
    - 대상 그룹: mirai-siw-tg
    - SSL 인증서: 6단계에서 발급한 인증서 선택
  4. 추가
  5. HTTP:80 리스너 클릭 → 규칙 편집 → HTTPS로 리다이렉트로 변경  

  ---
  8단계. Route53 도메인 연결

  목적: siw.mirainterview.com → ALB 연결

  1. AWS 콘솔 → Route53 검색
  2. 호스팅 영역 → mirainterview.com 클릭
  3. 레코드 생성:
    - 레코드 이름: siw
    - 레코드 유형: A
    - 별칭 토글 ON
    - 트래픽 라우팅 대상: Application/Classic Load Balancer →     
  ap-northeast-2 → mirai-siw-alb 선택
  4. 레코드 생성

  ---
  9단계. WAF 설정

  목적: SQL 인젝션·XSS 방어 + PDF 업로드 허용

  1. AWS 콘솔 → WAF 검색 → AWS WAF 클릭
  2. Web ACL 생성:
    - 이름: mirai-siw-waf
    - 리소스 유형: Regional (ALB용)
    - 리전: ap-northeast-2
  3. AWS 관리형 규칙 추가 → AWSManagedRulesCommonRuleSet 추가     
  4. ⚠️ 중요: AWSManagedRulesCommonRuleSet 펼치기 →
  SizeRestrictions_BODY 찾기 → 작업을 Count로 변경 (PDF 업로드    
  차단 방지)
  5. 다음 → 다음 → AWS 리소스 연결: mirai-siw-alb 선택
  6. Web ACL 생성

  ---
  10단계. 최종 확인

  https://siw.mirainterview.com → 정상 응답 확인