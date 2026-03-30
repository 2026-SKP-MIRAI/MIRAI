# [#291] feat: [seung][DE] 유저 행동 이벤트 수집 인프라 구축 — 구현 계획

> 작성: 2026-03-30

---

## 완료 기준

- [x] 이벤트 스키마 정의 (`event_type`, `user_id`, `session_id`, `timestamp`, `properties`)
- [x] 주요 이벤트 로깅 구현 — `session_started`, `answer_submitted`, `session_abandoned`(Airflow 집계), `report_generated`, `report_viewed`
- [x] S3 Raw Zone 적재 — 일별 파티셔닝 (`events/YYYY/MM/DD/`)
- [x] Airflow DAG: `collect_events → aggregate_funnel → load_to_s3 → alert_on_high_dropout`
- [x] `GET /api/analytics/events?date=YYYY-MM-DD` — 운영용, 내부 전용, 집계 결과 반환
- [x] `S3_EVENTS_BUCKET` 미설정 시 이벤트 로깅 graceful skip
- [x] 테스트: 이벤트 적재 및 집계 로직 검증
- [x] 테스트 코드 포함 (vitest 216개 green, pytest 8개 green)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (이벤트 로깅 실패가 API 응답에 영향 주지 않을 것)

---

## 구현 계획

### 아키텍처 개요

```
[Next.js API routes]
  ↓ fire-and-forget (logEvent)
[event-logger.ts] ──→ S3 Raw Zone: events/YYYY/MM/DD/{uuid}.json
                           ↓ (Airflow, 매일 UTC 17:00)
                  [seung_event_dag.py]
                  collect_events → aggregate_funnel → load_to_s3 → alert_on_high_dropout
                           ↓
                  S3 Processed Zone: events/processed/{date}/funnel.json
                           ↓
  GET /api/analytics/events?date=YYYY-MM-DD → 운영자
```

- `session_abandoned`은 Airflow `aggregate_funnel`에서 판단 (S3 이벤트 중 `session_started`에 대응하는 `report_generated`가 없는 session_id = 이탈 세션)
- 이벤트 로깅 실패는 서비스 응답에 영향을 주지 않는다 (fire-and-forget + `.catch()`)
- 기존 `seung_analytics_dag`과 같은 IAM Instance Role 방식 사용

---

### Step 0 — 환경변수 정의

**추가할 환경변수 (`.env.local`, EC2 서버)**

| 변수명 | 설명 | 미설정 시 |
|---|---|---|
| `S3_EVENTS_BUCKET` | 이벤트 적재용 S3 버킷명 | graceful skip (로그만) |
| `AWS_REGION` | S3 리전 | 기존 analytics와 공유 |
| `ANALYTICS_API_KEY` | `/api/analytics/events` 내부 키 | 기존 daily route와 공유 |

**Airflow Variable (기존 Variables에 추가)**

| Variable | 설명 |
|---|---|
| `SEUNG_S3_EVENTS_BUCKET` | 이벤트 버킷명 (미설정 시 DAG graceful skip) |

---

### Step 1 — `event-logger.ts` 작성

**파일**: `services/seung/src/lib/event-logger.ts`

**이벤트 타입 정의**:
```typescript
type EventType =
  | 'session_started'
  | 'answer_submitted'
  | 'session_abandoned'
  | 'report_generated'
  | 'report_viewed'

interface UserEvent {
  event_type: EventType
  user_id: string
  session_id: string
  timestamp: string           // ISO8601
  properties: Record<string, unknown>
}
```

**S3 적재 로직**:
- S3 key: `events/YYYY/MM/DD/{timestamp}-{uuid}.json`
- `S3_EVENTS_BUCKET` 미설정 시 → `console.warn` 후 return (graceful skip)
- AWS SDK v3 (`@aws-sdk/client-s3`) 사용 — 기존 analytics/daily/route.ts와 동일 패키지
- IAM Instance Role 자동 주입 (explicit credential 없음)

**사용 패턴** (호출부):
```typescript
// 응답 반환 후 비동기 실행, 실패해도 응답에 영향 없음
logEvent({ event_type: 'session_started', ... }).catch((err) =>
  console.error('[event-logger] logEvent failed', err)
)
```

---

