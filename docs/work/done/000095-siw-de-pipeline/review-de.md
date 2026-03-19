# DE 파이프라인 리뷰 — 이슈 #95 (Phase B)

> 리뷰어: DE specialist | 날짜: 2026-03-19

---

## 전체 평가

Phase B 구현(DAG + DDL)은 기본 골격이 잘 잡혀 있다. `extract_events`의 paginator 사용, XCom 기반 태스크 간 데이터 전달, UPSERT 패턴 모두 표준적이다. 아래는 프로덕션 운영 시 문제가 될 수 있는 갭과 개선 제안이다.

---

## 발견된 갭

### 갭 1: XCom에 대량 이벤트 데이터 전달 — 메모리/DB 병목

- **현황**: `extract_events`가 S3에서 읽은 전체 이벤트 리스트를 `xcom_push`로 전달하고, `aggregate_metrics`가 `xcom_pull`로 수신한다.
- **문제**: XCom은 Airflow 메타데이터 DB(기본 SQLite 또는 PostgreSQL)에 직렬화하여 저장한다. 일일 이벤트가 수만~수십만 건이면 XCom 테이블이 비대해지고, 메타데이터 DB 성능이 저하된다. Airflow 공식 문서에서도 XCom으로 대량 데이터 전달을 권장하지 않는다.
- **권장 수정**:
  - **단기**: `extract_events`에서 S3 데이터를 로컬 임시 파일(`/tmp/llm-events-{ds}.jsonl`)에 저장하고, XCom으로는 파일 경로만 전달한다.
  - **중기**: Custom XCom Backend(S3)를 사용하거나, `extract_events`와 `aggregate_metrics`를 하나의 태스크로 합쳐 중간 전달을 제거한다.

### 갭 2: `avg_latency_ms` 컬럼 타입 — 정밀도 손실

- **현황**: DDL에서 `avg_latency_ms INTEGER`, DAG에서 `int(s["sum_latency_ms"] / cnt)`로 소수점 버림.
- **문제**: `AVG(latency_ms)`는 소수점 값이 나올 수 있다. `int()` 변환으로 반복적인 반올림 손실이 누적되면 대시보드에서 평균 latency 트렌드가 부정확해진다. 예: 실제 평균 149.7ms가 149ms로 반복 기록.
- **권장 수정**:
  - DDL: `avg_latency_ms NUMERIC(10,2) NOT NULL DEFAULT 0.0`
  - DAG: `int()` 대신 `round(s["sum_latency_ms"] / cnt, 2)`

### 갭 3: `extract_events` 빈 날짜 처리 미명시

- **현황**: S3에 해당 날짜 파일이 없으면 `paginator.paginate()`가 빈 결과를 반환하고, `events = []`가 XCom에 push된다.
- **문제**: 코드상으로는 빈 리스트가 전달되어 에러 없이 통과하지만, 플랜에 이 동작이 명시되어 있지 않다. 또한 빈 날짜에 대해 `load_to_db`가 0건 INSERT를 수행하므로 해당 날짜가 테이블에 아예 없게 되는데, 이것이 의도된 것인지 명확하지 않다.
- **권장 수정**:
  - 플랜에 "해당 날짜 S3 파일 없으면 모든 후속 태스크 정상 통과 (0건)" 명시.
  - 선택적: `extract_events`에서 0건 시 `ShortCircuitOperator`로 후속 태스크 skip 처리 (불필요한 DB 연결 방지).

### 갭 4: `error_rate` 계산 시 division by zero 방어가 코드에만 존재

- **현황**: DAG 코드에서 `if cnt else 0.0`으로 방어하고 있다.
- **문제**: 코드상 방어는 되어 있으나, 플랜 문서(`01_plan.md`)에 이 엣지 케이스가 명시되지 않아 향후 유지보수 시 누군가 로직을 변경하면 regression 가능.
- **권장 수정**: 플랜 Step 5의 `aggregate_metrics` 설명에 "call_count=0 시 avg_latency_ms=0, error_rate=0.0" 명시.

