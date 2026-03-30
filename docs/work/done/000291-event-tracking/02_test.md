# [#291] feat: [seung][DE] 유저 행동 이벤트 수집 인프라 구축 — 테스트 결과

> 작성: 2026-03-30

---

## 최종 테스트 결과

### pytest 단위 테스트 (airflow/tests/test_seung_event_dag.py)

```
8 passed in 0.03s
```

**테스트별 결과:**

| 테스트 | 검증 내용 | 결과 |
|--------|-----------|------|
| `test_aggregate_funnel_basic` | session_started 10, report_generated 3 → start_to_report_rate=0.3, abandoned_count=7 | ✅ |
| `test_aggregate_funnel_empty` | 이벤트 없을 때 → 모든 count=0, rate=0.0, avg_answers_per_session=None | ✅ |
| `test_collect_events_skip_when_no_bucket` | SEUNG_S3_EVENTS_BUCKET Variable 미설정 → AirflowSkipException | ✅ |
| `test_alert_on_high_dropout_triggered` | start_to_report_rate=0.1 → ALERT warning 로그 발생 | ✅ |
| `test_alert_on_high_dropout_not_triggered` | start_to_report_rate=0.5 → warning 없음 | ✅ |
| `test_aggregate_funnel_avg_answer_length` | answer_length [100, 200] → avg_answer_length=150.0 | ✅ |
| `test_aggregate_funnel_abandoned_events` | session_started 3, report_generated 1 → abandoned_events 2개, user_id 매핑 정확 | ✅ |
| `test_load_to_s3_writes_abandoned_events` | load_to_s3가 funnel.json 1회 + abandoned 2회 = 총 3회 put_object, `events/2026/01/05/` prefix 확인 | ✅ |

### vitest 단위 테스트 (services/seung)

```
23 passed (23 files), 216 tests passed
```

**신규 테스트 파일:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/lib/event-logger.test.ts` | 5 | ✅ | graceful skip, S3 호출, key 형식, 에러 throw, body 내용 |
| `tests/api/analytics-events.test.ts` | 7 | ✅ | 인증, date 파라미터, S3 조회, 503 graceful skip |

**기존 테스트 회귀 확인:**

| 파일 | 결과 | 비고 |
|------|------|------|
| 기존 21개 vitest 파일 | ✅ 회귀 없음 | 변경 전 대비 동일 |

### EC2 Airflow 통합 테스트

```
실행 환경: EC2 Airflow standalone (docker compose)
DAG: seung_event_dag — 수동 트리거
```

| 태스크 | 결과 | 비고 |
|--------|------|------|
| `collect_events` | ✅ AirflowSkipException (graceful skip) | SEUNG_S3_EVENTS_BUCKET Variable 미설정 상태에서 skip 확인 후 → Variable 수동 설정(`mirai-seung-analytics`) 후 S3 조회 정상 |
| `aggregate_funnel` | ✅ | collect_events XCom 수신, funnel 집계 정상 |
| `load_to_s3` | ✅ | `events/processed/{ds}/funnel.json` S3 적재 확인 |
| `alert_on_high_dropout` | ✅ | 로그 정상 출력 |

> SEUNG_S3_EVENTS_BUCKET Variable 미설정 → `docker exec airflow-airflow-1 airflow variables set SEUNG_S3_EVENTS_BUCKET mirai-seung-analytics` 로 수동 설정 후 정상 동작 확인.

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/lib/event-logger.ts` | 이벤트 스키마 + S3 fire-and-forget 적재 모듈 | ✅ |
| `src/app/api/analytics/events/route.ts` | `GET /api/analytics/events?date=YYYY-MM-DD` — 운영용 funnel 집계 조회 | ✅ |
| `airflow/dags/seung_event_dag.py` | collect_events → aggregate_funnel → load_to_s3 → alert_on_high_dropout DAG (UTC 17:00) | ✅ |
| `tests/lib/event-logger.test.ts` | event-logger 단위 테스트 5개 | ✅ |
| `tests/api/analytics-events.test.ts` | analytics/events route 단위 테스트 7개 | ✅ |
| `airflow/tests/test_seung_event_dag.py` | DAG 단위 테스트 8개 | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/app/api/interview/start/route.ts` | `session_started` 이벤트 로깅 (fire-and-forget) | ✅ |
| `src/app/api/interview/answer/route.ts` | `answer_submitted` 이벤트 로깅 (drainPromise 내부) | ✅ |
| `src/app/api/report/generate/route.ts` | `report_generated` 이벤트 로깅 (신규 report에만) | ✅ |
| `src/app/api/report/route.ts` | `report_viewed` 이벤트 로깅 | ✅ |
| `airflow/docker-compose.yml` | `AIRFLOW_VAR_SEUNG_S3_EVENTS_BUCKET` Variable 추가 | ✅ |
| `services/seung/.ai.md` | 신규 파일 반영 | ✅ |
| `airflow/.ai.md` | 신규 DAG·Variable·기술부채 항목 반영 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `test_seung_event_dag.py` 8개 작성 → `seung_event_dag.py` 구현 → 8/8 통과
- `event-logger.test.ts` 5개 + `analytics-events.test.ts` 7개 작성 → 구현 → 12/12 통과
- 기존 vitest 204개 회귀 없음

---

## 주요 설계 결정 및 리뷰 수정 내역

| 항목 | 결정 | 이유 |
|------|------|------|
| `session_abandoned` 구현 방식 | Airflow `aggregate_funnel`에서 판단 후 `load_to_s3`에서 S3 Raw Zone 적재; `aggregate_funnel` 진입 시 파생 이벤트 필터링으로 DAG 재실행 idempotency 보장 | 실시간 프론트 연동 없이 S3 이벤트만으로 판단 가능. 재실행 시 이전 run의 session_abandoned가 집계에 영향 주지 않음. |
| `session_abandoned` 타임스탬프 | `{ds}T23:59:59.000Z` | Airflow 집계 시점 기준 당일 말미로 설정 — 실시간 이탈 시각 불명이므로 end-of-day 근사값 사용 |
| `session_abandoned` S3 키 | `events/{date_path}/{uuid4()}.json` | 실시간 이벤트와 동일한 Raw Zone 경로에 저장, 키 충돌 방지 위해 uuid4 사용 |
| fire-and-forget 패턴 | `.catch()` + `console.error` | 이벤트 로깅 실패가 API 응답에 영향 주지 않도록 — 불변식 준수 |
| `S3_EVENTS_BUCKET` graceful skip | 미설정 시 `console.warn` 후 return | 로컬 개발 환경에서 AWS 설정 없이도 서비스 정상 동작 |
| 기존 버킷 재사용 | `mirai-seung-analytics` | 별도 버킷 생성 시 IAM 정책 수정 필요 → 기존 버킷의 `events/` prefix로 분리 |
| IAM `s3:ListBucket` 리소스 | 버킷 ARN (`arn:aws:s3:::...`) 별도 추가 | ListBucket은 버킷 수준 권한, `/*` 패턴으로는 부여 불가 |
| 타이밍 안전 키 비교 | SHA-256 해시 후 `timingSafeEqual` — `analytics/daily`, `analytics/events` 양쪽 적용 | 길이 체크(`length ===`) 제거로 키 길이 노출 방지. 두 해시 모두 32바이트 고정이므로 `timingSafeEqual` 전제 충족 |
