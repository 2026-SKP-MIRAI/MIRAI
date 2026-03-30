# feat: [seung][DE] 유저 행동 이벤트 수집 인프라 구축

## 사용자 관점 목표

운영자는 유저가 면접 중 어느 단계에서 이탈하는지, 자소서 진단 후 면접으로 이어지는 비율이 얼마나 되는지 파악하여 데이터 기반 서비스 개선이 가능하다.

## 배경

현재 seung은 유저 행동 데이터가 전혀 없다. DB에 최종 결과(세션 완료, 리포트 생성)만 저장되고 중간 과정은 모두 사라진다. 어느 질문에서 이탈했는지, 리포트를 실제로 열어봤는지 등을 알 수 없어 서비스 개선이 감 기반이다.

이벤트 스키마를 설계하고 S3 데이터 레이크에 적재한 뒤 Airflow로 일배치 집계하는 인프라를 구축한다.

## 완료 기준

- [x] 이벤트 스키마 정의 (`event_type`, `user_id`, `session_id`, `timestamp`, `properties`)
- [x] 주요 이벤트 로깅 구현 — `session_started`, `answer_submitted`, `session_abandoned`, `report_generated`, `report_viewed`
- [x] S3 Raw Zone 적재 — 일별 파티셔닝 (`events/YYYY/MM/DD/`)
- [x] Airflow DAG: `collect_events → aggregate_funnel → load_to_s3 → alert_on_high_dropout`
- [x] `GET /api/analytics/events?date=YYYY-MM-DD` — 운영용, 내부 전용, 집계 결과 반환
- [x] `S3_EVENTS_BUCKET` 미설정 시 이벤트 로깅 graceful skip
- [x] 테스트: 이벤트 적재 및 집계 로직 검증

## 구현 플랜

### Step 1 — 이벤트 스키마 설계
```json
{
  "event_type": "answer_submitted",
  "user_id": "uuid",
  "session_id": "cuid",
  "timestamp": "ISO8601",
  "properties": { "question_index": 3, "answer_length": 320 }
}
```

### Step 2 — seung API routes에 이벤트 로깅 추가
- `interview/start/route.ts` → `session_started`
- `interview/answer/route.ts` → `answer_submitted`
- `report/generate/route.ts` → `report_generated`

### Step 3 — S3 적재 모듈
- `services/seung/src/lib/event-logger.ts`
- 비동기 fire-and-forget, 실패 시 서비스 영향 없음

### Step 4 — Airflow DAG
- `services/seung/airflow/dags/seung_event_dag.py`
- collect_events(S3) → aggregate_funnel → load_to_db → alert

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (이벤트 로깅 실패가 API 응답에 영향 주지 않을 것)

---

## 작업 내역

- 2026-03-30: #291 구현 완료
  - `src/lib/event-logger.ts` — 이벤트 스키마 + S3 fire-and-forget (timestamp 옵셔널, 내부 기본값 처리)
  - `interview/start`, `interview/answer`, `report/generate`, `report/route` — 이벤트 로깅 주입
  - `src/app/api/analytics/events/route.ts` — GET /api/analytics/events; SHA-256 해시 기반 타이밍 안전 인증 (`analytics/daily`도 동일 수정)
  - `airflow/dags/seung_event_dag.py` — collect → aggregate_funnel → load_to_s3 → alert; session_abandoned 이벤트 S3 Raw Zone 적재; IsTruncated 경고 로그; aggregate_funnel 진입 시 session_abandoned 필터링 (DAG 재실행 idempotency)
  - `airflow/docker-compose.yml` — SEUNG_S3_EVENTS_BUCKET Variable 추가
  - vitest 216개 green, pytest 8개 green
  - EC2 Airflow 배포 완료 (DAG 수동 트리거 성공 확인)
