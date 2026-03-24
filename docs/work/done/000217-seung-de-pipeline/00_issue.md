# feat: [seung][DE] 면접 분석 데이터 파이프라인 — DB→S3 일배치 집계 + 성장 추이 시각화

## 사용자 관점 목표

면접 데이터를 매일 자동으로 집계하여 **운영자는** 전체 서비스의 면접 완료율·평균 점수 추이를 파악하고, **사용자는** 자신의 회차별 점수 변화를 대시보드에서 확인할 수 있다.

## 배경

현재 면접 세션과 리포트 데이터가 DB에 쌓이고 있지만 분석이 불가능하다.

- 하루에 몇 명이 면접을 완료했는지 파악 불가
- 어느 단계에서 이탈하는지 모름
- 사용자 입장에서 내 점수가 회차를 거듭하며 오르고 있는지 확인 불가
- 서비스 개선이 감(感) 기반

seung DB에서 매일 데이터를 추출(Extract) → S3 Raw Zone에 적재(Load) → Airflow DAG가 집계(Transform) → S3 Processed Zone 저장 및 API 서빙하는 ETL 파이프라인을 구축한다.

> 🚧 **작업 시작 조건**: seung 서비스 배포 완료 이후 진행.
> `/api/user/progress` API와 Dashboard 시각화는 독립적으로 먼저 작성 가능.
> Airflow 설치 및 DAG는 EC2 접근 가능 이후 진행.

## 파이프라인 구조

```
seung DB (InterviewSession, Report)
  ↓  [Airflow: extract_sessions — psycopg2 직접 쿼리]
S3 Raw Zone
  {SEUNG_S3_ANALYTICS_BUCKET}/seung/YYYY/MM/DD/sessions_raw.jsonl
  ↓  [Airflow: compute_metrics]
S3 Processed Zone
  {SEUNG_S3_ANALYTICS_BUCKET}/seung/processed/YYYY-MM-DD/metrics.json
  ↓
/api/analytics/daily   # 운영용 (X-Internal-Key 헤더 인증, 내부 전용)
/api/user/progress     # 개인용 (Auth 필수)
  ↓
Dashboard: 자소서 목록 위 성장 추이 섹션 — 회차별 totalScore LineChart (recharts)
```

## 완료 기준

- [ ] seung EC2에 Airflow 설치 및 초기 설정 완료 (webserver, scheduler 실행, Variables 설정) ← 인프라 작업, PR 머지 후 직접 수행 필요
- [x] `GET /api/user/progress` — 로그인 유저의 리포트 이력 반환 (round, sessionId, totalScore, scores, createdAt)
- [x] Dashboard 자소서 목록 위 성장 추이 섹션 추가 — 회차별 totalScore LineChart (recharts), 리포트 2개 미만이면 섹션 숨김
- [x] `services/seung/airflow/dags/seung_analytics_dag.py` 신규 — extract_sessions → compute_metrics → load_to_s3 → alert_on_low_completion
- [x] 집계 메트릭:
  - 면접 완료율: `sessionComplete=true` 세션 / 전체 세션
  - 리포트 생성률: Report 있는 세션 / 전체 세션 (`report/generate`가 미완료 세션에도 리포트 생성 가능하므로 전체 기준 사용)
  - 평균 totalScore, real/practice 모드 분포, 평균 이탈 시점(history 길이 평균)
- [x] 집계 결과가 S3 Processed Zone에 JSON으로 적재됨
- [x] `GET /api/analytics/daily?date=YYYY-MM-DD` — 운영용, X-Internal-Key 헤더 인증, S3 Processed Zone 집계 결과 반환
- [x] `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 DAG graceful skip, `/api/analytics/daily` 503 반환
- [x] 테스트: `tests/api/user-progress.test.ts` — 리포트 없는 유저 → 빈 배열, 정렬 순서 검증
- [x] 테스트: `airflow/tests/test_seung_analytics_dag.py` — compute_metrics 완료율·모드 분포 계산 검증

## 구현 플랜

### Step 0 — seung EC2 Airflow 설치

```bash
# 패키지 설치
pip install "apache-airflow[amazon,postgres]"

