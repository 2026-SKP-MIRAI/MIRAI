# [#217] feat: [seung][DE] 면접 분석 데이터 파이프라인 — DB→S3 일배치 집계 + 성장 추이 시각화 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

- [ ] seung EC2에 Airflow 설치 및 초기 설정 완료 (webserver, scheduler 실행, Variables 설정)
- [ ] `GET /api/user/progress` — 로그인 유저의 리포트 이력 반환 (round, sessionId, totalScore, scores, createdAt)
- [ ] Dashboard 자소서 목록 위 성장 추이 섹션 추가 — 회차별 totalScore LineChart (recharts), 리포트 2개 미만이면 섹션 숨김
- [ ] `services/seung/airflow/dags/seung_analytics_dag.py` 신규 — extract_sessions → compute_metrics → load_to_s3 → alert_on_low_completion
- [ ] 집계 메트릭: 면접 완료율(sessionComplete=true / 전체), 리포트 생성률(Report 있는 / sessionComplete=true), 평균 totalScore, real/practice 모드 분포, 평균 이탈 시점(history 길이 평균)
- [ ] 집계 결과가 S3 Processed Zone에 JSON으로 적재됨
- [ ] `GET /api/analytics/daily?date=YYYY-MM-DD` — 운영용, X-Internal-Key 헤더 가드, S3 Processed Zone 집계 결과 반환
- [ ] `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 DAG graceful skip, `/api/analytics/daily` 503 반환
- [ ] 테스트: `tests/api/user-progress.test.ts`
- [ ] 테스트: `airflow/tests/test_seung_analytics_dag.py`

---

## 사전 준비 (Phase 2 시작 전 필수)

### 인프라 — AWS S3

| 항목 | 내용 |
|------|------|
| 버킷 생성 | `{SEUNG_S3_ANALYTICS_BUCKET}` 버킷 생성 (리전: `ap-northeast-2` 권장) |
| 버킷 정책 | 퍼블릭 접근 차단 (Block all public access ON) |
| 디렉토리 구조 | Raw Zone: `seung/YYYY/MM/DD/sessions_raw.jsonl` · Processed Zone: `seung/processed/YYYY-MM-DD/metrics.json` |
| IAM 권한 | Airflow 실행 계정: `s3:PutObject`, `s3:GetObject`, `s3:ListBucket` 권한 부여 |
| seung 서비스 권한 | `/api/analytics/daily` 읽기용: `s3:GetObject` 권한 (별도 IAM 사용자 또는 EC2 IAM Role) |

### 인프라 — EC2 (Airflow 호스트)

| 항목 | 내용 |
|------|------|
| 서버 | seung 서비스가 배포된 EC2 인스턴스 (또는 별도 Airflow 전용 인스턴스) |
| 접근 방법 | SSH 키 또는 AWS SSM Session Manager |
| Python 버전 | Python 3.9+ 필요 (`python3 --version` 확인) |
| Docker | Docker + Docker Compose 설치 확인 (`docker --version`) |
| 포트 | Airflow Webserver: 8080 (보안 그룹에서 접근 IP 제한 필수) |
| 네트워크 | Supabase가 DB 접근을 관리 — 별도 보안 그룹 설정 불필요 |

### DB — 읽기 전용 역할 생성 (Supabase)

Supabase 대시보드 → **SQL Editor** → 아래 SQL 실행:

```sql
CREATE ROLE seung_readonly WITH LOGIN PASSWORD '강력한_패스워드';
GRANT CONNECT ON DATABASE postgres TO seung_readonly;
GRANT USAGE ON SCHEMA public TO seung_readonly;
GRANT SELECT ON "InterviewSession", "Report" TO seung_readonly;
```

**Connection String 확인:**

Supabase 대시보드 → **Settings → Database → Connection string** → `seung_readonly` 계정으로 조합:

```
postgresql://seung_readonly:패스워드@db.xxxx.supabase.co:5432/postgres
```

→ 이 값을 `SEUNG_DB_READONLY_CONN`에 설정하고 Airflow Connection `seung_db_readonly`로 등록.

### 환경변수 체크리스트

Phase 2 시작 전 아래 값이 모두 준비되어 있어야 한다.

```
# AWS (GitHub Secrets에 이미 등록됨 — 추가 발급 불필요)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION                # ap-northeast-2
SEUNG_S3_ANALYTICS_BUCKET       # 생성한 버킷명 (mirai-seung-analytics)

