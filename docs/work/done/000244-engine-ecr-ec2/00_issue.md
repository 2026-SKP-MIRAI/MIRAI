# chore: [engine] ECR + EC2 GitHub Actions 자동 배포 파이프라인 구축

## 목적
engine 서비스를 ECR에 이미지로 관리하고, main push 시 GitHub Actions가 자동으로
EC2에 배포하는 CI/CD 파이프라인을 구축한다.

## 배경
현재 engine EC2는 SSH 접속 후 git pull → docker rebuild 수동 방식으로 배포한다.
kwan(#219), siw(#117), seung(#132/#135)와 동일한 ECR + EC2 패턴을 적용해
engine/** 변경 시 자동 배포되도록 한다.

기능06(#201)이 engine 코드를 수정하므로, 이 이슈가 먼저 완료되면 이후 engine 변경은
모두 자동 배포된다. 두 이슈는 서로 다른 파일을 수정하므로 충돌 없음.

## 완료 기준

### 코드 작업
- [x] `.github/workflows/deploy-engine.yml` 생성 — `push: main (engine/**)` + `workflow_dispatch (skip_build)` → ECR 빌드·푸시 → EC2 SSH → engine 컨테이너 재시작, `--restart unless-stopped`

### 로컬 검증
- [x] `docker build` 로컬 빌드 성공 확인 (engine/Dockerfile 기준)
- [x] `GET /` 200 응답 확인 (`{"status": "ok"}`)

### 운영 설정 (수동)
- [x] 공용 AWS Secrets 사전 확인 (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `ECR_REGISTRY`, `EC2_SSH_KEY` — 기존 등록됨)
- [x] `mirai-engine` ECR 레포 생성 (AWS Console → ECR → Private)
- [x] EC2 기존 컨테이너 이름 확인 (`docker ps`) — `mirai-engine` 실행 중 확인, 워크플로우에서 stop/rm 처리
- [x] EC2 서버에 `~/.env.engine` 파일 생성 — `OPENROUTER_API_KEY` 포함 생성 완료
- [x] GitHub Secrets 등록: `ENGINE_EC2_HOST`, `ENGINE_EC2_USER` GitHub Secrets 등록 완료

### 개발 체크리스트
- [x] `.github/workflows/.ai.md` 최신화 (deploy-engine.yml 흐름 추가)
- [x] `engine/.ai.md` 최신화 (ECR 기반 배포 방식, `~/.env.engine` 경로, 컨테이너명 반영)

## 구현 플랜
1. `deploy-engine.yml` 생성 — kwan 패턴 기반
   - 트리거: `push: main, paths: engine/**` + `workflow_dispatch (skip_build: boolean, default: false)`
   - `build-and-push-engine` job (`if: github.event_name == 'push' || inputs.skip_build == false`):
     ECR 로그인 → `docker build -t $ECR_REGISTRY/mirai-engine:latest -t $ECR_REGISTRY/mirai-engine:$sha -f engine/Dockerfile engine` → `docker push --all-tags`
   - `deploy` job (`if: always() && (needs.build-and-push-engine.result == 'success' || needs.build-and-push-engine.result == 'skipped')`):
     SSH → `~/.env.engine` 존재 확인 → 기존 컨테이너 정리 → pull → `docker image prune -f` → `docker run -d --name mirai-engine --restart unless-stopped --env-file ~/.env.engine -p 8000:8000`
2. EC2 `~/.env.engine` 세팅 — 기존 컨테이너 확인 후 `engine/.env` 내용 복사
3. `mirai-engine` ECR 레포 생성
4. GitHub Secrets 등록

---

## 작업 내역

### `.github/workflows/deploy-engine.yml` (신규)

siw 패턴 기반으로 engine 전용 GitHub Actions 워크플로우를 생성했다.

- **트리거**: `push to main (engine/**)` + `workflow_dispatch (skip_build: boolean)`
- **`build-and-push-engine` job**: ECR 로그인 → `docker build -f engine/Dockerfile engine` (build-arg 없음, engine은 런타임 env만 사용) → `docker push --all-tags` (latest + sha 태그)
- **`deploy` job**: `appleboy/ssh-action@v1`으로 EC2 SSH → `~/.env.engine` 존재 확인 (없으면 exit 1) → 기존 `mirai-engine` 컨테이너 stop/rm → pull → `docker image prune -f` → `docker run --restart unless-stopped -p 8000:8000 --env-file ~/.env.engine`
- **siw 대비 차이점**: build-arg 없음, 포트 8000, 컨테이너명 `mirai-engine`, env 파일 `~/.env.engine`, Secrets `ENGINE_EC2_HOST`·`ENGINE_EC2_USER`

### `.github/workflows/.ai.md` (수정)

- 구조 섹션에 `deploy-seung.yml`, `deploy-engine.yml` 추가
- 워크플로우 현황 테이블에 engine 행 추가 (`push: main (engine/**)`, 공용, ✅ 추가됨)
- engine 전용 GitHub Secrets 섹션 추가 (`ENGINE_EC2_HOST`, `ENGINE_EC2_USER`)
- `deploy-engine.yml 흐름` 섹션 추가 (build-arg 없음, `~/.env.engine` 존재 확인, `workflow_dispatch skip_build` 동작 설명)

### `engine/.ai.md` (수정)

- 배포 방식 업데이트: 수동(SSH → git pull → docker rebuild) → ECR 기반 자동 배포
- ECR 레포명 (`mirai-engine`), 컨테이너명, 포트 (`8000`), env 파일 경로 (`~/.env.engine`), 워크플로우 참조 (`deploy-engine.yml`) 추가
- 로컬 빌드 커맨드 경로 수정 (`-f engine/Dockerfile engine` 형식으로 명시)

### 운영 설정 (수동 완료)

- `mirai-engine` ECR private 레포 AWS Console에서 생성
- EC2에 `~/.env.engine` 파일 생성 (`OPENROUTER_API_KEY` 포함)
- EC2에 AWS CLI v2 설치 (ECR 로그인에 필요, 기존에 없었음)
- GitHub Secrets에 `ENGINE_EC2_HOST`, `ENGINE_EC2_USER` 등록

### 로컬 검증

- `docker build -t mirai-engine-test -f engine/Dockerfile engine` → 성공 (`#12 DONE 3.9s`)
- `docker run -d -p 8001:8000 --env-file engine/.env mirai-engine-test` → `GET http://localhost:8001/` → `{"status":"ok"}` 200 응답

