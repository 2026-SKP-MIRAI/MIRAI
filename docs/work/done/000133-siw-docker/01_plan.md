# [#133] chore: siw Docker 배포 안정화 — Prisma symlink 수정, 스테이지 빌드 강화, 헬스체크 추가 — 구현 계획

> 작성: 2026-03-18

---

## 완료 기준

- [x] Docker 빌드 성공 (로컬 검증 완료)
- [x] EC2 배포 후 컨테이너 크래시 없이 기동 — `docker ps`에서 `Up` 확인, ALB 통해 HTML 응답 확인
- [x] `docker logs siw`에서 `prisma migrate deploy` 성공 확인 — `No pending migrations to apply.` 확인
- [x] HEALTHCHECK 동작 확인 — `Status: healthy` 확인 (localhost → 127.0.0.1 수정 후)

---

## 구현 계획

### 1. `services/siw/entrypoint.sh` ✅
**문제**: `./node_modules/.bin/prisma`는 symlink → Docker COPY 시 파일로 변환 → `__dirname`이 `.bin/`으로 고정 → `prisma_schema_build_bg.wasm` 탐색 실패
**해결**: `node node_modules/prisma/build/index.js migrate deploy` 직접 호출 (패키지 진입점은 public contract)

### 2. `services/siw/Dockerfile` ✅
**deps 단계**
- `prisma.config.ts` 복사 추가 → `npm ci` postinstall 시 `prisma generate`가 config 인식

**builder 단계**
- `RUN npx prisma generate` 명시 추가
  - 이유: schema만 변경되고 `package-lock.json`이 변경되지 않으면 `deps` 레이어 캐시 재사용 → `prisma generate` 미실행 → stale client 배포
  - 해결: builder 단계에서 항상 재실행 보장

**runner 단계**
- `node_modules/.bin/prisma` 단독 복사 제거 (symlink 문제 원인)
- `prisma.config.ts` 복사 추가 → `migrate deploy` 시 `DIRECT_URL` 적용 및 schema 경로 명시
- `HEALTHCHECK` 추가 → Docker가 unhealthy 컨테이너 감지 가능
  ```
  HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
  ```
  - 주의: `localhost` 사용 시 Alpine 컨테이너에서 `::1`(IPv6)로 resolve → 서버가 IPv4만 리스닝하므로 Connection refused 발생 → `127.0.0.1` 명시 필요
- OpenSSL 주석 개선 → 실수로 제거 시 DB 연결 불가 명시

### 3. `services/siw/prisma.config.ts` ✅
- `import "dotenv/config"` 제거
  - `dotenv`가 `package.json` direct dependency가 아닌 transitive dep
  - Docker builder에서 top-level `node_modules/dotenv/` 미존재 → 빌드 실패 유발
  - Docker 컨테이너에서는 `--env-file`로 env 주입되므로 불필요
  - Prisma CLI는 `.env` 파일을 자체적으로 로드하므로 로컬 개발에도 무방

### 4. `services/siw/next.config.ts` ✅
- `outputFileTracingIncludes` 추가
  - Next.js standalone 빌드 시 `@vercel/nft` 파일 트레이서가 pdf-parse 내부 파일 누락 가능
  - `/api/**` 라우트에 `node_modules/pdf-parse/**/*` 강제 포함

### 5. `.github/workflows/deploy-siw.yml` ✅
- `docker run` 전 `~/.env.siw` 존재 확인 추가
  - env 파일 누락 시 컨테이너가 시작 직후 종료되어 원인 파악 어려움
  - 배포 초기에 명시적 에러로 조기 실패하도록 개선