# DB
SEUNG_DB_READONLY_CONN    # postgresql://seung_readonly:pw@db.xxxx.supabase.co:5432/postgres

# Airflow (EC2 ~/.env.seung-airflow)
AIRFLOW_SECRET_KEY        # 랜덤 32자 이상 문자열 (openssl rand -hex 32)

# seung 서비스 (EC2 .env)
ANALYTICS_API_KEY         # /api/analytics/daily X-Internal-Key 값 (openssl rand -hex 16)
```

### GitHub Secrets 추가 필요

자동 배포(`deploy-seung-airflow.yml`)를 위해 아래 2개 추가:

```
SEUNG_AIRFLOW_EC2_HOST   # Airflow EC2 퍼블릭 IP
SEUNG_AIRFLOW_EC2_USER   # ubuntu
```

---

## 구현 계획

> 작업 시작 조건: Phase 1은 즉시 시작 가능. Phase 2는 EC2 접근 가능 이후 진행.

---

### Phase 1 — EC2 독립 작업 (즉시 시작)

#### Step 1-1: 타입 추가

파일: `services/seung/src/lib/types.ts`

```ts
export type UserProgressItem = {
  round: number
  sessionId: string
  totalScore: number
  scores: AxisScores
  createdAt: string
}
export type UserProgressResponse = { items: UserProgressItem[] }
```

---

#### Step 1-2: `GET /api/user/progress` 신규

파일: `services/seung/src/app/api/user/progress/route.ts`

```ts
// Auth 필수 — supabase.auth.getUser()
// 미인증 → 401

// Report.userId 직접 쿼리 (schema.prisma:42 확인)
// NOTE: where: { session: { userId } } 대신 where: { userId: user.id } 사용
// userId는 nullable(String?)이므로 null 리포트는 자연스럽게 필터됨
const reports = await prisma.report.findMany({
  where: { userId: user.id },
  orderBy: { createdAt: 'asc' },
  select: { sessionId: true, totalScore: true, scores: true, createdAt: true },
})
// round = index + 1
return { items: reports.map((r, i) => ({ round: i + 1, ...r })) }
```

엣지 케이스:
- 미인증 → 401
- 리포트 없는 유저 → 200 `{ items: [] }`

---

#### Step 1-3: 테스트 `tests/api/user-progress.test.ts`

vitest + vi.mock 패턴 (report-get.test.ts 참고):

```ts
// vi.mock('@/lib/prisma', ...) + vi.mock('@/lib/supabase/server', ...)
// 케이스:
// 1. 리포트 없는 유저 → { items: [] } (200)
// 2. 리포트 2개 → items[0].round=1, items[1].round=2 (오름차순 정렬)
// 3. 미인증 → 401
// 4. DB 오류 → 500
```

---

#### Step 1-4: Dashboard 성장 추이 섹션

파일: `services/seung/src/app/dashboard/page.tsx`

- `DashboardPage` 마운트 시 `/api/user/progress` 호출 (병렬, `/api/dashboard`와 함께)
- `items.length < 2` → 섹션 렌더 안 함 (조건: 리포트 2개 이상)
- recharts `LineChart` — X축: round(1, 2, 3...), Y축: totalScore(0~100)
- 자소서 목록 위에 독립 섹션 배치 (헤더 아래, 자소서 목록 위)

패키지 확인: `services/seung/package.json`에 recharts 없으면 `npm install recharts` 필요.

---

### Phase 2 — Airflow (EC2 접근 후 진행)

#### Step 2-0: 사전 조건 — 읽기 전용 DB 역할 생성

seung Postgres에서 읽기 전용 역할 생성 (DBA 또는 seung 관리자가 실행):

```sql
CREATE ROLE seung_readonly WITH LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE seung_db TO seung_readonly;
GRANT USAGE ON SCHEMA public TO seung_readonly;
GRANT SELECT ON "InterviewSession", "Report" TO seung_readonly;
```

이 Connection String을 Airflow Connection `seung_db_readonly`로 등록.

---

#### Step 2-1: `services/seung/airflow/` 디렉토리 구조 생성

siw airflow 패턴 그대로 복사:

```
services/seung/airflow/
  docker-compose.yml
  Dockerfile           # siw Dockerfile 동일
  requirements.txt     # apache-airflow[amazon,postgres]
  dags/
    seung_analytics_dag.py
  tests/
    conftest.py
    __init__.py
    test_seung_analytics_dag.py
  .ai.md