### 갭 5: Airflow Connection/Variable 설정 가이드 부재

- **현황**: `.ai.md`에 "Airflow Variable 설정: S3_LOG_BUCKET, S3_LOG_PREFIX, ANALYTICS_DB_CONN"과 "Airflow Connection 설정: analytics_db"가 언급되어 있다.
- **문제**: 실제 설정 방법(CLI 명령어, Web UI 경로, 또는 `docker-compose` 환경변수)이 없다. 새 팀원이 Airflow를 셋업할 때 어떤 값을 어디에 넣는지 알 수 없다.
- **권장 수정**: `airflow/.env.example` 또는 `airflow/README.md`에 다음 내용 추가:
  ```bash
  # Airflow Variables (Web UI > Admin > Variables 또는 CLI)
  airflow variables set S3_LOG_BUCKET mirai-logs
  airflow variables set S3_LOG_PREFIX llm-events
  airflow variables set ANALYTICS_DB_CONN analytics_db

  # Airflow Connection (Web UI > Admin > Connections)
  # Conn Id: analytics_db
  # Conn Type: Postgres
  # Host: <analytics-db-host>
  # Schema: <db-name>
  # Login: <user>
  # Password: <password>
  # Port: 5432
  ```

### 갭 6: `requirements.txt` 누락

- **현황**: DAG 코드에서 `boto3`, `psycopg2`를 import하지만, `airflow/requirements.txt`가 없다.
- **문제**: Airflow 환경에 이 패키지들이 설치되어 있지 않으면 DAG import 에러로 전체 스케줄러가 해당 DAG를 로드하지 못한다.
- **권장 수정**: `airflow/requirements.txt` 추가:
  ```
  boto3>=1.26.0
  psycopg2-binary>=2.9.0
  ```

### 갭 7: analytics DB 위치 미명시

- **현황**: 플랜에 "analytics DB"라고만 언급. 기존 siw 서비스는 Prisma + PostgreSQL을 사용하는데, analytics DB가 동일 인스턴스인지 별도인지 불명확.
- **문제**: 같은 DB를 사용하면 Prisma migration과 수동 DDL(`001_create_llm_events_daily.sql`)이 충돌할 수 있다. Prisma는 자기가 관리하지 않는 테이블을 `prisma migrate diff`에서 drop 대상으로 인식할 수 있다.
- **권장 수정**:
  - **옵션 A** (권장): 별도 PostgreSQL 데이터베이스(예: `mirai_analytics`)를 사용하고, Airflow Connection에 이 DB를 지정. Prisma와 완전 분리.
  - **옵션 B**: 동일 DB 내 별도 스키마(`analytics` schema)를 사용. `CREATE SCHEMA IF NOT EXISTS analytics;` 후 테이블을 `analytics.llm_events_daily`로 생성. Prisma의 기본 스키마(`public`)와 격리.
  - 플랜에 어느 옵션인지 명시 필요.

### 갭 8: UPSERT 시 `created_at` 보존 확인

- **현황**: DAG `load_to_db`의 INSERT 문에서 `created_at` 컬럼을 명시하지 않아 `DEFAULT now()`가 사용된다. UPSERT의 `ON CONFLICT DO UPDATE` 절에서도 `created_at`을 갱신하지 않는다.
- **문제**: 이 부분은 **정상 동작**한다 — `ON CONFLICT DO UPDATE`에서 `created_at`을 건드리지 않으므로 최초 INSERT 시의 값이 보존된다. 그러나 `updated_at`의 자동 갱신이 트리거 기반이 아닌 UPSERT 절에서 명시적으로 `now()`를 설정하는 방식인데, DDL에 이 점이 주석으로 남아있지 않아 혼동 가능.
- **권장 수정**: DDL에 주석 추가 — `-- updated_at는 UPSERT 시 명시적으로 갱신 (트리거 미사용)`.