### Step 2 — API routes에 이벤트 로깅 주입

총 4개 route 수정. 모두 **응답 반환 직전 또는 직후** fire-and-forget 패턴.

#### 2-1. `session_started`
**파일**: `services/seung/src/app/api/interview/start/route.ts`

- 주입 위치: `prisma.interviewSession.create` 성공 후, `return NextResponse.json(...)` 직전
- properties: `{ resume_id, interview_mode, personas }`

#### 2-2. `answer_submitted`
**파일**: `services/seung/src/app/api/interview/answer/route.ts`

- 주입 위치: `drainPromise` 내부, `done` 이벤트 처리 후 DB 업데이트 성공 직후
- properties: `{ question_index: history.length, answer_length: trimmedAnswer.length, session_complete: doneEvent.sessionComplete }`
- 주의: drain은 클라이언트 disconnect 후에도 실행되므로 이 위치가 적절

#### 2-3. `report_generated`
**파일**: `services/seung/src/app/api/report/generate/route.ts`

- 주입 위치: `prisma.report.create` 성공 후 (`status: 201` 반환 직전)
- 기존 report가 있을 때(200 재사용)는 로깅 생략 (중복 방지)
- properties: `{ report_id, total_score }`

#### 2-4. `report_viewed`
**파일**: `services/seung/src/app/api/report/route.ts`

- 주입 위치: `return NextResponse.json(...)` 직전
- properties: `{ report_id }`
- `user_id`, `session_id`는 `report.userId`, `report.sessionId`에서 추출

#### 2-5. `session_abandoned` — Airflow에서 처리
실시간 감지 대신 `aggregate_funnel` 태스크에서:
- S3 이벤트 중 `session_started`에 대응하는 `report_generated`가 없는 session_id 목록을 DB와 교차 조회 (`sessionComplete=false`)
- funnel 집계 결과에 포함시켜 report에 반영 (별도 S3 이벤트 객체로 적재하지 않음)
- 이유: 프론트 나가기 버튼 연동 없이도 S3 이벤트만으로 충분히 판단 가능하며, 코드 변경 범위를 최소화. `load_to_s3`에서 `session_abandoned` 이벤트를 S3 Raw Zone에 개별 파일로 적재.

---

### Step 3 — `GET /api/analytics/events` endpoint

**파일**: `services/seung/src/app/api/analytics/events/route.ts`

기존 `analytics/daily/route.ts` 패턴 그대로:
- `X-Internal-Key` 헤더 + `ANALYTICS_API_KEY` 인증 (timingSafeEqual)
- `?date=YYYY-MM-DD` — 미입력 시 어제 날짜 (KST 기준)
- S3 key: `events/processed/{date}/funnel.json`
- `S3_EVENTS_BUCKET` 미설정 시 503 반환
- path traversal 방지: 날짜 정규식 검증

---

### Step 4 — Airflow DAG `seung_event_dag.py`

**파일**: `services/seung/airflow/dags/seung_event_dag.py`

스케줄: 매일 UTC 17:00 (KST 02:00) — 기존 analytics DAG(15:00), embed DAG(16:00)와 겹치지 않게

**파이프라인**: `collect_events → aggregate_funnel → load_to_s3 → alert_on_high_dropout`

#### collect_events(ds)
- Variable `SEUNG_S3_EVENTS_BUCKET` 미설정 → AirflowSkipException (graceful skip)
- S3 prefix `events/YYYY/MM/DD/` 모든 object 읽기 (`list_objects_v2` + `get_object`)
- 파싱한 이벤트 리스트를 XCom push

#### aggregate_funnel(ds)
- `collect_events` XCom에서 이벤트 리스트 수신
- **funnel 단계별 집계**:
  - `session_started` count
  - `answer_submitted` count (unique session_id)
  - `report_generated` count
  - `report_viewed` count
- **파생 지표**:
  - `start_to_report_rate` = report_generated / session_started
  - `report_to_view_rate` = report_viewed / report_generated
  - `abandoned_sessions` = session_started - report_generated (이탈 추정치)
  - `avg_answers_per_session`: answer_submitted 이벤트의 question_index 기준
  - `avg_answer_length`: properties.answer_length 평균
- 결과를 XCom push

