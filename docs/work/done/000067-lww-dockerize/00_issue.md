# chore: services/lww Dockerize

## 목적
services/lww를 Docker 컨테이너로 빌드하고 EC2에서 실행 가능하게 한다.

## 배경
EC2 배포 시 일관된 환경에서 lww Next.js 서비스를 실행하기 위해 Dockerize가 필요하다.

## 완료 기준
- [x] `services/lww/Dockerfile` 작성 (node:20-alpine, multi-stage build)
- [x] `docker build` 로컬 빌드 성공
- [x] `docker run` 으로 서비스 정상 응답 확인
- [x] `services/lww/.dockerignore` 작성 (node_modules/, .next/, .env* 등 제외)

## 구현 플랜
1. `services/lww/Dockerfile` 작성
   - Stage 1 (deps): node:20-alpine, npm ci
   - Stage 2 (builder): next build
   - Stage 3 (runner): node:20-alpine, standalone output 실행
2. `next.config.ts`에 `output: 'standalone'` 확인/추가
3. `services/lww/.dockerignore` 작성
4. 로컬 빌드 및 실행 확인

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 신규 파일

- **`services/lww/next.config.ts`**: `output: 'standalone'` 설정 추가. Docker runner 스테이지에서 `node_modules` 없이 `server.js` 단독 실행 가능.
- **`services/lww/Dockerfile`**: 3단계 멀티스테이지 빌드 (deps → builder → runner). non-root user(uid=1001), 포트 3000.
- **`services/lww/.dockerignore`**: `node_modules/`, `.next/`, `.env*`, `tests/` 등 제외.

### 수정 파일

- **`services/lww/.ai.md`**: Docker 실행 섹션 추가 (빌드·구동 명령, 포트 3000, standalone 모드).

### 검증 결과

- `docker build` 성공 (Next.js 15.5.12)
- `GET /` → 200 OK
- `docker exec id` → uid=1001(nextjs)