# DB 초기화 및 관리자 계정 생성
airflow db init
airflow users create --role Admin --username admin ...

# services/seung/airflow/docker-compose.yml 으로 webserver + scheduler 실행
```

Airflow Variables 설정:
```
SEUNG_S3_ANALYTICS_BUCKET   # Raw/Processed Zone 버킷명
```
※ AWS 자격증명(ACCESS_KEY, SECRET_KEY, REGION)은 EC2 IAM Instance Role로 자동 주입 — Variables에 등록하지 않는다.

### Step 1 — `GET /api/user/progress`

```ts
// services/seung/src/app/api/user/progress/route.ts
// Auth 필수 (supabase.auth.getUser())
const reports = await prisma.report.findMany({
  where: { session: { userId: user.id } },
  orderBy: { createdAt: 'asc' },
  select: { id: true, sessionId: true, totalScore: true, scores: true, createdAt: true },
})
// round = index + 1
```

### Step 2 — Dashboard 성장 추이 섹션

```tsx
// 자소서 목록 위 독립 섹션
// /api/user/progress 호출 → 리포트 2개 이상일 때만 렌더
// recharts LineChart — X축: 회차(1, 2, 3...), Y축: totalScore(0~100)
```

### Step 3 — `seung_analytics_dag.py`

```python
# Schedule: 매일 UTC 15:00 (KST 00:00)
# siw llm_quality_dag 패턴 동일

def extract_sessions(ds, **kwargs):
    # Variable.get("SEUNG_DB_URL")로 seung Postgres 연결
    # InterviewSession LEFT JOIN Report WHERE DATE(createdAt) = ds
    # S3 Raw Zone JSONL 업로드

def compute_metrics(ds, **kwargs):
    # 면접 완료율 = sessionComplete=true / 전체
    # 리포트 생성률 = Report 있는 / 전체 세션
    # 평균 totalScore, real/practice 분포, history 길이 평균

def load_to_s3(ds, **kwargs):
    # S3 Processed Zone JSON 업로드

def alert_on_low_completion(ds, **kwargs):
    # 면접 완료율 < 30% 시 경고 로그
