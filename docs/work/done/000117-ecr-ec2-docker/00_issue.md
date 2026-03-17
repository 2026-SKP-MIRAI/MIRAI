# chore: ECR + EC2 Docker CI/CD 파이프라인 구축 (siw)

## 목적
siw 서비스를 Docker 컨테이너로 빌드하고, ECR에 이미지를 저장한 뒤 EC2에 자동 배포하는 CI/CD 파이프라인을 구축한다. ALB + Route53 + WAF + HTTPS로 프로덕션 수준의 인프라를 완성한다.

## 배경
Week 4 배포 목표 달성을 위해 GitHub Actions → ECR → EC2 자동 배포 흐름이 필요하다. AWS 인프라(ECR, EC2, ALB, Route53, WAF, ACM)는 수동으로 사전 구성하며, 코드 레포에서는 5개 파일을 신규 생성·수정한다.

## 완료 기준

### 코드 작업
- [ ] `services/siw/next.config.ts`에 `output: 'standalone'` 추가 (기존 `serverExternalPackages` 유지)
- [ ] `services/siw/Dockerfile` 생성 — Next.js standalone 멀티스테이지 빌드 (`node:20-alpine`), non-root user, Prisma runner-stage 복사 적용
- [ ] `services/siw/entrypoint.sh` 생성 — `set -e`, env guard, `prisma migrate deploy`, `exec node server.js`
- [ ] `services/siw/.dockerignore` 생성 — `.next`, `node_modules`, `.env*` 제외
- [ ] `.github/workflows/deploy-siw.yml` 생성 — main push 시 siw ECR 빌드·푸시 → EC2 SSH 접속 → siw 컨테이너 재시작, `--restart unless-stopped` 포함 (engine 배포는 별도 담당)
- [ ] `services/siw/README.md` 작성 — 로컬 빌드·구동·환경변수 운영 가이드 포함

### 로컬 검증
- [ ] `docker build` 로컬 빌드 성공 확인
- [ ] `docker run` 로컬 실행 후 `http://localhost:3000` 응답 확인

### siw 특수 처리
- [ ] `NEXT_PUBLIC_` 환경변수 빌드 타임 주입 처리 — `deploy-siw.yml`에서 `docker build --build-arg`로 주입
- [ ] Prisma 마이그레이션 처리 — `entrypoint.sh`에서 `prisma migrate deploy` 실행
- [ ] `DIRECT_URL` — EC2 env-file에 포함
- [ ] `ENGINE_BASE_URL` — EC2 env-file에 engine 호스트 주소로 설정

## 구현 플랜
1. **next.config.ts** — `output: 'standalone'` 한 줄 추가
2. **Dockerfile** — 멀티스테이지: `deps`(npm ci) → `builder`(next build, `--build-arg`로 `NEXT_PUBLIC_*` 주입) → `runner`(standalone 복사, non-root user, Prisma 포함, PORT 3000)
3. **entrypoint.sh** — env guard → `prisma migrate deploy` → `exec node server.js`
4. **.dockerignore** — `node_modules`, `.next`, `.env*`, `*.test.*`, `tests/` 제외
5. **deploy-siw.yml** — 트리거: `push: branches: [main]` + `workflow_dispatch` / ECR push + EC2 ssh + `--restart unless-stopped`
6. **README.md** — 로컬 개발·Docker 빌드·환경변수 목록·GitHub Secrets 동기화 가이드

## 운영 설정 체크리스트 (수동 작업)

### 1. ECR 레포 생성
- [ ] `mirai-siw` 레포 생성 (AWS Console → ECR → Create repository, Private)

### 2. EC2 인스턴스 생성 (siw)
- [ ] siw 서버 — t3a.micro 이상, Ubuntu 22.04, 보안 그룹: SSH(22), HTTP(80), HTTPS(443), 3000 인바운드 오픈
- [ ] Docker 설치 (`apt install docker.io`)
- [ ] AWS CLI 설치 (공식 방법: `curl` + `unzip` + `./aws/install`)
- [ ] `aws configure` — IAM 액세스 키 입력 (region: `ap-northeast-2`)

### 3. IAM 설정
- [ ] GitHub Actions용 IAM 유저 생성 → `AmazonEC2ContainerRegistryPowerUser` 부여 → 액세스 키 발급
- [ ] EC2에서 ECR pull을 위해 `aws configure`로 같은 키 사용 (또는 IAM Role 연결)

### 4. EC2 서버에 환경변수 파일 생성
- [ ] siw 서버: `~/.env.siw` — `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ENGINE_BASE_URL`, `SUPABASE_STORAGE_BUCKET`

### 5. ALB (Application Load Balancer) 설정
- [ ] ALB 생성 — Internet-facing, HTTPS 리스너(443) + HTTP→HTTPS 리다이렉트(80)
- [ ] 타겟 그룹 생성 — Instance 타입, 포트 3000, 헬스체크 경로 `/`
- [ ] EC2 인스턴스를 타겟 그룹에 등록
- [ ] ALB 보안 그룹 — HTTP(80), HTTPS(443) 인바운드 오픈

### 6. ACM 인증서 + HTTPS
- [ ] AWS Certificate Manager → 인증서 요청 (도메인명 입력)
- [ ] DNS 검증 — Route53에 CNAME 레코드 자동 추가
- [ ] ALB HTTPS 리스너에 인증서 연결

