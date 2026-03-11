# chore: EC2 + ALB + Route53 + WAF + HTTPS 호스팅 구성

## 목적
engine과 services/lww를 EC2 + ALB + Route53 + WAF + HTTPS 구성으로 배포한다.

## 배경
Week 2 목표인 Dockerize + 배포 환경 구성. 엔진과 lww 서비스를 하나의 EC2에 Docker Compose로 올리고, ALB → Route53 도메인 → HTTPS 순으로 연결한다.

## 완료 기준
- [ ] engine에 `GET /health` 엔드포인트 추가 (ALB 헬스체크용)
- [ ] engine Dockerfile 작성 및 로컬 빌드 확인
- [ ] services/lww Dockerfile 작성 및 로컬 빌드 확인
- [ ] docker-compose.yml 작성 (engine :8000, lww :3000)
- [ ] EC2 인스턴스에서 docker-compose up 정상 동작
- [ ] ALB 헬스체크 통과
- [ ] Route53 도메인 연결 + HTTPS (ACM) 적용
- [ ] WAF 기본 룰 적용

## 구현 플랜
1. engine/app/main.py — `GET /health` 추가
2. engine/Dockerfile 작성 (python:3.12-slim, pyproject.toml 기반)
3. services/lww/Dockerfile 작성 (node:20-alpine, multi-stage build)
4. docker-compose.yml 작성 (루트 또는 infra/ 디렉토리)
5. EC2 배포 → ALB 타겟 그룹 헬스체크 연결 → Route53 → ACM → WAF

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### engine/app/main.py
- `GET /` 헬스체크 엔드포인트 추가 — ALB 타겟 그룹 헬스체크 경로로 사용
- `logging.basicConfig` 설정 — 애플리케이션 레벨 로그 출력 활성화

### engine/app/routers/resume.py
- 요청 수신 / PDF 파싱 완료 / 질문 생성 완료 단계별 `logger.info` 추가 — EC2 배포 환경에서 처리 흐름 추적 용이

### services/lww/src/app/api/resume/questions/route.ts
- `instanceof File` → `instanceof Blob` 변경 — Node.js 18 환경에서 `File`이 글로벌 스코프에 없어 발생하던 `ReferenceError` 해결
- `file.name` → `(file as File).name ?? "upload.pdf"` — 타입 캐스팅 + 폴백 추가
- `console.log` / `console.error` 추가 — 요청 수신, 엔진 호출, 응답 상태, 실패 원인 로깅

### services/lww/src/app/page.tsx (신규)
- 루트 페이지(`/`) 추가 — lww ALB 타겟 그룹 헬스체크용

### README.md
- 엔진 EC2 배포 실행 명령 추가 (`--host 0.0.0.0 --port 8000`)
- 서비스 `ENGINE_BASE_URL` EC2 배포 예시 추가

### 인프라 (AWS 콘솔)
- EC2 인스턴스에 engine (8000), lww (3000) 직접 실행
- ALB 2개 (engine용, lww용) 구성 및 타겟 그룹 헬스체크 통과
- Route53 도메인 연결: `engine.mirainterview.com`, `mirainterview.com`
- ACM HTTPS 인증서 적용
- WAF 기본 룰셋(AWSManagedRulesCommonRuleSet) 적용 — `SizeRestrictions_BODY` Count로 변경(파일 업로드 허용)

