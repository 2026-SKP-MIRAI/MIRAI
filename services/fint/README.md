# mirai-fint

자소서 기반 모의면접 서비스 (Next.js 15)

## 로컬 개발

```bash
cd services/fint
npm install
npm run dev          # http://localhost:3000
```

## Docker 빌드

```bash
cd services/fint
docker build -t mirai-fint .
```

## Docker 구동

```bash
docker run -d --restart unless-stopped -p 3000:3000 \
  -e ENGINE_BASE_URL=https://engine.mirainterview.com \
  mirai-fint
```

로컬 테스트 시:

```bash
docker run --rm -p 3000:3000 --env-file .env mirai-fint
```

## 환경변수

| 변수 | 필수 | 기본값 | 설명 |
|------|------|--------|------|
| `ENGINE_BASE_URL` | 아니오 | `http://localhost:8000` | 엔진 API 주소 |

## 헬스 확인

```bash
curl http://localhost:3000/
# 기대값: 200 OK
```

