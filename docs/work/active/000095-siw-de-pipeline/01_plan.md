# [#95] feat: [siw][DE] Pipeline 1 — LLM 옵저버빌리티 — 구현 계획

> 작성: 2026-03-19
> 업데이트: 2026-03-19 — 전체 구현 완료 + code-reviewer 반영

---

## 완료 기준

- [x] engine 호출마다 이벤트 로그 생성 — `{ timestamp, feature_type, mode, latency_ms, success, error_type, session_id, retry_count }`
- [x] 이벤트 로그가 S3 `s3://mirai-llm-logs-siw/llm-events/YYYY/MM/DD/` 경로에 JSONL 형식으로 적재됨
- [x] `S3_LOG_BUCKET` 미설정 시 로컬 파일 fallback — 기존 개발 환경 영향 없음
- [x] Airflow DAG(`llm_quality_dag`) 일별 실행 — 기능별 호출 건수·평균 latency·에러율 집계
- [x] 집계 결과가 analytics DB 테이블(`analytics.llm_events_daily`)에 적재됨
- [x] vitest: event_logger 단위 테스트 (131개 통과)

---

## 이벤트 스키마

```ts
interface LLMEvent {
  timestamp: string;       // ISO 8601
  feature_type:            // 기능 식별자
    | "interview_start" | "interview_answer" | "interview_followup"
    | "report_generate" | "resume_parse" | "resume_questions" | "practice_feedback";
  mode: "interview" | "practice" | "resume";  // feature_type에서 자동 파생
  latency_ms: number;      // engine 호출 왕복 시간 (네트워크 RTT + LLM 생성)
  success: boolean;
  error_type?: string;     // 실패 시 err.message
  session_id?: string | null;
  retry_count?: number;    // 기본 0, retry loop 내부에서 meta.retry_count로 기록
}
```

**feature_type → mode 매핑:**

| feature_type | mode |
|---|---|
| interview_start, interview_answer, interview_followup, report_generate | interview |
| practice_feedback | practice |
| resume_parse, resume_questions | resume |

---

## Engine Call Sites (9개)

| # | 파일 | feature_type | session_id | 래핑 방식 |
|---|------|-------------|------------|-----------|
| 1 | `lib/interview/interview-service.ts` | interview_start | null | 패턴 A (retry loop만) |
| 2 | `lib/interview/interview-service.ts` | interview_answer | sessionId | 패턴 B (retry + parse) |
| 3 | `lib/interview/interview-service.ts` | interview_followup | sessionId | 단순 래핑 |
| 4 | `api/report/generate/route.ts` | report_generate | sessionId | 패턴 C |
| 5 | `api/resumes/route.ts` | resume_parse | null | 패턴 D |
| 6 | `api/resumes/route.ts` | resume_questions | null | 패턴 E (Promise.all) |
| 7 | `api/resume/questions/route.ts` | resume_parse | null | 단순 래핑 (레거시) |
| 8 | `api/resume/questions/route.ts` | resume_questions | null | 단순 래핑 (레거시) |
| 9 | `api/practice/feedback/route.ts` | practice_feedback | null | 패턴 C |

---

## Phase A — 서비스 레이어 계측 ✅ 완료

### Step 1: event-logger 모듈

**파일:** `services/siw/src/lib/observability/event-logger.ts`

- `logLLMEvents(events: LLMEvent[])`: S3 적재 또는 로컬 JSONL fallback
  - S3 key: `{prefix}/YYYY/MM/DD/{ISO timestamp}-{uuid8}.jsonl`
  - 로컬 path: `logs/llm-events/YYYY-MM-DD.jsonl`
  - 실패해도 throw 안함 (본 기능 흐름 무영향)
- `withEventLogging<T>(featureType, sessionId, fn)`: engine call 래핑
  - `fn: (meta: LLMEventMeta) => Promise<T>` — retry_count를 meta로 전달
  - 성공/실패 모두 logLLMEvents 호출 후 결과 반환(또는 re-throw)
  - `await logLLMEvents(...)` — void 아님 (플레이키 테스트 방지)
- `FEATURE_MODE`: feature_type → mode 자동 파생 lookup table
- S3Client singleton (`let s3Client: S3Client | null = null`)

### Step 2: API routes 계측 (9개 사이트) ✅

모든 engine call site에 `withEventLogging` 래핑 완료.
DB 저장(`interviewRepository` 등)은 래핑 밖 유지 — engine 에러와 DB 에러 분리.

**래핑 패턴:**
- **패턴 A**: retry loop만 래핑, DB 저장 제외 (Site 1)
- **패턴 B**: retry loop + schema parse 포함 (Site 2)
- **패턴 C**: `!resp.ok` → throw 변환 후 catch에서 기존 응답 복원 (Sites 4, 9)
- **패턴 D**: early return → try/catch 변환 (Site 5)
- **패턴 E**: Promise.all 내부 래핑으로 병렬성 유지 (Site 6)

### Step 3: 환경변수

```
S3_LOG_BUCKET=mirai-llm-logs-siw   # 미설정 시 로컬 fallback
S3_LOG_PREFIX=llm-events            # 기본값
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=                  # EC2 Instance Profile 사용 시 불필요
AWS_SECRET_ACCESS_KEY=
```

