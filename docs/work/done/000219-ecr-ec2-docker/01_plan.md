# [#219] chore: [kwan] ECR + EC2 Docker CI/CD 파이프라인 구축 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

### 코드 작업
- [x] `services/kwan/next.config.ts`에 `output: 'standalone'` 추가
- [x] `services/kwan/src/app/api/health/route.ts` 생성 — `GET /api/health` 헬스체크 라우트
- [x] `services/kwan/Dockerfile` 생성 — Next.js standalone 멀티스테이지 빌드 (node:20-alpine), non-root user, Prisma node_modules 전체 복사, CRLF 처리
- [x] `services/kwan/entrypoint.sh` 생성 — `set -e`, env guard (`DATABASE_URL` / `DIRECT_URL` / `ENGINE_BASE_URL`), `DATABASE_URL="$DIRECT_URL" ./node_modules/.bin/prisma migrate deploy`, `exec node server.js`
- [x] `services/kwan/.dockerignore` 생성 — `.next`, `node_modules`, `.env*` 제외
- [x] `.github/workflows/deploy-kwan.yml` 생성 — main push 시 kwan ECR 빌드·푸시 → EC2 SSH 접속 → kwan 컨테이너 재시작, `--restart unless-stopped` 포함

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인
- [x] `docker run` 로컬 실행 후 `http://localhost:3000` 응답 확인
- [x] `GET /api/health` 200 응답 확인

### kwan 특수 처리
- [x] NEXT_PUBLIC_* 없음 — `--build-arg` 불필요
- [x] `prisma.config.ts` 없음 — Dockerfile deps 스테이지에서 `COPY prisma.config.ts` 줄 제거 (seung 기반 복붙 시 반드시 제거, 없으면 `COPY failed: file not found` 빌드 실패)
- [x] `prisma/migrations/` 없음 — **Dockerfile 작업 전 선행 필수**: `npx prisma migrate dev --name init` 실행하여 초기 마이그레이션 생성. 이 단계 없이 컨테이너 기동 시 `migrate deploy` 런타임에 "No migration found" 오류로 서비스 시작 불가
- [x] Prisma 마이그레이션 처리 — `entrypoint.sh`에서 `DATABASE_URL="$DIRECT_URL" ./node_modules/.bin/prisma migrate deploy` (seung 방식, PgBouncer 우회 / `./node_modules/.bin/prisma`로 로컬 바이너리 명시 참조)
- [x] `DIRECT_URL` — EC2 env-file에 포함
- [x] `ENGINE_BASE_URL` — EC2 env-file에 engine 호스트 주소로 설정

### 운영 설정 (수동)
- [x] `mirai-kwan` ECR 레포 생성
- [x] kwan EC2 인스턴스 생성 + Docker + AWS CLI 설치
- [x] `~/.env.kwan` 환경변수 파일 생성
- [x] ALB + ACM + Route53 + WAF 구성
- [x] GitHub Secrets 등록:
  - `KWAN_EC2_HOST` — kwan EC2 퍼블릭 IP (신규)
  - `KWAN_EC2_USER` — `ubuntu` (신규)
  - `EC2_SSH_KEY` — PEM 키 (기존 등록됨, 재사용)
  - `AWS_ACCESS_KEY_ID` (기존 등록됨, 재사용)
  - `AWS_SECRET_ACCESS_KEY` (기존 등록됨, 재사용)
  - `AWS_REGION` (기존 등록됨, 재사용)
  - `ECR_REGISTRY` (기존 등록됨, 재사용)

### 개발 체크리스트
- [x] `services/kwan/.ai.md` 최신화
- [x] `.github/workflows/.ai.md` 최신화

---

## 구현 계획

> siw(#117), seung(#132/#135) 패턴 분석 완료. kwan은 **seung 패턴** 기반으로 구현.

### siw vs seung vs kwan 패턴 비교

| 항목 | siw | seung | kwan |
|------|-----|-------|------|
| NEXT_PUBLIC_* `--build-arg` | ✅ | ✅ | ❌ 없음 |
| node_modules 복사 방식 | 선택적 | 전체 | 전체 (seung 따름) |
| CRLF 처리 (`sed -i 's/\r$//'`) | ❌ | ✅ | ✅ |
| HEALTHCHECK 경로 | `/` | `/api/health` | `/api/health` |
| env-file | `~/.env.siw` | `~/.env.seung` | `~/.env.kwan` |
| EC2 secret 이름 | `SIW_EC2_HOST` | `SEUNG_EC2_HOST` | `KWAN_EC2_HOST` |

### 파일별 구현 상세

#### 1. `services/kwan/next.config.ts` — 수정
- `output: 'standalone'` 한 줄 추가 (현재 빈 config 객체 — 충돌 없음)

#### 2. `services/kwan/src/app/api/health/route.ts` — 신규
```ts
export async function GET() {
  return Response.json({ status: 'ok' });
}
```

#### 3. `services/kwan/Dockerfile` — 신규 (seung 기반, 아래 차이점 주의)
- Stage 1 `deps`: `node:20-alpine`, `npm ci`
  - **`COPY prisma.config.ts` 줄 제거** — kwan에 해당 파일 없음
- Stage 2 `builder`: `prisma generate` → `npm run build`
  - **NEXT_PUBLIC_* ARG/ENV 블록 없음**
- Stage 3 `runner`:
  - `openssl` 설치, non-root user (`nodejs`/`nextjs`)
  - standalone + static 복사
  - `node_modules` 전체 복사 + `prisma/` 복사
  - **`prisma.config.ts` COPY 없음** — runner 스테이지에도 불필요
  - `# NOTE: services/kwan/public/ 디렉토리 없으므로 COPY 생략 (생기면 추가)` 주석 포함 (siw/seung 패턴 일치)
  - `entrypoint.sh` 복사 + `sed -i 's/\r$//'` CRLF 처리
  - `HEALTHCHECK` → `wget -qO- http://127.0.0.1:3000/api/health`
  - `EXPOSE 3000`, `ENV PORT=3000 HOSTNAME=0.0.0.0`

#### 4. `services/kwan/entrypoint.sh` — 신규 (seung 기반)
- env guard: `DATABASE_URL`, `DIRECT_URL`, `ENGINE_BASE_URL` 확인
- `DATABASE_URL="$DIRECT_URL" ./node_modules/.bin/prisma migrate deploy`
- `exec node server.js`

#### 5. `services/kwan/.dockerignore` — 신규 (seung 기반)
- `node_modules/`, `.next/`, `.env*`, `coverage/`, `tests/`, `*.test.ts`, `.git/` 등 제외

#### 6. `.github/workflows/deploy-kwan.yml` — 신규 (deploy-seung.yml 기반)
- 트리거: `push: branches: [main], paths: services/kwan/**` + `workflow_dispatch` (`skip_build: boolean, default: false` input 포함 — 빌드 생략·재시작 전용, siw/seung 운영 일관성)
- `build-and-push-kwan` job: ECR 로그인 → `docker build` (**--build-arg 없음**) → `mirai-kwan:latest` + `mirai-kwan:$sha` push
- `deploy` job: SSH (`KWAN_EC2_HOST`/`KWAN_EC2_USER`/`EC2_SSH_KEY`)
  - **`~/.env.kwan` 존재 확인 로직 포함** (siw 방식 채택 — 없으면 배포 중단)
  - 기존 컨테이너 정리 → pull → `docker image prune -f`
  - `docker run -d --name kwan --restart unless-stopped --env-file ~/.env.kwan -p 3000:3000`