#### load_to_s3(ds)
- `aggregate_funnel` XCom 수신
- S3 key: `events/processed/{ds}/funnel.json`
- 기존 `load_to_s3` 패턴 그대로

#### alert_on_high_dropout(ds)
- `start_to_report_rate < 0.2` 시 `logger.warning()` (기존 alert 패턴 동일)
- 현재는 로그 전용 (Slack 미연동 — 기존 .ai.md 기술부채 항목과 동일)

---

### Step 5 — 테스트 작성

#### 5-1. Airflow DAG 단위 테스트
**파일**: `services/seung/airflow/tests/test_seung_event_dag.py`

기존 `test_seung_analytics_dag.py` 패턴 그대로:
- `test_aggregate_funnel_basic`: 이벤트 목록 → funnel 지표 검증 (session_started 10, report_generated 3 → start_to_report_rate=0.3)
- `test_aggregate_funnel_empty`: 이벤트 없을 때 → 모든 count=0, rate=0.0
- `test_collect_events_skip_when_no_bucket`: Variable 미설정 → AirflowSkipException
- `test_alert_on_high_dropout_triggered`: start_to_report_rate=0.1 → warning 발생

#### 5-2. `event-logger.ts` 단위 테스트
**파일**: `services/seung/src/lib/__tests__/event-logger.test.ts`

- `S3_EVENTS_BUCKET` 미설정 시 S3 호출 없이 반환 검증
- S3 `PutObjectCommand` 정상 호출 검증 (jest mock)
- S3 에러 시 throw 검증 (호출부에서 `.catch()`로 처리하는 구조 확인)

---

### Step 6 — `.ai.md` 최신화

수정 대상:
- `services/seung/.ai.md` — analytics API에 `events` endpoint 추가, `event-logger.ts` lib 목록 추가
- `services/seung/airflow/.ai.md` — `seung_event_dag.py` DAG 항목 추가, 필요 Variable 추가

---

### 변경 파일 요약

| 파일 | 작업 |
|---|---|
| `src/lib/event-logger.ts` | **신규** — 이벤트 스키마 + S3 적재 |
| `src/app/api/interview/start/route.ts` | 수정 — session_started 로깅 |
| `src/app/api/interview/answer/route.ts` | 수정 — answer_submitted 로깅 (drain 내부) |
| `src/app/api/report/generate/route.ts` | 수정 — report_generated 로깅 |
| `src/app/api/report/route.ts` | 수정 — report_viewed 로깅 |
| `src/app/api/analytics/events/route.ts` | **신규** — 운영용 funnel 집계 조회 |
| `airflow/dags/seung_event_dag.py` | **신규** — 이벤트 수집·집계 DAG |
| `src/lib/__tests__/event-logger.test.ts` | **신규** — event-logger 단위 테스트 |
| `airflow/tests/test_seung_event_dag.py` | **신규** — DAG 단위 테스트 |
| `services/seung/.ai.md` | 수정 — 신규 파일 반영 |
| `airflow/.ai.md` | 수정 — 신규 DAG·Variable 반영 |

---

### 주의사항 / 엣지케이스

1. **중복 report_generated 방지**: 기존 route는 이미 존재하는 report가 있으면 200 재사용. 이 경우 이벤트 로깅 생략.
2. **answer_submitted 위치**: `drainPromise` 내부에서만 로깅. 클라이언트 disconnect 무관하게 실행되어야 하므로 drain 위치가 정확.
3. **session_id 추적**: `answer_submitted` 이벤트의 `session_id`는 `sessionId` (route body에서). `report_viewed`는 `report.sessionId`.
4. **S3 키 충돌 방지**: 동일 ms에 여러 이벤트 발생 가능 → key에 `crypto.randomUUID()` 포함.
5. **Airflow SQLite 동시성**: 기존 .ai.md에서 PostgreSQL 전환 검토 언급. 이번 DAG 추가(UTC 17:00)로 세 DAG가 모두 다른 시간대 → 즉시 전환 불필요.
6. **IAM Role S3 권한**: 기존 `mirai-seung-analytics/*` 외에 이벤트 버킷에 대한 `s3:GetObject`, `s3:PutObject`, `s3:ListBucket` 권한 필요. 버킷이 다를 경우 팀 확인 필요.