### 7. Route53 도메인 연결
- [ ] Hosted Zone 생성 또는 기존 사용
- [ ] A 레코드 (Alias) → ALB DNS 이름으로 설정
- [ ] 도메인 등록 업체에서 네임서버를 Route53 NS로 변경

### 8. WAF 설정
- [ ] AWS WAF → Web ACL 생성
- [ ] 관리형 규칙 추가: `AWSManagedRulesCommonRuleSet` (SQL 인젝션·XSS 방어)
- [ ] Web ACL을 ALB에 연결

### 9. GitHub Secrets 등록
- [ ] `AWS_ACCESS_KEY_ID` — IAM 유저 액세스 키
- [ ] `AWS_SECRET_ACCESS_KEY` — IAM 유저 시크릿
- [ ] `AWS_REGION` — `ap-northeast-2`
- [ ] `ECR_REGISTRY` — `{account_id}.dkr.ecr.ap-northeast-2.amazonaws.com`
- [ ] `SIW_EC2_HOST` — siw EC2 퍼블릭 IP
- [ ] `SIW_EC2_USER` — `ubuntu`
- [ ] `EC2_SSH_KEY` — EC2 PEM 키 파일 전체 내용 (팀 공용)
- [ ] `SIW_NEXT_PUBLIC_SUPABASE_URL` — 빌드 타임 주입용
- [ ] `SIW_NEXT_PUBLIC_SUPABASE_ANON_KEY` — 빌드 타임 주입용

## 개발 체크리스트
- [x] `services/siw/.ai.md` 최신화 (Dockerfile, entrypoint.sh, Docker 빌드 관련)
- [x] `.github/workflows/.ai.md` 생성 (파일 네이밍 규칙, deploy-siw.yml 흐름)

---

## 작업 내역

### 2026-03-17

**현황**: 코드 작업 + 로컬 검증 완료 / 운영 설정 일부 완료 / GitHub Secrets + 인프라(ALB·ACM·Route53·WAF) 미완료

**완료된 항목 — 코드**:
- `services/siw/next.config.ts` — `output: 'standalone'` 추가 (기존 `serverExternalPackages: ["pdf-parse"]` 유지)
- `services/siw/Dockerfile` — 3-stage 멀티스테이지 빌드 (deps → builder → runner), non-root user, Prisma runner-stage 복사 적용
- `services/siw/entrypoint.sh` — `set -e`, env guard, `prisma migrate deploy`, `exec node server.js`
- `services/siw/.dockerignore` — `node_modules`, `.next`, `.env*`, `*.test.*`, `tests/` 제외
- `.github/workflows/deploy-siw.yml` — main push + workflow_dispatch 트리거, ECR 빌드·푸시 → EC2 SSH → 컨테이너 재시작, `--restart unless-stopped` 포함
- `services/siw/README.md` — 로컬 빌드·실행·환경변수·GitHub Secrets 가이드
- `services/siw/.ai.md` 최신화
- `.github/workflows/.ai.md` 생성

**완료된 항목 — 로컬 검증**:
- `docker build` 로컬 빌드 성공 (`mirai-siw:test`, 532MB)
- `docker run` 로컬 실행 → `curl http://localhost:3000` HTTP 200 응답 확인
- 로그 경고(`@napi-rs/canvas`) — pdf-parse 선택적 의존성 누락 경고이며 텍스트 추출 기능에 영향 없음, 무시

**완료된 항목 — 운영 설정 (수동)**:
- ECR `mirai-siw` 레포 생성
- IAM 유저 생성 + `AmazonEC2ContainerRegistryPowerUser` 부여 + 액세스 키 발급
- EC2 인스턴스 생성 + Docker + AWS CLI 설치
- EC2 `~/.env.siw` 생성

**미완료 항목**:
- GitHub Secrets 등록 (9개) — `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_SSH_KEY`, `SIW_EC2_HOST`, `SIW_EC2_USER`, `SIW_NEXT_PUBLIC_SUPABASE_URL`, `SIW_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Elastic IP 할당 + `SIW_EC2_HOST` Secrets 등록 (EC2 재시작 시 IP 변경 방지)
- ALB 생성 + 타겟 그룹(포트 3000, 헬스체크 `/`) + EC2 등록
- ACM 인증서 발급 + ALB HTTPS 리스너 연결
- Route53 A 레코드(Alias) → ALB 연결
- WAF Web ACL 생성 (`AWSManagedRulesCommonRuleSet`) → ALB 연결
- `workflow_dispatch`로 첫 배포 테스트 (GitHub Actions → ECR → EC2 전체 파이프라인 검증)
- 최종 확인 (`https://siw.mirai.kr` 응답)

**블로커**:
- `ENGINE_BASE_URL` — engine 담당자 EC2 서버 IP 확정 후 `~/.env.siw` 업데이트 필요

**변경 파일**: 9개
- `services/siw/next.config.ts` (수정)
- `services/siw/Dockerfile` (신규)
- `services/siw/entrypoint.sh` (신규)
- `services/siw/.dockerignore` (신규)
- `services/siw/README.md` (신규)
- `services/siw/.ai.md` (수정)
- `.github/workflows/deploy-siw.yml` (신규)
- `.github/workflows/.ai.md` (신규)
- `docs/work/active/000117-ecr-ec2-docker/` (신규)

