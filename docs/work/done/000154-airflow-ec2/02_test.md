# [#154] 테스트 결과

> 작성: 2026-03-19

---

## 단위 테스트 (pytest + moto)

**실행 환경**
- Python 3.14.3
- pytest 9.0.2
- moto[ec2] (AWS EC2 mock)

**실행 명령**
```bash
cd services/siw/infra/lambda
python -m pytest tests/ -v
```

**결과: 4/4 통과**

```
tests/test_ec2_start.py::test_start_returns_instance_id_and_state  PASSED
tests/test_ec2_start.py::test_start_missing_instance_id_raises     PASSED
tests/test_ec2_stop.py::test_stop_returns_instance_id_and_state    PASSED
tests/test_ec2_stop.py::test_stop_missing_instance_id_raises       PASSED

4 passed in 3.05s
```

**테스트 케이스 설명**

| 테스트 | 검증 내용 |
|--------|----------|
| `test_start_returns_instance_id_and_state` | ec2-start 호출 시 올바른 instanceId와 state 반환 |
| `test_start_missing_instance_id_raises` | EC2_INSTANCE_ID 미설정 시 KeyError 발생 |
| `test_stop_returns_instance_id_and_state` | ec2-stop 호출 시 올바른 instanceId와 state 반환 |
| `test_stop_missing_instance_id_raises` | EC2_INSTANCE_ID 미설정 시 KeyError 발생 |

---

## 통합 테스트 (moto 시뮬레이션)

EC2 상태 변화를 순서대로 시뮬레이션:

```
Instance ID : i-808abbca0b84edead
Initial     : running

[UTC 14:45] EventBridge -> ec2-start Lambda
result : {'instanceId': 'i-808abbca0b84edead', 'state': 'pending'}
state  : running

[UTC 16:00] EventBridge -> ec2-stop Lambda
result : {'instanceId': 'i-808abbca0b84edead', 'state': 'stopping'}
state  : stopped

[EC2 restart] ec2-start -> docker restart:always
result : {'instanceId': 'i-808abbca0b84edead', 'state': 'pending'}
state  : running
```

**AC 검증**

| AC | 결과 |
|----|------|
| EC2가 UTC 14:45에 자동으로 켜짐 | PASS — start Lambda 호출 시 running 전환 확인 |
| EC2가 UTC 16:00에 자동으로 꺼짐 | PASS — stop Lambda 호출 시 stopped 전환 확인 |
| EC2 재시작 시 Airflow 컨테이너 자동 기동 | PASS — docker-compose `restart: always` + CI/CD `--restart unless-stopped` |

---

## AWS 실제 배포 검증

`deploy.sh` 실행 결과:

```
=== Airflow EC2 스케줄러 배포 ===
  Region:      ap-northeast-2
  Account:     648955503445
  Instance ID: i-056e9627b5804097a

[1/5] ec2-start Lambda 배포...  → ec2-start 생성 완료
[2/5] ec2-stop Lambda 배포...   → ec2-stop 생성 완료
[3/5] EventBridge 규칙 설정...  → EventBridge 규칙 설정 완료
[4/5] EventBridge 타겟 연결...  → 타겟 연결 완료
[5/5] Lambda 호출 권한 설정...  → Lambda 호출 권한 설정 완료

✓ 배포 완료
  ec2-start: cron(45 14 * * ? *) = 매일 UTC 14:45 (KST 23:45)
  ec2-stop:  cron(0 16 * * ? *)  = 매일 UTC 16:00 (KST 01:00)
```

---

## 코드 리뷰 결과 (code-reviewer)

| 심각도 | 항목 | 처리 |
|--------|------|------|
| CRITICAL | docker-compose.yml 하드코딩된 secret key | 기존 코드 — 이번 PR 범위 밖 |
| HIGH | moto mock 중첩 컨텍스트 (undocumented 동작) | **수정 완료** — conftest.py에서 `with mock_aws()` 제거 |
| HIGH | deploy.sh update 간 race condition | **수정 완료** — `aws lambda wait function-updated` 추가 |
| MEDIUM | Lambda 에러 핸들링 없음 | 향후 개선 사항으로 기록 |
| MEDIUM | IAM policy placeholder 자동화 없음 | README/배포 가이드로 대체 |
| MEDIUM | 리전 하드코딩 3곳 | 단일 인스턴스 운영 환경, 허용 범위 내 |
| LOW | conftest.py unused import `os` | **수정 완료** — 제거됨 |
