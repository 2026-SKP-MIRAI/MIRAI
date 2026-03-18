# chore: services/seung EC2 배포 + ALB + Route53 + HTTPS 구성 (Docker + ECR)

## 목적
services/seung Next.js 서비스를 EC2에 배포하고 ALB → Route53 → HTTPS 순으로 연결한다.

## 배경
이슈 #64에서 engine이 EC2 + ALB + Route53 + WAF + HTTPS로 배포 완료됐다. 동일 인프라에 seung 서비스를 추가 배포한다.

## 완료 기준
- [x] `GET /api/health` Next.js API 라우트 추가 (ALB 헬스체크용)
- [ ] Dockerfile + entrypoint.sh 작성 _(Dockerize는 #135에서 진행)_
- [x] GitHub Actions 워크플로우 (`deploy-seung.yml`) 작성
- [ ] ECR 레포지토리 생성 (`mirai-seung`)
- [ ] EC2 인스턴스에서 seung 서비스 정상 동작 (포트 3000, Docker) _(#135 완료 후 가능)_
- [ ] ALB 헬스체크 통과 _(#135 완료 후 가능)_
- [ ] Route53 도메인 연결 + HTTPS (ACM) 적용
- [ ] WAF 기본 룰 적용
- [ ] 배포 URL에서 서비스 end-to-end 동작 확인 _(#135 완료 후 가능)_

## 구현 플랜
1. `src/app/api/health/route.ts` — `GET /api/health` 추가
2. `Dockerfile` + `entrypoint.sh` 작성 _(#135)_
3. `next.config.ts` — `output: "standalone"` 추가 _(#135)_
4. `.github/workflows/deploy-seung.yml` — ECR 빌드·푸시 + EC2 Docker 실행
5. EC2 Docker + AWS CLI 설치 + `~/.env.seung` 환경변수 설정
6. ECR 레포지토리 생성 + GitHub Secrets 등록
7. ALB 타겟 그룹 포트 3000 + 헬스체크 경로 `/api/health` 연결
8. Route53 레코드 추가 → ACM → WAF 순으로 연결

## 개발 체크리스트
- [x] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### 코드 변경

| 파일 | 내용 |
|------|------|
| `services/seung/src/app/api/health/route.ts` | 신규 — `GET /api/health` ALB 헬스체크 엔드포인트 |
| `.github/workflows/deploy-seung.yml` | 신규 — ECR 빌드·푸시 + EC2 SSH 배포 워크플로우 |
| `services/seung/src/app/api/resume/feedback/route.ts` | `Prisma.InputJsonValue` → `Prisma.JsonObject` 수정 (Prisma 6 빌드 에러 해결) |
| `services/seung/package.json` | `@types/pdf-parse` devDependency 추가 (TypeScript 빌드 에러 해결) |
| `.github/workflows/.ai.md` | `deploy-seung.yml` 워크플로우 현황 + seung 전용 Secrets 목록 추가 |
| `services/seung/.ai.md` | 배포 섹션 신규 추가, 환경변수 섹션 보완 |

### 인프라 (AWS 콘솔, 수동 완료)

| 항목 | 내용 |
|------|------|
| EC2 | Ubuntu 24.04 LTS T3A micro — seung 전용 인스턴스 생성 |
| 보안 그룹 | ALB용(80/443) + EC2용(포트 3000은 ALB SG에서만 허용) |
| ALB | `mirai-seung-alb`, 타겟 그룹 포트 3000, 헬스체크 `/api/health` |
| 리스너 | HTTP 80 → HTTPS 443 리다이렉트, HTTPS 443 → 타겟 그룹 |
| Route53 | 호스팅 영역 + A 레코드(Alias → ALB) |
| ACM | 와일드카드 인증서 재사용 |
| WAF | 기존 Web ACL에 seung ALB 연결 |
| ECR | `mirai-seung` 레포지토리 생성 |
| GitHub Secrets | `SEUNG_EC2_HOST`, `SEUNG_EC2_USER`, `SEUNG_NEXT_PUBLIC_SUPABASE_URL`, `SEUNG_NEXT_PUBLIC_SUPABASE_ANON_KEY` 등록 |

### 비고
- Dockerfile + entrypoint.sh + `output: "standalone"` 는 #135에서 진행
- 실제 EC2 배포 동작 확인, ALB 헬스체크, end-to-end 검증은 #135 완료 후 가능
