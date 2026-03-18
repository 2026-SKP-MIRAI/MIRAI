# siw (Seung Interview Wizard)

MirAI의 AI 면접 서비스. Next.js 기반 웹 앱.

---

## 로컬 Docker 빌드

```bash
cd services/siw

docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url> \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key> \
  -t mirai-siw:local .
```

---

## 로컬 Docker 실행

```bash
# mirai 네트워크 생성 (engine과 통신용, 이미 있으면 무시)
docker network create mirai || true

docker run -d --name siw \
  --network mirai \
  -p 3000:3000 \
  -e DATABASE_URL=<your-database-url> \
  -e DIRECT_URL=<your-direct-url> \
  -e SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> \
  -e ENGINE_BASE_URL=http://engine:8000 \
  -e SUPABASE_STORAGE_BUCKET=<your-bucket> \
  mirai-siw:local
```

브라우저에서 `http://localhost:3000` 접속 확인.

### 정리
```bash
docker stop siw && docker rm siw
```

---

## 환경변수 목록

| 변수명 | 주입 시점 | 설명 |
|--------|-----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | 빌드 타임 (`--build-arg`) | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 빌드 타임 (`--build-arg`) | Supabase anon key |
| `DATABASE_URL` | 런타임 (`--env-file`) | Supabase pooler URL (port 6543) |
| `DIRECT_URL` | 런타임 (`--env-file`) | Supabase direct URL (port 5432) |
| `SUPABASE_SERVICE_ROLE_KEY` | 런타임 (`--env-file`) | Supabase service role key |
| `ENGINE_BASE_URL` | 런타임 (`--env-file`) | engine 서비스 URL (`http://engine:8000`) |
| `SUPABASE_STORAGE_BUCKET` | 런타임 (`--env-file`) | Supabase storage bucket 이름 |

> **주의**: `NEXT_PUBLIC_*` 변수는 빌드 시 번들에 인라인되므로 반드시 `--build-arg`로 주입해야 합니다. `docker run -e`로는 적용되지 않습니다.

---

## Docker 네트워크

siw와 engine은 `mirai` Docker bridge 네트워크로 통신합니다.

```bash
docker network create mirai
```

- siw → engine 통신: `ENGINE_BASE_URL=http://engine:8000`
- engine 컨테이너는 `--name engine`으로 실행되어야 DNS 해석 가능

---

## Prisma 마이그레이션

컨테이너 시작 시 `entrypoint.sh`에서 자동으로 `prisma migrate deploy`를 실행합니다.

수동 실행이 필요한 경우:
```bash
docker exec -it siw npx prisma migrate deploy
```

---

## GitHub Secrets 동기화 가이드

GitHub → repo → Settings → Secrets and variables → Actions

| Secret | 값 |
|--------|----|
| `AWS_ACCESS_KEY_ID` | IAM 유저 액세스 키 |
| `AWS_SECRET_ACCESS_KEY` | IAM 유저 시크릿 키 |
| `AWS_REGION` | `ap-northeast-2` |
| `ECR_REGISTRY` | `{account_id}.dkr.ecr.ap-northeast-2.amazonaws.com` |
| `SIW_EC2_HOST` | EC2 퍼블릭 IP (또는 탄력적 IP) |
| `SIW_EC2_USER` | `ubuntu` |
| `EC2_SSH_KEY` | `.pem` 파일 전체 내용 |
| `SIW_NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `SIW_NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
