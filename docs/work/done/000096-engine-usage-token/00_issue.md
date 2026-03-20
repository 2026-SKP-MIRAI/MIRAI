# chore: [DE] engine 응답에 usage 메타데이터 추가 — token 사용량 기반 비용 추적

## 목적
Pipeline 1 LLM 옵저버빌리티 고도화 — token 수 기반 정확한 비용 추적을 위해 engine 응답 스키마에 usage 필드를 추가한다.

## 배경
Pipeline 1(#95)에서 latency·호출 건수는 수집되지만,
token 사용량은 engine 내부에서만 알 수 있어 서비스가 비용을 계산할 수 없다.

> 🚧 **작업 시작 조건: #95 Pipeline 1 완료 + 배포 완료 이후 진행**

## 완료 기준
- [x] engine 각 API 응답 스키마에 `usage` 필드 추가
  ```json
  {
    "firstQuestion": {...},
    "usage": {
      "prompt_tokens": 1240,
      "completion_tokens": 89,
      "latency_ms": 1823,
      "model": "google/gemini-2.5-flash",
      "prompt_version": "interview_hr_v1"
    }
  }
  ```
- [x] `llm_client.py`의 `call_llm()`이 token usage를 반환에 포함
- [x] 서비스 event-logger에서 token 수 → 비용 환산 로직 추가
- [x] `llm_events_daily` 테이블에 `total_tokens`, `estimated_cost_usd` 컬럼 추가
- [x] pytest: usage 필드 포함 응답 검증

## 구현 플랜
- `engine/app/services/llm_client.py`: OpenRouter 응답의 `usage` 객체 파싱 후 반환값에 포함
- `engine/app/schemas.py`: 각 응답 모델에 `UsageMetadata` 옵셔널 필드 추가
- `services/siw/src/lib/observability/event-logger.ts`: token → USD 환산 함수 추가

## 의존성
- **#95** Pipeline 1 완료 필수

### #95 코드 수정 필요 사항 (이 이슈에서 함께 처리)
- `LLMEvent` 인터페이스에 `prompt_tokens?`, `completion_tokens?`, `model?` 필드 추가
- `llm_events_daily` 테이블에 `total_tokens INT`, `estimated_cost_usd FLOAT` 컬럼 추가
- `llm_quality_dag.py` `aggregate_metrics` 에 token 합산 로직 추가
- `llm_quality_dag.py` `load_to_db` INSERT에 신규 컬럼 반영

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] `engine/.ai.md` 최신화
- [x] 불변식 위반 없음
- [x] usage 필드 없는 구버전 응답 호환성 유지 (optional 처리)

---

## 작업 내역

### 구현 완료 사항

1. **Engine 레이어** (`engine/app/`)
   - `services/llm_client.py`: `LLMResult` dataclass 추가, `call_llm()` 반환 타입 변경 (str → LLMResult)
   - `schemas.py`: `UsageInfo`, `UsageMetadata` 모델 정의, 6개 response 타입에 `usage: UsageMetadata | None` 필드 추가
   - `services/`: 6개 service 함수 (interview, llm, feedback, report, practice, role) 튜플 반환 구현
   - `routers/`: 4개 라우터 (interview, resume, report, practice) 엔드포인트 usage 주입
   - `tests/`: pytest unit + integration 테스트 전수 mock 헬퍼 업데이트, usage 검증 assertion 추가

2. **Event Logger & Observability** (`services/siw/`)
   - `event-logger.ts`: `EngineUsage` 인터페이스, `estimateCostUsd()` 함수, `withEventLogging()` 시그니처 변경
   - `vitest`: 13개 테스트 케이스 (TC1~TC13) — `estimateCostUsd`, `withEventLogging` usage 포함, 에러 케이스 등

3. **Airflow Pipeline** (`services/siw/airflow/`)
   - `llm_quality_dag.py`: `aggregate_metrics`에 token 합산, `load_to_db`에 신규 컬럼 (total_tokens, estimated_cost_usd) INSERT
   - `migrations/add_token_columns.sql`: `analytics.llm_events_daily` 마이그레이션 실행

4. **Routes 연결** (`services/siw/src/app/api/`)
   - 5개 withEventLogging 호출부 (feedback, generate, questions, resumes×2) + interview-service 3개 함수
   - engine 응답 usage → meta.usage 연결 (선택적, null-safe)

### 주요 트러블슈팅

| 번호 | 문제 | 원인 | 해결 |
|------|------|------|------|
| 1 | withEventLogging 시그니처 변경으로 siw routes 500/422 에러 | fn 반환이 `{data, usage}` 구조여야 하는데 기존 코드 그대로 반환 | meta.usage 선택적 설정 — fn: (meta)=>Promise<T> 유지, 내부에서 meta.usage = data?.usage 처리 |
| 2 | S3 업로드 PermanentRedirect | S3_LOG_BUCKET=mirai-logs(잘못된 버킷명) | S3_LOG_BUCKET=mirai-llm-logs-siw 수정 |
| 3 | Airflow 신규 ECR 배포 후 analytics_db 커넥션 누락 | DB 커넥션이 배포 중 소실 | Airflow API (`/admin/api/v1/dags/{dag_id}/dagRuns`) 재생성 |
| 4 | llm_events_daily total_tokens 컬럼 없음 | 마이그레이션 미실행 | psycopg2 직접 ALTER TABLE 실행 |

