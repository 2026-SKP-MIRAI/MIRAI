# chore: [kwan] ECR + EC2 Docker CI/CD 파이프라인 구축

## 목적
kwan 서비스를 Docker 컨테이너로 빌드하고, ECR에 이미지를 저장한 뒤 EC2에 자동 배포하는
CI/CD 파이프라인을 구축한다. ALB + Route53 + HTTPS로 프로덕션 수준의 인프라를 완성한다.

## 배경
Phase 3까지 기능 구현 완료. siw(#117), seung(#132, #135) 배포 패턴을 따른다.
kwan은 NEXT_PUBLIC_* 환경변수가 없으므로 빌드 타임 주입 불필요.

## 완료 기준

### 코드 작업
- [x] `services/kwan/next.config.ts`에 `output: 'standalone'` 추가
- [x] `services/kwan/src/app/api/health/route.ts` 생성 — `GET /api/health` 헬스체크 라우트
- [x] `services/kwan/Dockerfile` 생성 — Next.js standalone 멀티스테이지 빌드 (node:20-alpine), non-root user, Prisma node_modules 전체 복사, CRLF 처리
- [x] `services/kwan/entrypoint.sh` 생성 — `set -e`, `prisma migrate deploy`, `exec node server.js`
- [x] `services/kwan/.dockerignore` 생성 — `.next`, `node_modules`, `.env*` 제외
- [x] `.github/workflows/deploy-kwan.yml` 생성 — main push 시 kwan ECR 빌드·푸시 → EC2 SSH 접속 → kwan 컨테이너 재시작, `--restart unless-stopped` 포함

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인
- [x] `docker run` 로컬 실행 후 `http://localhost:3000` 응답 확인
- [x] `GET /api/health` 200 응답 확인

### kwan 특수 처리
- [x] NEXT_PUBLIC_* 없음 — `--build-arg` 불필요
- [x] Prisma 마이그레이션 처리 — `entrypoint.sh`에서 `prisma migrate deploy` 실행
- [x] `DIRECT_URL` — EC2 env-file에 포함
- [x] `ENGINE_BASE_URL` — EC2 env-file에 engine 호스트 주소로 설정

## 구현 플랜
1. `next.config.ts` — `output: 'standalone'` 추가
2. `/api/health/route.ts` — `{ status: 'ok' }` 반환하는 GET 라우트
3. `Dockerfile` — 멀티스테이지: deps → builder(next build) → runner(standalone + node_modules 전체 복사, CRLF 처리, HEALTHCHECK: /api/health)
4. `entrypoint.sh` — prisma migrate deploy → exec node server.js
5. `.dockerignore` — node_modules, .next, .env* 제외
6. `deploy-kwan.yml` — push: [main], paths: services/kwan/**, ECR push + EC2 ssh + --restart unless-stopped

## 운영 설정 체크리스트 (수동 작업)

### ECR
- [x] `mirai-kwan` 레포 생성 (AWS Console → ECR → Private)

### EC2
- [x] kwan 서버 생성 — t3a.micro 이상, Ubuntu 22.04
- [x] Docker + AWS CLI 설치, `aws configure`
- [x] `~/.env.kwan` 생성 — `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `ENGINE_BASE_URL`

### ALB + ACM + Route53 + WAF
- [x] ALB 생성, 타겟 그룹 포트 3000, 헬스체크 `/api/health`
- [ ] ACM 인증서 → Route53 CNAME 검증 → ALB HTTPS 리스너 연결
- [x] Route53 A 레코드 (Alias) → ALB
- [x] WAF Web ACL (AWSManagedRulesCommonRuleSet) → ALB 연결

### GitHub Secrets 등록
- [x] `KWAN_EC2_HOST` — kwan EC2 퍼블릭 IP
- [x] `KWAN_EC2_USER` — `ubuntu`
- [x] `EC2_SSH_KEY` — PEM 키 (팀 공용, 기존 값 재사용)

## 개발 체크리스트
- [x] `services/kwan/.ai.md` 최신화 (Dockerfile, entrypoint.sh, 배포 구조 반영)
- [x] `.github/workflows/.ai.md` 최신화 (deploy-kwan.yml 흐름 추가)

---

## 작업 내역

### 신규 생성 파일

**`services/kwan/Dockerfile`**
seung 패턴 기반. 3단계 멀티스테이지(deps → builder → runner). kwan에 `prisma.config.ts` 없어 해당 COPY 줄 제거. `NEXT_PUBLIC_*` 빌드 인자 불필요하여 ARG/ENV 블록 제외. node_modules 전체 복사로 Prisma 전이 의존성 누락 방지. CRLF 처리, HEALTHCHECK `/api/health` 적용.

**`services/kwan/entrypoint.sh`**
`DATABASE_URL`, `DIRECT_URL`, `ENGINE_BASE_URL` 3개 env guard. PgBouncer 우회를 위해 `DATABASE_URL="$DIRECT_URL"` override 후 `node node_modules/prisma/build/index.js migrate deploy` 실행.

**`services/kwan/.dockerignore`**
node_modules, .next, .env*, 테스트 파일 등 제외.

**`services/kwan/src/app/api/health/route.ts`**
ALB 헬스체크용 `GET /api/health` → `{ status: 'ok' }` 반환.

**`services/kwan/prisma/migrations/20260324000000_init/migration.sql`**
기존 DB 베이스라인 마이그레이션. `prisma migrate diff`로 SQL 생성 후 `prisma migrate resolve --applied`로 이미 적용됨 처리.

**`.github/workflows/deploy-kwan.yml`**
deploy-seung.yml 기반. `push: main (services/kwan/**)` + `workflow_dispatch (skip_build)` 트리거. `--build-arg` 없이 docker build. `~/.env.kwan` 존재 확인 로직 포함. `--restart unless-stopped`, `docker image prune -f` 포함.

### 수정 파일

**`services/kwan/next.config.ts`**: `output: 'standalone'` 추가.

**`services/kwan/src/app/diagnosis/page.tsx`**: `encodeURIComponent(resumeId ?? '')` — TypeScript 빌드 에러 수정.

**`services/kwan/src/domain/interview/schemas.ts`**: 엔진 #197 `not_evaluated` 도입 반영. `AxisScoresSchema` 8개 필드 `.nullable()`, `AxisFeedbackSchema`의 `score` nullable, `type`에 `'not_evaluated'` 추가.

**`services/kwan/src/domain/interview/types.ts`**: 스키마 변경 반영. `AxisScores` nullable, `AxisFeedback` score/type 업데이트.

### 인프라 작업 (수동)

EC2 생성 및 세팅(Docker, AWS CLI, ~/.env.kwan), ECR `mirai-kwan` 레포, ALB + 타겟 그룹, Route53 A Alias → ALB, WAF 규칙 조정, GitHub Secrets 등록.

### 배포 확인

`kwan.mirainterview.com` 에서 자소서 업로드 → 질문 생성 → 면접 → 리포트 생성 end-to-end 동작 확인.
