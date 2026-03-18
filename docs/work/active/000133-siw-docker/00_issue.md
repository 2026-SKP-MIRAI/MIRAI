# chore: siw Docker 배포 안정화 — Prisma symlink 수정, 스테이지 빌드 강화, 헬스체크 추가

## 목적
EC2 배포 시 Prisma symlink 문제로 컨테이너 크래시 발생. 관련 Docker 설정 전반 강화.

## 배경
EC2에 배포 후 컨테이너가 \`Restarting (1)\` 상태로 크래시 루프에 빠짐.
원인: multi-stage Docker 빌드에서 \`node_modules/.bin/prisma\`는 symlink인데, Docker COPY가 symlink를 파일로 복사하면서 \`__dirname\`이 \`.bin/\`으로 고정됨. 이로 인해 Prisma CLI가 \`node_modules/.bin/prisma_schema_build_bg.wasm\`을 찾지 못해 크래시.

## 수정 내용

### 1. `services/siw/entrypoint.sh`
- `./node_modules/.bin/prisma migrate deploy` → `node node_modules/prisma/build/index.js migrate deploy`
- symlink 복사 문제 우회: Prisma 패키지 진입점 직접 호출

### 2. `services/siw/Dockerfile`
- **deps 단계**: `prisma.config.ts` 복사 추가 (`prisma generate` 시 config 인식)
- **builder 단계**: `RUN npx prisma generate` 명시 추가 — schema 변경 시 Docker 레이어 캐시가 재사용되어도 최신 Prisma client 보장
- **runner 단계**:
  - `node_modules/.bin/prisma` 단독 복사 제거 (symlink 문제 원인)
  - `prisma.config.ts` 복사 추가 — `migrate deploy` 시 `DIRECT_URL` 사용 및 schema 경로 설정
  - `HEALTHCHECK` 추가 — 30초 간격, 3회 실패 시 unhealthy 판정
  - OpenSSL `apk add` 주석 개선 (제거 시 DB 연결 불가 명시)

### 3. `services/siw/prisma.config.ts`
- `import "dotenv/config"` 제거 — Docker 컨테이너에서는 env가 `--env-file`로 주입되므로 불필요. dotenv가 top-level 의존성이 아니라 빌드 실패 유발

### 4. `services/siw/next.config.ts`
- `outputFileTracingIncludes` 추가 — Next.js standalone 빌드 시 pdf-parse 내부 파일이 파일 트레이서에 누락되는 문제 예방

### 5. `.github/workflows/deploy-siw.yml`
- `docker run` 전 `~/.env.siw` 존재 확인 스텝 추가 — env 파일 누락 시 명시적 에러로 조기 실패

## 완료 기준
- [ ] Docker 빌드 성공 (로컬 검증 완료)
- [ ] EC2 배포 후 컨테이너 크래시 없이 기동
- [ ] `docker logs siw`에서 `prisma migrate deploy` 성공 확인
- [ ] HEALTHCHECK 동작 확인 (`docker inspect siw | grep Health`)

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-18 — 원인 분석 및 전체 수정

**문제 발생 경위**
- ECR + EC2 CI/CD 파이프라인 구축(#117) 후 첫 배포 시 컨테이너가 `Restarting (1)` 크래시 루프
- `docker logs siw` 확인 → `Error: ENOENT: no such file or directory, open '/app/node_modules/.bin/prisma_schema_build_bg.wasm'`

**근본 원인 파악**
- `node_modules/.bin/prisma`는 원래 `../prisma/build/index.js`를 가리키는 symlink
- Docker `COPY` 명령은 symlink를 파일 내용으로 복사 → `__dirname`이 `.bin/`으로 고정됨
- Prisma CLI가 `__dirname + '/prisma_schema_build_bg.wasm'`을 탐색 → `.bin/`에 없어서 크래시
- 로컬에서는 symlink라 `prisma/build/`에서 정상 탐색됨 → 환경 차이로 재현 어려움

**code-reviewer + 아키텍처 전문가 리뷰 수행**
- CRITICAL 2건, WARNING 5건 추가 발견 (02_test.md 참고)

**수정 파일 목록**

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/entrypoint.sh` | `.bin/prisma` → `node node_modules/prisma/build/index.js` 직접 호출 |
| `services/siw/Dockerfile` | `prisma generate` 명시, `prisma.config.ts` 복사, HEALTHCHECK 추가, OpenSSL 주석 개선 |
| `services/siw/prisma.config.ts` | `import "dotenv/config"` 제거 (top-level dep 아님, Docker에서 불필요) |
| `services/siw/next.config.ts` | `outputFileTracingIncludes` for pdf-parse 추가 |
| `.github/workflows/deploy-siw.yml` | `docker run` 전 `~/.env.siw` 존재 확인 추가 |

**로컬 검증 완료** (빌드 성공 + 파일 존재 확인, `02_test.md` 참고)

