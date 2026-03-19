# feat: [siw][DE] Pipeline 1 — LLM 옵저버빌리티 (서비스 레벨 이벤트 로그 수집·S3 적재·Airflow 배치 집계)

## 사용자 관점 목표
LLM 호출 데이터를 수집·집계하여 기능별 호출 빈도·latency·성공률 파악 및 서비스 품질 개선 의사결정 기반을 마련한다.

## 배경
현재 LLM 호출 결과가 전부 휘발된다.
- 기능별(start/answer/followup/report) 호출 빈도 파악 불가
- latency 이상 감지 불가
- 어느 단계에서 에러가 많이 나는지 모름
- 서비스 개선이 감(感) 기반

엔진은 stateless 유지 원칙에 따라 수정하지 않는다.
서비스(siw Next.js API route)에서 engine 호출 전후로 이벤트를 수집하고 S3에 적재한다.

> ⚠️ 추후 token 사용량 기반 비용 추적 시 엔진 수정 필요
> (engine 응답 스키마에 usage.prompt_tokens, usage.completion_tokens 추가 — 별도 이슈로 관리)

> 🚧 **작업 시작 조건: 배포(EC2 + S3 인프라) 완료 이후 진행**
> 코어 기능(Auth, 이력서 저장, 연습 모드 UI) 및 배포 완료 후 착수할 것.
> event-logger.ts + API route 래핑은 독립적으로 먼저 작성 가능하나,
> Airflow DAG + analytics DB는 인프라 안정화 후 진행.

## 완료 기준
- [x] engine 호출마다 이벤트 로그 생성 — `{ timestamp, feature_type, latency_ms, success, error_type, session_id, retry_count }`
- [x] 이벤트 로그가 S3 `s3://mirai-logs/llm-events/YYYY/MM/DD/` 경로에 JSONL 형식으로 적재됨
- [x] `S3_LOG_BUCKET` 미설정 시 로컬 파일 fallback — 기존 개발 환경 영향 없음
- [x] Airflow DAG(`llm_quality_dag`) 일별 실행 — 기능별 호출 건수·평균 latency·에러율 집계
- [x] 집계 결과가 analytics DB 테이블(`llm_events_daily`)에 적재됨
- [x] vitest: event_logger 단위 테스트

## 구현 플랜

### Step 1 — `services/siw/src/lib/observability/event-logger.ts` 신규
```ts
interface LLMEvent {
  timestamp: string       // ISO 8601
  feature_type: string    // "interview_start" | "interview_answer" | "followup" | "report" | "practice_feedback" | "resume_feedback"
  latency_ms: number
  success: boolean
  error_type?: string
  session_id?: string
}

// S3_LOG_BUCKET 있으면 S3 적재, 없으면 로컬 JSONL fallback
export async function logLLMEvent(event: LLMEvent): Promise<void>
```

### Step 2 — API routes에 이벤트 로깅 추가
- `/api/interview/start`, `/api/interview/answer`, `/api/interview/followup`, `/api/report/generate`
- engine 호출 전후 `Date.now()`로 latency 측정 → `logLLMEvent()` 호출
- try/catch 안에서 로깅 실패가 본 기능 흐름에 영향 주지 않도록 처리

### Step 3 — 환경변수 추가
```
S3_LOG_BUCKET    # 이벤트 로그 S3 버킷 (미설정 시 로컬 fallback)
S3_LOG_PREFIX    # 기본값: llm-events
AWS_REGION       # S3 리전
```

### Step 4 — `services/siw/airflow/dags/llm_quality_dag.py` 신규 (배포 완료 후)
```python
# 일별 배치 DAG
# Task 1: S3에서 전일 JSONL 파일 읽기
# Task 2: feature_type별 호출 건수·평균 latency·에러율 집계
# Task 3: analytics DB llm_events_daily upsert
# Task 4: 에러율 > 10% 시 알림
```

### Step 5 — analytics DB 테이블 (배포 완료 후)
```sql
CREATE TABLE llm_events_daily (
  date DATE,
  feature_type TEXT,
  call_count INT,
  avg_latency_ms INT,
  error_count INT,
  error_rate FLOAT,
  PRIMARY KEY (date, feature_type)
);
```

### Step 6 — 테스트
- `tests/unit/event-logger.test.ts`: 로그 생성·S3 mock 적재·fallback 동작
- 로깅 실패 시 본 기능 흐름 영향 없음 검증

## 기술 스택 추가
- **@aws-sdk/client-s3**: S3 이벤트 로그 적재
- **Apache Airflow**: 배치 집계 스케줄링 (EC2)
- **AWS S3**: Data Lake (raw JSONL 이벤트 저장)

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] `services/siw/.ai.md` 최신화 (observability 파이프라인 반영)
- [ ] 불변식 위반 없음 (엔진 수정 없음, 로깅은 서비스 레이어)
- [ ] `S3_LOG_BUCKET` 미설정 시 기존 동작 영향 없음

---

## 작업 내역

### 2026-03-19

**현황**: 6/6 완료

**완료된 항목**:
- engine 호출마다 이벤트 로그 생성 — 9개 API route 래핑 완료 (interview×3, resume×4, report, practice)
- 이벤트 로그 S3 JSONL 적재 (`event-logger.ts`)
- S3_LOG_BUCKET 미설정 시 로컬 fallback (`event-logger.ts`)
- Airflow DAG llm_quality_dag 일별 실행 (`services/siw/airflow/dags/llm_quality_dag.py`)
- analytics DB llm_events_daily 적재 (`services/siw/airflow/sql/001_create_llm_events_daily.sql`)
- vitest: event_logger 단위 테스트 10개 + api-instrumentation 테스트

**미완료 항목**:
- (없음 — 전체 완료)

**변경 파일**: 15개+ (interview-service.ts, resumes/route.ts, resume/questions/route.ts, report/generate/route.ts, practice/feedback/route.ts, event-logger.ts, event-logger.test.ts, api-instrumentation.test.ts, airflow/Dockerfile, airflow/docker-compose.yml, airflow/requirements.txt, airflow/dags/llm_quality_dag.py, airflow/sql/001_create_llm_events_daily.sql, .github/workflows/deploy-siw-airflow.yml, package.json)

### 2026-03-19 (Phase B + C 추가 작업)

**완료된 항목**:
- `mode` 필드 추가 — LLMEvent에 `"interview" | "practice" | "resume"` 자동 파생 (FEATURE_MODE lookup table, 9개 call site 변경 없음)
- Airflow 컨테이너화 — `airflow/Dockerfile` + `docker-compose.yml` + `requirements.txt` 생성
- GitHub Actions 배포 워크플로우 — `.github/workflows/deploy-siw-airflow.yml` (ECR + 별도 Airflow EC2)
- 파일명 변경 — `deploy-airflow.yml` → `deploy-siw-airflow.yml`
- GitHub Secrets 이름 변경 — `AIRFLOW_EC2_HOST` → `SIW_AIRFLOW_EC2_HOST`, `AIRFLOW_EC2_USER` → `SIW_AIRFLOW_EC2_USER`
- S3 end-to-end 검증 — 브라우저 면접 → report_generate 이벤트 S3 실 확인
- 로컬 docker-compose 검증 — Airflow UI + llm_quality_dag Trigger 실행 확인
- code-reviewer 지적 반영 — analytics 스키마 prefix, NUMERIC(10,2), try/finally, requirements.txt

