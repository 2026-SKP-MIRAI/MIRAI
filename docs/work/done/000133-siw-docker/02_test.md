# [#133] 테스트 결과

> 작성: 2026-03-18

---

## 테스트 환경

- 로컬 Docker Desktop (Windows 11 + WSL2)
- 이미지: `node:20-alpine`
- Prisma: 5.22.0
- Next.js: 15.5.12

---

## 1. 초기 배포 실패 확인

**EC2 `docker logs siw` 출력:**
```
Error: ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'
    at Object.openSync (node:fs:573:18)
    at /app/node_modules/.bin/prisma:19:14531
```
→ 컨테이너가 `Restarting (1)` 크래시 루프 반복

**원인 분석:**
```
node_modules/.bin/prisma  →  (원래) symlink → ../prisma/build/index.js
                              (Docker COPY 후) 실제 파일로 복사
                              → __dirname = /app/node_modules/.bin/
                              → prisma_schema_build_bg.wasm 탐색 위치: .bin/ (없음)
```

---

## 2. 수정 후 로컬 Docker 빌드 테스트

### 2-1. `.wasm` 파일 직접 복사 시도 (실패)

```dockerfile
COPY --from=builder /app/node_modules/.bin/prisma_schema_build_bg.wasm ...
```

**결과**: 빌드 오류
```
"/app/node_modules/.bin/prisma_schema_build_bg.wasm": not found
```
→ builder 단계의 `.bin/`에도 해당 파일 없음. symlink 경로(`prisma/build/`)에만 존재.

### 2-2. `node node_modules/prisma/build/index.js` 직접 호출 (성공)

`entrypoint.sh` 수정 + Dockerfile에서 `.bin/prisma` COPY 제거

**빌드 결과**: 성공
```
#23 naming to docker.io/library/siw-test:latest done
```

**CRLF 이슈 발생**: Windows에서 편집된 `entrypoint.sh`에 `\r\n` 포함
```
exec ./entrypoint.sh: no such file or directory
```
→ Python으로 LF 변환 후 재빌드 성공

### 2-3. 주요 파일 존재 확인

```bash
docker run --rm --entrypoint sh siw-test -c "ls \
  node_modules/prisma/build/prisma_schema_build_bg.wasm \
  node_modules/.prisma/client/ \
  node_modules/@prisma/ \
  prisma.config.ts"
```

**결과**:
```
node_modules/prisma/build/prisma_schema_build_bg.wasm  ✅
prisma.config.ts  ✅

node_modules/.prisma/client/:
  libquery_engine-linux-musl-openssl-3.0.x.so.node  ✅  (musl 바이너리)
  libquery_engine-linux-musl.so.node  ✅
  index.js, index.d.ts, wasm.js ...

node_modules/@prisma/:
  client, engines, engines-version, fetch-engine, get-platform  ✅
```

### 2-4. entrypoint 동작 확인

```bash
docker run --rm siw-test
```

**결과**:
```
ERROR: DATABASE_URL and DIRECT_URL must be set
```
→ entrypoint.sh가 정상 실행되어 env 검증 단계까지 도달. DB 없이 확인 가능한 최대 범위.

---

## 3. code-reviewer 전문가 리뷰 결과 요약

| 심각도 | 항목 | 조치 |
|--------|------|------|
| CRITICAL | Prisma symlink → 파일 복사 문제 | ✅ entrypoint 수정으로 해결 |
| CRITICAL | schema 변경 시 Docker 캐시로 stale client 배포 | ✅ builder에 `prisma generate` 추가 |
| CRITICAL | pdf-parse standalone 출력 누락 가능 | ✅ `outputFileTracingIncludes` 추가 |
| WARNING | `prisma.config.ts` runner에 미복사 → DIRECT_URL 미적용 | ✅ runner 단계 복사 추가 |
| WARNING | OpenSSL 주석 없음 → 실수 제거 위험 | ✅ 주석 추가 |
| WARNING | `~/.env.siw` 누락 시 조용히 실패 | ✅ 배포 전 존재 확인 추가 |
| WARNING | HEALTHCHECK 없음 | ✅ HEALTHCHECK 추가 |

---

## 4. 미검증 항목 (EC2 배포 후 확인 필요)

| 항목 | 확인 방법 |
|------|-----------|
| `prisma migrate deploy` 성공 | `docker logs siw` 에서 `All migrations have been applied` 확인 |
| Next.js 서버 기동 | `http://<EC2_HOST>:3000` 접속 |
| HEALTHCHECK 동작 | `docker inspect siw \| grep -A5 Health` |
| pdf-parse 런타임 동작 | PDF 업로드 기능 실제 사용 테스트 |