```

---

#### Step 2-2: `docker-compose.yml`

siw docker-compose.yml 패턴 복사 후 Variables 변경:

```yaml
AIRFLOW_VAR_SEUNG_S3_ANALYTICS_BUCKET: "${SEUNG_S3_ANALYTICS_BUCKET}"
AIRFLOW_VAR_AWS_ACCESS_KEY_ID: "${AWS_ACCESS_KEY_ID}"
AIRFLOW_VAR_AWS_SECRET_ACCESS_KEY: "${AWS_SECRET_ACCESS_KEY}"
AIRFLOW_VAR_AWS_REGION: "${AWS_REGION}"
# DB Connection: Airflow Connection으로 관리 (AIRFLOW_CONN_* 패턴)
AIRFLOW_CONN_SEUNG_DB_READONLY: "${SEUNG_DB_READONLY_CONN}"
```

---

#### Step 2-3: `seung_analytics_dag.py`

Schedule: `0 15 * * *` (KST 00:00), 패턴: `llm_quality_dag.py` 참고

```python
def extract_sessions(ds: str, **kwargs):
    import boto3
    from airflow.hooks.base import BaseHook

    # SEUNG_S3_ANALYTICS_BUCKET 미설정 시 graceful skip
    try:
        bucket = Variable.get("SEUNG_S3_ANALYTICS_BUCKET")
    except KeyError:
        raise AirflowSkipException("SEUNG_S3_ANALYTICS_BUCKET not configured")

    # 읽기 전용 Connection 사용 (BaseHook 패턴 — llm_quality_dag:88 참고)
    conn_info = BaseHook.get_connection("seung_db_readonly")
    conn = psycopg2.connect(
        host=conn_info.host, port=conn_info.port or 5432,
        dbname=conn_info.schema, user=conn_info.login, password=conn_info.password
    )
    # InterviewSession LEFT JOIN Report WHERE DATE(createdAt) = ds
    # → JSONL → S3 Raw Zone: {bucket}/seung/{YYYY}/{MM}/{DD}/sessions_raw.jsonl
    # XCom push: raw_s3_key (문자열만, 데이터 전체 아님)

def compute_metrics(ds: str, **kwargs):
    # S3 raw_s3_key에서 JSONL 읽기
    # 면접 완료율 = sessionComplete=true / 전체
    # 리포트 생성률 = Report 있는 / sessionComplete=true
    # 평균 totalScore (리포트 있는 세션만)
    # real/practice 분포 (interviewMode 필드)
    # 평균 이탈 시점 = history 길이 평균 (sessionComplete=false 세션)
    # XCom push: metrics dict

def load_to_s3(ds: str, **kwargs):
    # metrics → S3 Processed Zone JSON
    # {bucket}/seung/processed/{ds}/metrics.json

def alert_on_low_completion(ds: str, **kwargs):
    # completion_rate < 0.3 → logger.warning (llm_quality_dag alert 패턴 동일)
