# [#64] chore: EC2 + ALB + Route53 + WAF + HTTPS 호스팅 구성 — 구현 계획

> 작성: 2026-03-11

---

## 완료 기준

- [ ] engine에 `GET /health` 엔드포인트 추가 (ALB 헬스체크용)
- [ ] engine Dockerfile 작성 및 로컬 빌드 확인
- [ ] services/lww Dockerfile 작성 및 로컬 빌드 확인
- [ ] docker-compose.yml 작성 (engine :8000, lww :3000)
- [ ] EC2 인스턴스에서 docker-compose up 정상 동작
- [ ] ALB 헬스체크 통과
- [ ] Route53 도메인 연결 + HTTPS (ACM) 적용
- [ ] WAF 기본 룰 적용

---

## 구현 계획

(작성 예정)
