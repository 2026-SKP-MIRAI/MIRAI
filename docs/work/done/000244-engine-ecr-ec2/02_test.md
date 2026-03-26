# [#244] 로컬 검증 결과

> 작성: 2026-03-25

---

## 1. docker build

```bash
docker build -t mirai-engine-test -f engine/Dockerfile engine
```

**결과: ✅ 성공**

```
#12 unpacking to docker.io/library/mirai-engine-test:latest done
#12 DONE 3.9s
```

---

## 2. GET / 헬스체크

```bash
# 8001 → 로컬 포트 충돌 방지용 (실제 배포는 8000:8000)
docker run -d --name mirai-engine-test -p 8001:8000 \
  --env-file engine/.env mirai-engine-test

curl http://localhost:8001/
```

**결과: ✅ 200 OK**

```json
{"status":"ok"}
```

---

## 완료 기준 체크

- [x] `docker build` 로컬 빌드 성공 확인 (engine/Dockerfile 기준)
- [x] `GET /` 200 응답 확인 (`{"status": "ok"}`)
