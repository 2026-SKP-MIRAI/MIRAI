# [#132] chore: services/seung EC2 배포 + ALB + Route53 + HTTPS 구성 — 구현 계획

> 작성: 2026-03-18

---

## 완료 기준

- [ ] `GET /api/health` Next.js API 라우트 추가 (ALB 헬스체크용)
- [ ] Dockerfile + entrypoint.sh 작성 _(Dockerize는 #135에서 진행)_
- [ ] GitHub Actions 워크플로우 (`deploy-seung.yml`) 작성
- [ ] ECR 레포지토리 생성 (`mirai-seung`)
- [ ] EC2 인스턴스에서 seung 서비스 정상 동작 (포트 3000, Docker)
- [ ] ALB 헬스체크 통과
- [ ] Route53 도메인 연결 + HTTPS (ACM) 적용
- [ ] WAF 기본 룰 적용
- [ ] 배포 URL에서 서비스 end-to-end 동작 확인

---

## 근거 문서

| 문서 | 참고 내용 |
|------|---------|
| `docs/specs/mirai/dev_spec.md` §6 환경변수 | seung 서비스 필요 환경변수 전체 목록 |
| `.github/workflows/deploy-siw.yml` | 배포 방식 패턴 (Docker + ECR + EC2) |
| 멘토링 세션 (#64 진행 내용) | EC2 + ALB + Route53 + WAF 수동 설정 절차 |

---

## 사전 준비 (코드 작업 전 수동 완료)

> 아래 항목이 완료되지 않으면 EC2 배포 및 서비스 실행이 불가하다.

| 단계 | 내용 | 위치 |
|------|------|------|
| A | EC2 인스턴스 확인 또는 생성 | AWS 콘솔 |
| B | Docker 설치 + AWS CLI 설치 | EC2 SSH |
| C | 레포 소스 클론 | EC2 SSH |
| D | 환경변수 설정 (`~/.env.seung`) | EC2 SSH |
| E | 보안 그룹 설정 (ALB용, EC2용) | AWS 콘솔 |
| F | ALB 생성 + 타겟 그룹 + 리스너 | AWS 콘솔 |
| G | Route53 + ACM + WAF | AWS 콘솔 |
| H | ECR 레포지토리 생성 (`mirai-seung`) | AWS 콘솔 |
| I | GitHub Secrets 등록 | GitHub 레포 설정 |

---

### A. EC2 인스턴스 확인 또는 생성 (AWS 콘솔)

- seung 전용 EC2가 없으면 신규 생성:
  - OS: Ubuntu 24.04 LTS
  - 인스턴스 유형: T3A micro (가장 작은 것부터 시작)
  - 키페어: 팀 공용 `mirai-key` 사용
  - VPC/서브넷: #64에서 구성한 퍼블릭 서브넷 사용
  - 퍼블릭 IP 자동 할당: **활성화**
- 기존 EC2 재사용 시: 포트 충돌 여부 확인 (3000번)

---

### B. EC2 Docker + AWS CLI 설치 (SSH 접속 후)

```bash
# 패키지 업데이트
sudo apt update && sudo apt upgrade -y

# Docker 설치
sudo apt install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu   # 재로그인 후 sudo 없이 docker 사용 가능

# AWS CLI 설치 (ECR 로그인용)
sudo apt install -y awscli
```

> `sudo usermod -aG docker ubuntu` 후 SSH 재접속 필요

---

### C. EC2 소스 클론 (SSH 접속 후)

```bash
# 레포 클론 (최초 1회)
git clone https://github.com/<org>/mirai.git ~/MIRAI

# 또는 기존이면 pull
cd ~/MIRAI && git pull origin main
```

---

### D. EC2 환경변수 설정 (SSH 접속 후)

`~/.env.seung` 파일 생성 (`dev_spec.md` §6 기준):

```bash
nano ~/.env.seung
```

```env
# Prisma — 런타임 (pooler)
DATABASE_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require

# Prisma — migrate 전용 (direct)
DIRECT_URL=postgresql://postgres.[project-ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require

# 엔진 연결 (같은 VPC 내 private IP 사용)
ENGINE_BASE_URL=http://<engine-private-ip>:8000

# Supabase — 서버사이드 전용
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # NEXT_PUBLIC_ 절대 금지
SUPABASE_STORAGE_BUCKET=<버킷명>
```

> `NEXT_PUBLIC_*` 변수는 빌드 타임에 Docker ARG로 주입되므로 이 파일에 넣지 않는다.

---

### E. 보안 그룹 설정 (AWS 콘솔)

**ALB 보안 그룹** (신규 생성):
- 인바운드: HTTP 80 (0.0.0.0/0), HTTPS 443 (0.0.0.0/0)
- 아웃바운드: 전체 허용

**EC2 보안 그룹** (신규 또는 기존 수정):
- 인바운드: TCP 3000 — **ALB 보안 그룹에서만 허용** (IP 직접 노출 차단)
- 인바운드: SSH 22 — 내 IP만 허용
- 아웃바운드: 전체 허용

> EC2에 퍼블릭 IP가 있더라도 3000번은 ALB를 통해서만 접근 가능하게 설정한다.

---

### F. ALB 생성 + 타겟 그룹 + 리스너 (AWS 콘솔)

1. **ALB 생성**
   - 이름: `mirai-seung-alb`
   - VPC/서브넷: #64에서 구성한 퍼블릭 서브넷 (가용 영역 2개 이상)
   - 보안 그룹: E에서 만든 ALB 보안 그룹

2. **타겟 그룹 생성**
   - 이름: `mirai-seung-tg`
   - 타입: Instance / 프로토콜·포트: HTTP / 3000
   - 헬스체크 경로: `/api/health` / 성공 코드: 200
   - EC2 인스턴스 등록

3. **리스너 설정**
   - HTTP 80 → HTTPS 443으로 **리다이렉트** (redirect 액션)
   - HTTPS 443 → seung 타겟 그룹으로 **Forward**
   - HTTPS 리스너에 ACM 인증서 연결 (G 완료 후)

---

### G. Route53 + ACM + WAF (AWS 콘솔)

**Route53**:
1. seung 전용 **호스팅 영역 생성** (예: `seung.mirai-interview.com`)
2. 상위 도메인(`mirai-interview.com`)에 **NS 레코드 추가** → seung 호스팅 영역의 네임서버 4개 입력
3. seung 호스팅 영역에 **A 레코드 (Alias)** → ALB 연결

**ACM**:
- 기존 와일드카드 인증서(`*.mirai-interview.com`) 재사용 가능하면 재사용
- 없으면: 인증서 요청 → DNS 검증 (CNAME 자동 생성, 수십 분 소요) → ALB HTTPS 리스너에 연결

**WAF**:
- 기존 Web ACL에 seung ALB 연결
- **PDF 업로드 시 body size restriction 룰에 의해 차단될 수 있음** → WAF 로그 확인 후 필요 시 해당 룰 예외 처리

---

### H. ECR 레포지토리 생성 (AWS 콘솔)

- AWS 콘솔 → ECR → 레포지토리 생성
- 이름: `mirai-seung`
- 리전: `AWS_REGION`과 동일

---

### I. GitHub Secrets 등록 (GitHub 레포 설정)

`Settings → Secrets and variables → Actions`에서 아래 Secrets 등록:

| Secret 이름 | 값 |
|------------|-----|
| `SEUNG_EC2_HOST` | EC2 퍼블릭 IP 또는 도메인 |
| `SEUNG_EC2_USER` | `ubuntu` |
| `SEUNG_NEXT_PUBLIC_SUPABASE_URL` | `https://[project-ref].supabase.co` |
| `SEUNG_NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |

> `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_SSH_KEY`는 기존 공용 Secrets 재사용

---

## 구현 계획

### Step 1. 코드 변경 (PR)

| 파일 | 내용 |
|------|------|
| `services/seung/src/app/api/health/route.ts` | `GET /api/health` — ALB 헬스체크용 (신규) |
| `services/seung/Dockerfile` | 3-stage 빌드 (deps → builder → runner) — **#135에서 진행** |
| `services/seung/entrypoint.sh` | prisma migrate deploy + node server.js — **#135에서 진행** |
| `services/seung/next.config.ts` | `output: "standalone"` 추가 — **#135에서 진행** |
| `.github/workflows/deploy-seung.yml` | ECR 빌드·푸시 + EC2 Docker 실행 (신규) |

### Step 2. 최초 수동 배포 (EC2 SSH 접속 후)

main 브랜치 머지 후 GitHub Actions가 자동 실행되지만, 최초 1회는 수동으로 진행:

```bash
# ECR 로그인
aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <ecr-registry>

# 이미지 pull
docker pull <ecr-registry>/mirai-seung:latest

# 컨테이너 실행
docker run -d --name seung \
  --restart unless-stopped \
  --env-file ~/.env.seung \
  -p 3000:3000 \
  <ecr-registry>/mirai-seung:latest
```

> 이후 main push 시 GitHub Actions가 자동으로 재배포한다.

---

## 구현 순서 요약

```
[사전 준비 — 코드 PR 전에 완료]
A. EC2 인스턴스 확인 또는 생성
B. EC2 Docker + AWS CLI 설치
C. EC2 소스 클론
D. EC2 환경변수 설정 (~/.env.seung)
E. 보안 그룹 설정 (ALB용, EC2용)
F. ALB 생성 + 타겟 그룹 + 리스너 (HTTP→HTTPS 리다이렉트 포함)
G. Route53 호스팅 영역 + NS 레코드 + A 레코드 + ACM + WAF
H. ECR 레포지토리 생성 (mirai-seung)
I. GitHub Secrets 등록

[코드 변경 — PR]
1. services/seung/src/app/api/health/route.ts   ← 신규
2. services/seung/Dockerfile                     ← 신규 (#135에서 진행)
3. services/seung/entrypoint.sh                  ← 신규 (#135에서 진행)
4. services/seung/next.config.ts                 ← output: "standalone" 추가 (#135에서 진행)
5. .github/workflows/deploy-seung.yml            ← 신규

[배포]
6. PR 머지 → GitHub Actions 자동 실행 (ECR 빌드·푸시 → EC2 재시작)
   또는 최초 1회 수동 docker run

[검증]
7. ALB 헬스체크 통과 확인
8. 배포 URL end-to-end 동작 확인
9. services/seung/.ai.md 진행 상태 업데이트
```

---

## 주의사항

| 항목 | 내용 |
|------|------|
| EC2 포트 충돌 | 같은 EC2에 다른 컨테이너가 3000을 점유 중이면 `docker run -p 3001:3000`으로 변경 후 ALB 타겟 그룹 포트도 맞춰야 함 |
| EC2 보안 그룹 | 3000번은 ALB 보안 그룹에서만 허용 — IP 직접 오픈 금지 |
| ENGINE_BASE_URL | 같은 VPC 내 private IP 사용 — 퍼블릭 도메인 경유 시 불필요한 레이턴시 발생 |
| NEXT_PUBLIC_* | 빌드 타임 ARG로 주입 — `~/.env.seung`에 넣으면 적용 안됨. GitHub Secrets에 등록해야 함 |
| Prisma migrate | 컨테이너 시작 시 entrypoint에서 자동 실행 — DIRECT_URL DB 연결 가능 여부 사전 확인 필수 |
| WAF body size | seung은 PDF 업로드 기능 있음 — WAF body size restriction 룰이 파일 업로드를 차단할 수 있음. 배포 후 반드시 확인 |
| ACM 검증 대기 | 인증서 DNS 검증은 수십 분 소요 — ALB HTTPS 리스너 설정 전 발급 완료 확인 필요 |
| `.ai.md` 업데이트 | `services/seung/.ai.md` 진행 상태 업데이트 — CLAUDE.md 규칙상 생략 시 작업 미완료로 간주 |
| CRLF (entrypoint.sh) | Windows 환경에서 작성된 `entrypoint.sh`가 CRLF로 커밋되면 Alpine에서 실행 실패 — #135 Dockerfile에서 `RUN sed -i 's/\r$//' ./entrypoint.sh`로 처리 |