### 갭 9: DAG `start_date`가 과거 고정값

- **현황**: `start_date=datetime(2026, 1, 1)`, `catchup=False`.
- **문제**: 이 조합 자체는 문제없다 (catchup=False이므로 과거 실행을 건너뜀). 다만 실제 배포가 2026-03-19 이후이므로 `start_date`를 실제 운영 시작 날짜에 맞추면 Airflow UI의 Tree View에서 불필요한 빈 슬롯이 표시되지 않는다.
- **권장 수정**: `start_date`를 Phase B 시작 예정일로 변경하거나, 배포 시점에 맞춰 조정하라는 주석 추가.

---

## 플랜 수정 제안

### Phase B 수정 내용

#### 1. Step 5 (DAG) 보완 사항

플랜에 다음 내용 추가:

```
DAG 설계 보완:
- XCom 대량 데이터 주의: 일일 이벤트 10,000건 이하에서는 XCom 사용 허용.
  10,000건 초과 예상 시 로컬 임시 파일 기반으로 전환.
- 빈 날짜 처리: S3에 파일 없으면 events=[] → 후속 태스크 0건 처리로 정상 통과.
- aggregate_metrics: call_count=0 시 avg_latency_ms=0, error_rate=0.0 (division by zero 방어).
- Connection 설정: Airflow Connection ID 'analytics_db' (PostgreSQL) 필요.
  Variable: S3_LOG_BUCKET, S3_LOG_PREFIX, ANALYTICS_DB_CONN.
```

#### 2. Step 6 (DDL) 수정

```sql
CREATE TABLE IF NOT EXISTS llm_events_daily (
  date           DATE        NOT NULL,
  feature_type   TEXT        NOT NULL,
  call_count     INTEGER     NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2) NOT NULL DEFAULT 0.0,  -- INTEGER → NUMERIC(10,2)
  error_count    INTEGER     NOT NULL DEFAULT 0,
  error_rate     REAL        NOT NULL DEFAULT 0.0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- UPSERT 시 명시적 갱신
  PRIMARY KEY (date, feature_type)
);
CREATE INDEX IF NOT EXISTS idx_llm_events_daily_date ON llm_events_daily (date);
```

#### 3. 누락 파일 추가

| 파일 | 내용 |
|------|------|
| `airflow/requirements.txt` | `boto3>=1.26.0`, `psycopg2-binary>=2.9.0` |
| `airflow/.env.example` 또는 README 섹션 | Variable/Connection 설정 CLI 명령어 예시 |

#### 4. analytics DB 위치 결정 (팀 논의 필요)

플랜에 다음 중 하나를 명시:
- **옵션 A** (권장): 별도 DB `mirai_analytics` — Prisma와 완전 분리
- **옵션 B**: 동일 DB, 별도 스키마 `analytics` — `analytics.llm_events_daily`

---

## 요약 (우선순위별)

| 우선순위 | 갭 | 영향도 | 수정 난이도 |
|---------|-----|--------|------------|
| **P0** | 갭 6: requirements.txt 누락 | DAG 로드 실패 | 낮음 |
| **P0** | 갭 7: analytics DB 위치 미명시 | Prisma 충돌 가능 | 팀 결정 |
| **P1** | 갭 1: XCom 대량 데이터 | 메타DB 성능 저하 | 중간 |
| **P1** | 갭 5: Connection 설정 가이드 | 셋업 지연 | 낮음 |
| **P2** | 갭 2: avg_latency_ms 정밀도 | 대시보드 정확도 | 낮음 |
| **P2** | 갭 3: 빈 날짜 처리 문서화 | 유지보수 혼동 | 낮음 |
| **P2** | 갭 4: division by zero 문서화 | 유지보수 혼동 | 낮음 |
| **P3** | 갭 8: UPSERT created_at 주석 | 가독성 | 낮음 |
| **P3** | 갭 9: start_date 조정 | UI 가독성 | 낮음 |
