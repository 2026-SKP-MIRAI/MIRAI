# chore: engine Dockerize

## 목적
engine을 Docker 컨테이너로 빌드하고 EC2에서 실행 가능하게 한다.

## 배경
EC2 배포 시 의존성 충돌 없이 일관된 환경에서 엔진을 실행하기 위해 Dockerize가 필요하다.

## 완료 기준
- [x] `engine/Dockerfile` 작성 (python:3.12-slim 기반)
- [x] `docker build` 로컬 빌드 성공
- [x] `docker run` 으로 `GET /` 응답 확인 (`{"status":"ok"}`)
- [x] `.dockerignore` 작성 (tests/, .venv/, __pycache__ 등 제외)

## 구현 플랜
1. `engine/Dockerfile` 작성
   - python:3.12-slim 베이스
   - pyproject.toml 기반 의존성 설치 (`pip install .`)
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000` 실행
2. `engine/.dockerignore` 작성
3. 로컬 빌드 및 실행 확인

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### engine/Dockerfile
`python:3.12-slim` 기반 Dockerfile 작성. 레이어 캐시 효율화를 위해 `pyproject.toml` 복사 후 `pip install`, 이후 앱 소스를 복사하는 순서로 구성. `PYTHONUNBUFFERED=1`로 로그 실시간 출력, `useradd -m appuser` + `USER appuser`로 non-root 실행.

### engine/.dockerignore
`.venv/`, `__pycache__/`, `tests/`, `.git/`, `docs/`, `.env` 등 런타임 불필요 파일 제외. `.env`는 API 키 보호를 위해 명시적으로 제외.

### engine/README.md
빌드·구동·환경변수 운영 가이드 문서 신규 작성. 로컬 개발, Docker 로컬 실행, EC2 자동 재시작(`--restart unless-stopped`) 방법 포함. GitHub Secrets 동기화(`gh secret set --env-file .env`) 및 CI/CD 주입 예시도 기재.

### engine/.ai.md
Docker 실행 섹션 추가 (포트 8000, non-root, 자동 재시작). 구조 트리에 `Dockerfile`, `.dockerignore`, `README.md` 항목 추가.

### 기술적 결정
- 이슈에서 `GET /health`를 완료 기준으로 명시했으나 실제 엔드포인트는 `GET /` (`app/main.py:36`). 계획 문서에 명시 후 `GET /`로 검증.
- 환경변수는 이미지에 굽지 않고 런타임 주입 방식 채택 → ECR+GitHub Actions 연동 시에도 동일 방식 사용 가능.
