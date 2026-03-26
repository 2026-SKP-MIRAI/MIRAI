# [#252] fix: GitHub Actions SSH script 내 AWS secrets 평문 노출 수정 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [x] SSH script 블록 내 `${{ secrets.ECR_REGISTRY }}`, `${{ secrets.AWS_REGION }}` 직접 치환 제거
- [x] `appleboy/ssh-action`의 `envs` 파라미터로 환경변수 주입 방식으로 교체
- [x] EC2 shell에서 `$ECR_REGISTRY`, `$AWS_REGION` 변수명으로만 참조
- [x] 수정 후 배포 정상 동작 확인

---

## 구현 계획

1. `.github/workflows/deploy-siw.yml`의 deploy job SSH action step에 `env` 블록 추가
2. `envs` 파라미터에 `ECR_REGISTRY,AWS_REGION` 지정
3. script 블록 내 `${{ secrets.* }}` 참조를 `$ECR_REGISTRY`, `$AWS_REGION` 환경변수로 교체