---

## Phase B — Airflow + analytics DB ✅ 완료

### analytics DB 위치

기존 Supabase DB에 `analytics` 스키마 추가 — Prisma `public` 스키마와 완전 분리.
Prisma migrate가 `analytics` 스키마를 건드리지 않음.

### Step 4: DDL

**파일:** `services/siw/airflow/sql/001_create_llm_events_daily.sql`

```sql
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.llm_events_daily (
  date           DATE          NOT NULL,
  feature_type   TEXT          NOT NULL,
  call_count     INTEGER       NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2) NOT NULL DEFAULT 0.0,  -- NUMERIC: AVG 소수점 보존
  error_count    INTEGER       NOT NULL DEFAULT 0,
  error_rate     REAL          NOT NULL DEFAULT 0.0,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now(), -- UPSERT 시 명시적 갱신 (트리거 미사용)
  PRIMARY KEY (date, feature_type)
);
CREATE INDEX IF NOT EXISTS idx_llm_events_daily_date ON analytics.llm_events_daily (date);
```

### Step 5: Airflow DAG

**파일:** `services/siw/airflow/dags/llm_quality_dag.py`
**패키지:** `services/siw/airflow/requirements.txt` (`boto3>=1.26.0`, `psycopg2-binary>=2.9.0`)

```
DAG: llm_quality_dag
Schedule: 0 15 * * * (UTC 15:00 = KST 00:00)
Catchup: False
start_date: 배포 시 실제 운영 시작일로 조정 (현재 2026-01-01)

Tasks:
  extract_events       → S3 전일 JSONL 읽기 → XCom push (events 리스트)
  aggregate_metrics    → feature_type별 call_count, avg_latency_ms, error_rate → XCom push
  load_to_db           → analytics.llm_events_daily UPSERT
  alert_on_high_error_rate → error_rate > 10% 시 로그 경고
```

**집계 로직:**
- `avg_latency_ms`: `round(sum / count, 2)` — 소수점 보존
- `error_rate`: `round(error_count / call_count, 4)` — division by zero 방어 (`if cnt else 0.0`)
- 빈 날짜: S3 파일 없으면 `events = []` → 0건으로 정상 통과

**DB 연결:**
```bash
# Airflow Variables
airflow variables set S3_LOG_BUCKET mirai-llm-logs-siw
airflow variables set S3_LOG_PREFIX llm-events
airflow variables set ANALYTICS_DB_CONN analytics_db

# Airflow Connection (analytics_db)
# Conn Type: Postgres
# Host: db.<supabase-project-id>.supabase.co
# Schema: postgres   ← DB명 (analytics 스키마는 INSERT 문에 명시)
# Login: postgres
# Password: <supabase-db-password>
# Port: 5432
```

**XCom 크기 주의:**
- 일일 이벤트 10,000건 이하: XCom 직접 전달 허용
- 10,000건 초과 예상 시: `/tmp/llm-events-{ds}.jsonl` 파일 저장 후 경로만 XCom 전달

**UPSERT 스키마 prefix:**
- INSERT 문은 반드시 `analytics.llm_events_daily` 사용 (unqualified 시 `public` 스키마 오류)

---

## S3 저장 구조

```
mirai-llm-logs-siw/
  llm-events/
    2026/03/19/
      2026-03-19T02:40:00.000Z-a1b2c3d4.jsonl   ← interview_start
      2026-03-19T02:43:00.000Z-e5f6g7h8.jsonl   ← interview_answer
      2026-03-19T02:51:58.633Z-i9j0k1l2.jsonl   ← report_generate
```

**JSONL 한 줄 예시:**
```json
{"timestamp":"2026-03-19T02:51:58.633Z","feature_type":"report_generate","mode":"interview","latency_ms":12399,"success":true,"session_id":"6913b2ec-9ce1-45f5-9ff2-bf82c79ef384","retry_count":0}
```

날짜 폴더 단위로 파티셔닝 — 모든 feature_type이 같은 날짜 폴더에 저장.
Airflow DAG이 하루치를 읽고 feature_type으로 groupby.

---

## code-reviewer 지적 반영 내역 (2026-03-19)

| 분류 | 내용 | 수정 |
|------|------|------|
| C1 | DDL + DAG INSERT에 `analytics.` 스키마 prefix 누락 | `analytics.llm_events_daily` 명시 |
| C2 | `airflow/requirements.txt` 누락 | 파일 생성 |
| C3 | `avg_latency_ms INTEGER` → 소수점 손실 | `NUMERIC(10,2)` + `round(..., 2)` |
| I3 | `conn.close()` exception 시 누수 | `try/finally` 구조로 변경 |

---

## 불변식

1. 로깅 실패가 본 기능 흐름에 영향 주지 않음 (`try/catch` 내부 에러 삼킴)
2. 엔진은 수정하지 않음 (stateless 유지 원칙)
3. DB 저장은 `withEventLogging` 밖에서 실행 (engine 에러와 DB 에러 분리)
4. `S3_LOG_BUCKET` 미설정 시 기존 동작 완전 동일
