# feat: [siw] Airflow EC2 인스턴스 스케줄 자동 on/off 구성

## 사용자 관점 목표
DAG 실행 시간에만 EC2를 켜서 불필요한 비용을 줄인다.

## 배경
EC2 배포 완료, DAG(`llm_quality_dag`)가 KST 00:00 (UTC 15:00) 하루 1회 실행이라 24시간 상시 운영 불필요.

## 완료 기준
- [x] EC2가 UTC 14:45에 자동으로 켜짐
- [x] EC2가 UTC 16:00에 자동으로 꺼짐
- [x] EC2 재시작 시 Airflow 컨테이너 자동 기동

## 구현 플랜
1. `docker-compose.yml`에 `restart: always` 추가 — EC2 재시작 시 Airflow 자동 기동
2. Lambda 함수 2개 작성 — `ec2-start`, `ec2-stop`
3. EventBridge cron rule 설정
   - `cron(45 14 * * ? *)` → ec2-start
   - `cron(0 16 * * ? *)` → ec2-stop
4. 동작 검증

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-19

**구현 완료**
- `services/siw/airflow/docker-compose.yml`: `restart: always` 추가 (EC2 재시작 시 Airflow 자동 기동)
- `services/siw/infra/lambda/ec2_start/handler.py`: EC2 StartInstances Lambda
- `services/siw/infra/lambda/ec2_stop/handler.py`: EC2 StopInstances Lambda
- `services/siw/infra/lambda/tests/`: pytest + moto 단위 테스트 4/4 통과
- `services/siw/infra/iam-policy.json`: 최소 권한 IAM 정책 문서
- `services/siw/infra/deploy.sh`: AWS CLI 배포 스크립트 (멱등)
- `services/siw/infra/.ai.md`: 신규 생성

**AWS 실제 배포 완료**
- Lambda `ec2-start`, `ec2-stop` 함수 생성 (ap-northeast-2)
- EventBridge 규칙 `airflow-ec2-start` (`cron(45 14 * * ? *)`) 활성화
- EventBridge 규칙 `airflow-ec2-stop` (`cron(0 16 * * ? *)`) 활성화

**핵심 발견**
- CI/CD에서 이미 `--restart unless-stopped` 사용 중 → AC #3은 기존에 충족됨
- `docker-compose.yml` 변경은 로컬 일관성 목적