```

### Step 4 — `GET /api/analytics/daily`

```ts
// services/seung/src/app/api/analytics/daily/route.ts
// 인증 없음 — 내부 전용
// date param 기본값: 어제 (YYYY-MM-DD)
// SEUNG_S3_ANALYTICS_BUCKET 미설정 시 503
```

### Step 5 — 환경변수 추가

```
# services/seung .env
SEUNG_S3_ANALYTICS_BUCKET      # Processed Zone 읽기용
AWS_REGION
```

### Step 6 — 테스트

- `tests/api/user-progress.test.ts`
- `airflow/tests/test_seung_analytics_dag.py`

## 기술 스택 추가

- **recharts**: Dashboard 성장 추이 LineChart
- **@aws-sdk/client-s3**: `/api/analytics/daily` S3 읽기
- **Apache Airflow**: 배치 집계 스케줄링 (seung EC2)
- **AWS S3**: Data Lake Raw/Processed Zone

## 수정·신규 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/app/api/user/progress/route.ts` | 신규 |
| `src/app/api/analytics/daily/route.ts` | 신규, 인증 없음 (내부 전용) |
| `src/app/dashboard/page.tsx` | 자소서 목록 위 성장 추이 섹션 추가 |
| `src/lib/types.ts` | `UserProgressItem`, `UserProgressResponse` 타입 추가 |
| `tests/api/user-progress.test.ts` | 신규 |
| `airflow/docker-compose.yml` | 신규 — Airflow webserver + scheduler |
| `airflow/dags/seung_analytics_dag.py` | 신규 |
| `airflow/tests/test_seung_analytics_dag.py` | 신규 |
| `airflow/.ai.md` | 신규 (CLAUDE.md 규칙) |
| `services/seung/.ai.md` | DE 파이프라인 반영 |

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] `services/seung/.ai.md` 최신화
- [x] `airflow/.ai.md` 생성 (신규 디렉토리)
- [x] 불변식 위반 없음 (LLM 호출 없음, DB는 seung 소유)
- [x] `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 기존 동작 영향 없음

---

## 작업 내역

### 신규 파일

**`src/app/api/user/progress/route.ts`**
- GET /api/user/progress — Supabase Auth 필수, `Report.userId`로 직접 쿼리(세션 JOIN 불필요)
- `createdAt` 오름차순 정렬 후 `round = index + 1` 부여 → 회차 번호를 DB에 저장하지 않고 조회 시점에 계산

**`src/app/api/analytics/daily/route.ts`**
- GET /api/analytics/daily?date=YYYY-MM-DD — 운영용 내부 API
- `timingSafeEqual`로 X-Internal-Key 헤더 검증(타이밍 어택 방지)
- date 파라미터 정규식 검증(`/^\d{4}-\d{2}-\d{2}$/`)으로 S3 path traversal 차단
- `S3Client` 모듈 스코프 재사용, `response.Body.transformToString()` SDK 내장 메서드 사용
- `NoSuchKey` instanceof 체크로 타입 안전한 404 처리
- KST 기준 어제 날짜 계산(`KST_OFFSET_MS = 9h`) — DAG 스케줄 KST 00:00 기준과 일치

**`airflow/dags/seung_analytics_dag.py`**
- Schedule: `0 15 * * *` (UTC) = KST 00:00
- `extract_sessions`: `BaseHook.get_connection("seung_db_readonly")`로 psycopg2 직접 쿼리, SQL에 `AT TIME ZONE 'Asia/Seoul'` 적용, S3 Raw Zone JSONL 업로드
- `compute_metrics`: `raw_s3_key is None` 시 `AirflowSkipException` 전파, report_rate 분모를 전체 세션으로 계산(report/generate가 sessionComplete 체크 없음)
- `load_to_s3`: S3 Processed Zone JSON 업로드
- `alert_on_low_completion`: 완료율 < 30% 시 경고 로그
- `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 `AirflowSkipException`으로 graceful skip

**`airflow/docker-compose.yml`**
- Airflow standalone (webserver + scheduler), `AIRFLOW_CONN_SEUNG_DB_READONLY` 환경변수 주입
- AWS 자격증명 Variables(`AWS_ACCESS_KEY_ID` 등) 제거 — EC2 IAM Instance Role로 대체

**`airflow/tests/test_seung_analytics_dag.py`**
- pytest 4개: completion_rate(0.4), mode_distribution(real/practice), 빈데이터 ZeroDivision 없음, SEUNG_S3_ANALYTICS_BUCKET 미설정 시 skip

**`.github/workflows/deploy-seung-airflow.yml`**
- `services/seung/airflow/**` 변경 시 EC2에서 git pull + docker compose up -d --build 자동 배포
- `~/.env.seung-airflow` 없으면 배포 중단

**`tests/api/user-progress.test.ts`**
- 빈 배열, round 정렬, 401 미인증, 500 DB 오류 — 4개 테스트

### 수정 파일

**`src/app/dashboard/page.tsx`**
- `/api/user/progress` 별도 useEffect 호출(progress는 부가 기능 — 오류 무시, 메인 대시보드 로딩에 영향 없음)
- `progressItems.length >= 2` 조건부 recharts LineChart 렌더링(자소서 목록 위)

**`src/lib/types.ts`**
- `UserProgressItem`, `UserProgressResponse` 타입 추가

**`services/seung/.ai.md`**
- user/progress, analytics/daily 라우트 항목 추가, airflow 디렉토리 구조 반영

**`services/seung/airflow/.ai.md`**
- 아키텍처 불변식 4 예외 사항(psycopg2 직접 접근) 및 ADR 명시

