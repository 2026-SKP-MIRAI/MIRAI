# chore: services/seung Dockerize

## 목적
services/seung를 Docker 컨테이너로 빌드하고 EC2에서 실행 가능하게 한다.

## 배경
EC2 배포 시 일관된 환경에서 seung Next.js 서비스를 실행하기 위해 Dockerize가 필요하다.

## 완료 기준
- [x] `services/seung/Dockerfile` 작성 (node:20-alpine, multi-stage build)
- [x] `services/seung/entrypoint.sh` 작성 (Prisma migrate deploy + node server.js)
- [x] `docker build` 로컬 빌드 성공
- [ ] `docker run` 으로 서비스 정상 응답 확인 (EC2 배포 후 확인)
- [x] `services/seung/.dockerignore` 작성 (node_modules/, .next/, .env* 등 제외)

## 개발 체크리스트
- [x] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### 2026-03-18

**생성 파일:**
- `services/seung/Dockerfile` — node:20-alpine, 3-stage build (deps/builder/runner)
- `services/seung/entrypoint.sh` — DATABASE_URL/DIRECT_URL/ENGINE_BASE_URL 검증 + migrate deploy + node server.js
- `services/seung/.dockerignore`
- `services/seung/prisma.config.ts` — migrate deploy 시 DIRECT_URL 사용 (PgBouncer 우회)

**수정 파일:**
- `services/seung/next.config.ts` — `output: 'standalone'` 추가
- `services/seung/.ai.md` — Dockerize 완료 반영

**로컬 빌드 검증:**
- `docker build` 성공 ✅
- `Loaded Prisma config from prisma.config.ts` 확인 ✅
- entrypoint.sh env 검증 동작 확인 ✅
- standalone에 pdf-parse 포함 확인 ✅
- 단위 테스트 89개 통과 ✅

