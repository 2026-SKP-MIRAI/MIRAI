# [#66] chore: engine Dockerize — 구현 계획

> 작성: 2026-03-12 | 리뷰: Architect·Critic 완료

---

## 완료 기준

- [ ] `engine/Dockerfile` 작성 (python:3.12-slim 기반, non-root user 포함)
- [ ] `docker build` 로컬 빌드 성공
- [ ] `docker run` 으로 `GET /` 응답 확인 (`{"status": "ok"}`)
- [ ] `engine/.dockerignore` 작성 (tests/, .venv/, .env 등 제외)
- [ ] `engine/README.md` 작성 (빌드·구동·환경변수 운영 가이드)
- [ ] `engine/.ai.md` 최신화 (Docker 실행 정보 한 줄 추가)

> ⚠️ 이슈 문서는 `GET /health`로 기재됐으나 실제 헬스 엔드포인트는 `GET /` (`engine/app/main.py:36`)

---

## 구현 계획

### Step 1 — `engine/Dockerfile` 작성

**목표**: 보안을 고려한 컨테이너 빌드 후 uvicorn으로 FastAPI 앱 실행

```dockerfile
FROM python:3.12-slim

# 로그 버퍼링 비활성화 (stdout 실시간 출력)
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# 의존성만 먼저 복사 → 캐시 레이어 최적화
# (코드만 변경 시 pip install 재실행 안 함)
COPY pyproject.toml .
RUN pip install --no-cache-dir .

# 앱 소스 복사
COPY app/ app/

# 보안: non-root user 실행
RUN useradd -m appuser
USER appuser

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**근거**:
- `engine/pyproject.toml:3` — requires-python = ">=3.12", `python:3.12-slim` 충족
- `engine/pyproject.toml:5-13` — `pip install .` 로 13개 의존성 설치
- `engine/app/main.py:12` — 진입점 `app.main:app`
- `engine/app/main.py:36` — 헬스 엔드포인트 `GET /`
- COPY 순서: pyproject.toml → pip install → app/ (코드 변경 시 의존성 재설치 방지)
- PYTHONUNBUFFERED: 로그가 uvicorn에서 즉시 stdout으로 출력됨
- non-root user: 컨테이너 보안 모범 사례 (API 키 노출 위험 최소화)

### Step 2 — `engine/.dockerignore` 작성

빌드 컨텍스트에서 제외할 파일/디렉토리:

```
.venv/
__pycache__/
*.pyc
*.pyo
tests/
.git/
.gitignore
*.md
docs/
.env
```

**근거**:
- `.env` 명시적 제외 — API 키 등 민감 정보가 이미지에 포함되지 않도록 (`engine/app/config.py:8`)
- `tests/`, `.venv/`, `__pycache__` — 런타임 불필요
- `*.md`, `docs/` — 문서 파일 제외로 이미지 크기 최소화

### Step 3 — 로컬 빌드·실행 검증

```bash
# engine/ 디렉토리에서 실행
cd engine

# 빌드
docker build -t mirai-engine .

# 실행 (환경변수는 -e 플래그 또는 --env-file로 주입)
docker run --rm -p 8000:8000 \
  -e OPENROUTER_API_KEY=<key> \
  mirai-engine

# 헬스 확인
curl http://localhost:8000/
# 기대값: {"status":"ok"}
```

---

## 환경변수 처리

엔진은 `engine/app/config.py`에서 환경변수를 읽는다. Docker 실행 시 `-e` 플래그 또는 `--env-file` 옵션으로 주입한다. `.env` 파일은 이미지에 포함하지 않는다 (`.dockerignore`로 제외).

---

## 검증 방법

| 항목 | 명령어 | 기대 결과 |
|------|--------|-----------|
| 빌드 성공 | `docker build -t mirai-engine .` | 오류 없이 완료 |
| 컨테이너 기동 | `docker run --rm -p 8000:8000 -e OPENROUTER_API_KEY=<key> mirai-engine` | uvicorn 로그 출력 |
| 헬스 응답 | `curl http://localhost:8000/` | `{"status":"ok"}` |

---

## 환경변수 운영 가이드

### 로컬 개발
```bash
# engine/.env 파일로 관리 (git 미추적)
docker run --rm -p 8000:8000 --env-file .env mirai-engine
```

### CI/CD 자동 배포 (GitHub Actions + ECR 연동 시)

`.env` → GitHub Actions Secrets 동기화:
```bash
# 로컬에서 한 번만 실행 (변경 시마다 재실행)
gh secret set --env-file engine/.env

# 확인
gh secret list
```

GitHub Actions에서 주입:
```yaml
# .github/workflows/deploy.yml
- name: Deploy to EC2
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: |
    ssh ec2-user@<ip> "docker run -d -p 8000:8000 \
      -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
      <ecr-url>/mirai-engine:latest"
```

| 단계 | 방식 | 비고 |
|------|------|------|
| 로컬 개발 | `--env-file .env` | `.env`는 git 미추적 |
| CI/CD 자동 배포 | GitHub Actions Secrets | `gh secret set --env-file` 로 동기화 |
| AWS 인프라 확장 시 | SSM Parameter Store | ECS 전환 등 대규모 운영 시 |

---

### Step 4 — `engine/README.md` 작성

사람이 읽는 운영 가이드. 다음 내용 포함:

- **로컬 개발**: `pip install -e ".[dev]"` + uvicorn 직접 실행
- **Docker 빌드**: `docker build -t mirai-engine .`
- **Docker 구동**: `docker run -d --restart unless-stopped -p 8000:8000 --env-file .env mirai-engine`
- **환경변수 목록**: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`
- **GitHub Secrets 동기화**: `gh secret set --env-file engine/.env`
- **헬스 확인**: `curl http://localhost:8000/`

### Step 5 — `engine/.ai.md` 최신화

기존 `.ai.md`에 Docker 실행 정보 한 줄 추가:
- 실행 방식: Docker 컨테이너, 포트 8000, 진입점 `app.main:app`

---

## 이번 이슈 범위 밖 (추후 고려)

- Graceful shutdown (ALB draining 대응) — uvicorn `--timeout-keep-alive` 설정
- 헬스 체크 강화 — API 키 유효성 확인 엔드포인트 (`GET /health`)
- Docker 이미지 버전 고정 (`python:3.12.1-slim`)
- ECR 리포지토리 생성 + GitHub Actions CI/CD 파이프라인

---

## 참고 파일

- `engine/pyproject.toml` — 의존성 정의 (pip install . 기반)
- `engine/app/main.py` — FastAPI 진입점, 헬스 엔드포인트 (line 36)
- `engine/app/config.py` — 환경변수 설정 (OPENROUTER_API_KEY)
