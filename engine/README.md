# MirAI Engine

FastAPI 기반 AI 엔진. PDF 파싱, LLM 호출, 면접 질문 생성을 담당한다.

---

## 환경변수

| 변수 | 설명 | 필수 |
|------|------|------|
| `OPENROUTER_API_KEY` | OpenRouter API 키 | ✅ |
| `OPENROUTER_MODEL` | 사용할 모델 ID (기본값: `google/gemini-2.5-flash`) | — |

`engine/.env` 파일을 만들어 로컬에서 관리한다 (git 미추적):
```
OPENROUTER_API_KEY=sk-...
OPENROUTER_MODEL=google/gemini-2.5-flash
```

---

## 로컬 개발

### Python 직접 실행

```bash
cd engine
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

### 테스트

```bash
cd engine
pytest
```

---

## Docker

### 빌드

```bash
cd engine
docker build -t mirai-engine .
```

### 구동 (로컬)

```bash
docker run --rm -p 8000:8000 --env-file .env mirai-engine
```

### 구동 (EC2 — 자동 재시작 포함)

```bash
docker run -d --restart unless-stopped \
  -p 8000:8000 \
  --env-file /home/ec2-user/mirai-engine.env \
  mirai-engine
```

### 헬스 확인

```bash
curl http://localhost:8000/
# {"status":"ok"}
```

---

## 환경변수 운영

### CI/CD (GitHub Actions) 연동

로컬 `.env`를 GitHub Secrets에 동기화:

```bash
# engine/ 루트에서 실행 (변경 시마다 재실행)
gh secret set --env-file .env

# 확인
gh secret list
```

GitHub Actions에서 주입 예시:
```yaml
- name: Deploy
  env:
    OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
  run: |
    docker run -d --restart unless-stopped -p 8000:8000 \
      -e OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
      mirai-engine
```

---

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/` | 헬스 체크 |
| `POST` | `/api/resume/questions` | PDF → 면접 질문 생성 |
| `POST` | `/api/interview/start` | 면접 세션 시작 |
| `POST` | `/api/interview/answer` | 답변 처리 → 다음 질문 |
| `POST` | `/api/interview/followup` | 심화 질문 생성 |

상세 계약은 `engine/.ai.md` 참고.
