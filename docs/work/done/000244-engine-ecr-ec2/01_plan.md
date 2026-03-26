# [#244] chore: [engine] ECR + EC2 GitHub Actions 자동 배포 파이프라인 구축 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

### 코드 작업
- [x] `.github/workflows/deploy-engine.yml` 생성 — `push: main (engine/**)` + `workflow_dispatch (skip_build)` → ECR 빌드·푸시 → EC2 SSH → engine 컨테이너 재시작, `--restart unless-stopped`

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인 (engine/Dockerfile 기준)
- [x] `GET /` 200 응답 확인 (`{"status": "ok"}`)

### 운영 설정 (수동)
- [x] 공용 AWS Secrets 사전 확인 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_SSH_KEY` — 기존 등록됨)
- [x] `mirai-engine` ECR 레포 생성 (AWS Console → ECR → Private)
- [x] EC2 기존 컨테이너 이름 확인 (`docker ps`) — `mirai-engine` 실행 중 확인
- [x] EC2 서버에 `~/.env.engine` 파일 생성 — `OPENROUTER_API_KEY` 포함
- [x] GitHub Secrets 등록: `ENGINE_EC2_HOST`, `ENGINE_EC2_USER`
- [x] EC2 AWS CLI 설치 — ECR 로그인에 필요 (`aws ecr get-login-password`)

### 개발 체크리스트
- [x] `.github/workflows/.ai.md` 최신화 (deploy-engine.yml 흐름 추가)
- [x] `engine/.ai.md` 최신화 (ECR 기반 배포 방식, `~/.env.engine` 경로, 컨테이너명 반영)

---

## 구현 계획

### 1. deploy-engine.yml 생성 (siw 패턴 기반)
- 트리거: `push: main, paths: engine/**` + `workflow_dispatch (skip_build: boolean)`
- `test-engine` job: Python 3.12 설치 → `pip install -e "engine[dev]"` → `pytest engine/tests/unit` (unit만, integration은 외부 API 필요)
- `build-and-push-engine` job: ECR 로그인 → docker build → docker push (latest + sha 태그) — test 통과 후 실행
- `deploy` job: SSH → ~/.env.engine 존재 확인 → 기존 컨테이너 정리 → pull → docker run → 헬스체크(30초) → 실패 시 롤백 → 성공 시 prune — test 통과 필수

### 2. siw 대비 차이점
- `--build-arg` 없음 (engine은 런타임 env만 사용)
- 컨테이너명: `mirai-engine`, 포트: `8000:8000`, env 파일: `~/.env.engine`
- Secrets: `ENGINE_EC2_HOST`, `ENGINE_EC2_USER` (신규), `EC2_SSH_KEY` (재사용)
- build context: `-f engine/Dockerfile engine` (siw: `-f services/siw/Dockerfile services/siw`)

### 3. siw vs seung vs kwan 패턴 비교

| 항목 | siw | seung | kwan (#219) | engine (#244) |
|------|-----|-------|-------------|---------------|
| `--build-arg` | O (SUPABASE_*) | O (SUPABASE_*) | X | **X** |
| env 파일 존재 확인 | O (`~/.env.siw`) | **X (누락)** | — | **O (`~/.env.engine`)** |
| entrypoint | — | — | `prisma migrate deploy` | **uvicorn 직접** |
| 포트 | 3000 | 3000 | 3000 | **8000** |
| 헬스체크 경로 | — | — | `/api/health` | **`GET /`** |

> **기준**: siw 패턴 (env 파일 존재 확인 포함). seung은 누락되어 있어 seung이 아닌 siw를 따름.

### 4. .ai.md 최신화
- `.github/workflows/.ai.md`: engine 행 추가 + deploy-engine.yml 흐름 섹션 추가
- `engine/.ai.md`: 배포 방식 수동 → ECR 자동, `~/.env.engine` 경로, 컨테이너명 반영

### 5. 충돌 분석

#### 기능 06 (#201) — 충돌 없음 (단, .ai.md 주의)
| 파일 | #244 | #201 |
|------|------|------|
| `.github/workflows/deploy-engine.yml` | 신규 | 미수정 |
| `.github/workflows/.ai.md` | 수정 | 미수정 |
| `engine/.ai.md` | **수정** | **수정** |
| `engine/app/analyzers/voice_analyzer.py` | 미수정 | 신규 |
| `engine/app/services/report_service.py` | 미수정 | 수정 |
| `engine/app/schemas.py` | 미수정 | 수정 |

- **`engine/.ai.md` 겹침**: #201은 Phase 4(Week 4+, 미정)로 244보다 훨씬 늦게 진행
- 244 완료 후 #201 브랜치 생성 시 리베이스하면 충돌 해결 가능 → **실질 위험 낮음**
- #201 시작 전 담당자에게 244 완료 사실 공유 권장

#### 이슈 #219 (kwan) — `.github/workflows/.ai.md` 동시 수정 주의
| 파일 | #244 | #219 |
|------|------|------|
| `.github/workflows/deploy-engine.yml` | 신규 | 미수정 |
| `.github/workflows/deploy-kwan.yml` | 미수정 | 신규 |
| `.github/workflows/.ai.md` | **수정** | **수정** |
| `services/kwan/**` | 미수정 | 수정 |

- **`.github/workflows/.ai.md` 겹침**: 두 이슈 모두 이 파일에 각 서비스 행을 추가
- 담당자 동일(gwanu260) → 순서 제어 가능
- **219가 먼저 머지된 경우**: `git rebase main` 후 `.ai.md` engine 행을 직접 추가
- **244가 먼저 머지된 경우**: 219가 리베이스 시 자동 반영 또는 수동 추가

### 6. 트리거 범위
- `engine/.ai.md`, `engine/README.md`는 paths 제외(`!` 패턴) — 문서만 수정 시 빌드 미발생
- 나머지 `engine/**` 변경은 모두 트리거

### 7. skip_build 동작
- `skip_build=true`: 빌드(ECR push) 생략 + pull 생략 → 현재 EC2에 있는 이미지로 컨테이너 재시작만 수행
- `SKIP_PULL` 환경변수로 deploy 스크립트에 전달 (envs 파라미터)
- guard: `SKIP_PULL=true` 진입 시 `$ECR_REGISTRY/mirai-engine:latest` 이미지 존재 여부 사전 확인 — 없으면 `exit 1` (pull 없이 시작 불가 명시)