```

DAG: `t1 >> t2 >> t3 >> t4`

---

#### Step 2-4: `GET /api/analytics/daily`

파일: `services/seung/src/app/api/analytics/daily/route.ts`

```ts
// X-Internal-Key 헤더 가드 (Architect 권고 반영)
// request.headers.get('x-internal-key') !== process.env.ANALYTICS_API_KEY → 401
// SEUNG_S3_ANALYTICS_BUCKET 미설정 시 503
// date param: 기본값 어제 (YYYY-MM-DD)
// S3에서 {bucket}/seung/processed/{date}/metrics.json 읽어 반환
// 파일 없으면 404
```

환경변수 추가 (`services/seung/.env.example`):

```
SEUNG_S3_ANALYTICS_BUCKET=
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
ANALYTICS_API_KEY=          # /api/analytics/daily X-Internal-Key 헤더 검증용
```

---

#### Step 2-5: Airflow 테스트 `tests/test_seung_analytics_dag.py`

pytest + unittest.mock 패턴 (test_job_crawl_dag.py 참고):

```python
# 케이스:
# 1. compute_metrics — 완료율 계산 검증 (sessionComplete=true 4/10 → 0.4)
# 2. compute_metrics — real/practice 분포 계산 검증
# 3. compute_metrics — 데이터 없는 날 → 빈 메트릭 (ZeroDivisionError 없음)
# 4. extract_sessions — SEUNG_S3_ANALYTICS_BUCKET 미설정 시 AirflowSkipException
```

---

### Phase 3 — .ai.md 최신화

#### Step 3-1: `services/seung/airflow/.ai.md` 신규 생성

- 목적·구조·역할 기술
- **불변식 4 예외 명시**: "Airflow DAG가 seung Postgres에 psycopg2로 직접 접근하는 것은 아키텍처 불변식 4("DB는 서비스가 소유")의 의도적 예외. 이유: Python 배치 파이프라인에서 Prisma 사용 불가. 완화 조건: SELECT 전용 읽기 전용 역할(seung_db_readonly) 사용. 기술 부채 트리거: 두 번째 DAG가 app DB 접근 필요 시 내부 export API 분리 검토."

#### Step 3-2: `services/seung/.ai.md` 최신화

- DE 파이프라인 섹션 추가 (airflow 디렉토리, 신규 API 엔드포인트)

---

## 수정·신규 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/lib/types.ts` | `UserProgressItem`, `UserProgressResponse` 타입 추가 |
| `src/app/api/user/progress/route.ts` | 신규 — Auth 필수 |
| `src/app/api/analytics/daily/route.ts` | 신규 — X-Internal-Key 가드, 인증 대체 |
| `src/app/dashboard/page.tsx` | 자소서 목록 위 성장 추이 섹션 추가 (recharts) |
| `tests/api/user-progress.test.ts` | 신규 |
| `airflow/docker-compose.yml` | 신규 |
| `airflow/Dockerfile` | 신규 (siw 복사) |
| `airflow/requirements.txt` | 신규 |
| `airflow/dags/seung_analytics_dag.py` | 신규 |
| `airflow/tests/conftest.py` | 신규 (siw 패턴) |
| `airflow/tests/__init__.py` | 신규 |
| `airflow/tests/test_seung_analytics_dag.py` | 신규 |
| `airflow/.ai.md` | 신규 — 불변식 4 예외 명시 |
| `services/seung/.ai.md` | DE 파이프라인 섹션 추가 |
| `.env.example` | `SEUNG_S3_ANALYTICS_BUCKET`, `ANALYTICS_API_KEY` 추가 |

---

## 아키텍처 결정 기록 (ADR)

**결정**: Airflow DAG가 psycopg2로 seung Postgres에 직접 접근
**드라이버**: Python 배치 파이프라인에서 Prisma ORM 사용 불가, 하루 1회 소량 읽기
**고려한 대안**: 내부 export API (`GET /api/internal/sessions-export`) — 코드·지연 추가 대비 현재 규모에서 과도
**선택 이유**: 읽기 전용 역할로 blast radius 제한, 단일 DAG 범위 내에서 관리 가능
**완화 조건**: `seung_db_readonly` 역할 (SELECT 전용), `.ai.md`에 기술부채 명시
**기술부채 트리거**: 두 번째 DAG가 app DB 접근 필요 시 내부 export API 분리
