# fix: [siw] GitHub Actions SSH script 내 AWS secrets 평문 노출 수정

## 목적
deploy-siw.yml SSH script 블록 내 AWS secrets 직접 치환을 환경변수 주입 방식으로 교체해 EC2 shell history에 AWS 계정 정보가 평문으로 남지 않도록 한다.

## 배경
`.github/workflows/deploy-siw.yml`의 deploy job SSH script 블록에서 `${{ secrets.ECR_REGISTRY }}`와 `${{ secrets.AWS_REGION }}`이 GitHub Actions에 의해 문자열로 치환된 뒤 EC2로 전송된다.

결과적으로 AWS 계정 ID가 포함된 ECR 레지스트리 주소가 EC2의 다음 위치에 평문으로 남는다:
- `~/.bash_history`
- `/proc/{pid}/cmdline` (실행 중)
- `docker inspect` 출력

## 영향 범위
`.github/workflows/deploy-siw.yml` — deploy job (53-54, 66, 76번 줄)

## 완료 기준
- [ ] SSH script 블록 내 `${{ secrets.ECR_REGISTRY }}`, `${{ secrets.AWS_REGION }}` 직접 치환 제거
- [ ] `appleboy/ssh-action`의 `envs` 파라미터로 환경변수 주입 방식으로 교체
- [ ] EC2 shell에서 `$ECR_REGISTRY`, `$AWS_REGION` 변수명으로만 참조
- [ ] 수정 후 배포 정상 동작 확인

---

## 작업 내역

