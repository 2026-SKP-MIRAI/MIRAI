# [#154] feat: [siw] Airflow EC2 인스턴스 스케줄 자동 on/off 구성 — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [x] EC2가 UTC 14:45에 자동으로 켜짐
- [x] EC2가 UTC 16:00에 자동으로 꺼짐
- [x] EC2 재시작 시 Airflow 컨테이너 자동 기동

---

## 배경 및 결정 근거

**핵심 발견**: EC2 프로덕션 배포는 `.github/workflows/deploy-siw-airflow.yml`에서
`docker run -d --name airflow --restart unless-stopped`로 실행 중.
→ AC #3 (EC2 재시작 시 Airflow 자동 기동)은 **이미 충족**.
→ `docker-compose.yml`의 `restart: always` 추가는 로컬 개발 일관성 목적으로만 추가.

**EventBridge + Lambda 접근법**: IaC(Terraform/CDK)는 이 규모에 과도.
AWS CLI `deploy.sh` 스크립트로 재현 가능한 배포 보장.

---

## 구현 계획

### Step 1. docker-compose.yml 수정 (AC #3 로컬 일관성)

**파일**: `services/siw/airflow/docker-compose.yml`

`airflow` 서비스에 `restart: always` 한 줄 추가.

---

### Step 2. Lambda 핸들러 작성 (AC #1, #2)

**신규 디렉토리**: `services/siw/infra/lambda/`

#### `ec2_start/handler.py`

- `boto3.client("ec2")` 로 `start_instances` 호출
- 환경변수: `EC2_INSTANCE_ID`, `AWS_REGION` (기본값: ap-northeast-2)
- 반환: `{"instanceId": ..., "state": ...}`

#### `ec2_stop/handler.py`

- `boto3.client("ec2")` 로 `stop_instances` 호출
- 동일 환경변수 사용
- 반환: `{"instanceId": ..., "state": ...}`

> `requirements.txt`: 빈 파일 (boto3는 Lambda Python 런타임 내장)

---

### Step 3. 단위 테스트 (pytest + moto)

**파일**: `services/siw/infra/lambda/tests/`

| 파일 | 검증 내용 |
|------|----------|
| `conftest.py` | moto `mock_aws` fixture, 가상 EC2 인스턴스 생성 |
| `test_ec2_start.py` | `start_instances`가 올바른 ID로 호출됐는지, 반환값 `state` 필드 존재 |
| `test_ec2_stop.py` | `stop_instances`가 올바른 ID로 호출됐는지, 반환값 `state` 필드 존재 |

실행:
```bash
cd services/siw/infra/lambda
pip install moto[ec2] pytest boto3
pytest tests/ -v
```

---

### Step 4. IAM 정책 문서

**파일**: `services/siw/infra/iam-policy.json`

Lambda 실행 역할에 부여할 최소 권한 정책.
허용 액션: `ec2:StartInstances`, `ec2:StopInstances`, `ec2:DescribeInstances`
리소스: 특정 인스턴스 ARN으로 범위 제한.

---

### Step 5. AWS CLI 배포 스크립트

**파일**: `services/siw/infra/deploy.sh`

스크립트가 순서대로 수행하는 작업:
1. `ec2_start/handler.py` → ZIP → `aws lambda create-function` (이미 있으면 `update-function-code`)
2. `ec2_stop/handler.py` → ZIP → 동일 과정
3. `aws events put-rule` × 2 (start: `cron(45 14 * * ? *)`, stop: `cron(0 16 * * ? *)`)
4. `aws events put-targets` × 2 (각 rule → 해당 Lambda ARN)
5. `aws lambda add-permission` × 2 (EventBridge가 Lambda 호출 가능하도록)

사전 조건 (환경변수):
- `EC2_INSTANCE_ID`: 타겟 EC2 인스턴스 ID
- `LAMBDA_ROLE_ARN`: Lambda 실행 역할 ARN (AWS 콘솔에서 사전 생성)

---

### Step 6. .ai.md 최신화

- `services/siw/infra/.ai.md`: 신규 생성 (목적·구조 기술)
- `services/siw/.ai.md`: Issue #154 완료 항목 추가, `infra/` 디렉토리 구조 추가

---

## 최종 파일 목록

| 파일 | 상태 | 설명 |
|------|------|------|
| `services/siw/airflow/docker-compose.yml` | 수정 | `restart: always` 추가 |
| `services/siw/infra/lambda/ec2_start/handler.py` | 신규 | EC2 시작 Lambda |
| `services/siw/infra/lambda/ec2_start/requirements.txt` | 신규 | 빈 파일 |
| `services/siw/infra/lambda/ec2_stop/handler.py` | 신규 | EC2 중지 Lambda |
| `services/siw/infra/lambda/ec2_stop/requirements.txt` | 신규 | 빈 파일 |
| `services/siw/infra/lambda/tests/conftest.py` | 신규 | moto fixture |
| `services/siw/infra/lambda/tests/test_ec2_start.py` | 신규 | start 단위 테스트 |
| `services/siw/infra/lambda/tests/test_ec2_stop.py` | 신규 | stop 단위 테스트 |
| `services/siw/infra/iam-policy.json` | 신규 | 최소 권한 IAM 정책 문서 |
| `services/siw/infra/deploy.sh` | 신규 | AWS CLI 배포 스크립트 |
| `services/siw/infra/.ai.md` | 신규 | infra 디렉토리 설명 |
| `services/siw/.ai.md` | 수정 | Issue #154 완료 항목 추가 |

---

## 주의사항

- Lambda IAM 실행 역할은 AWS 콘솔/CLI에서 사전 생성 필요 (레포에 포함 불가)
- `deploy.sh`는 멱등(idempotent): 이미 존재하는 Lambda는 코드만 업데이트
- EC2 stop 후 DAG 실행 window는 UTC 14:45~16:00 (75분) — DAG 실행 시간 초과 시 cron 조정 필요
- `unless-stopped` vs `always`: EC2 stop(graceful)은 `unless-stopped`도 재시작됨 → AC #3 이미 충족
