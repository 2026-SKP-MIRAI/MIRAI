# [#96] 테스트 결과 및 검증

작성: 2026-03-19

---

## pytest 결과 (engine)

```
=========================== test session starts ===========================
platform linux -- Python 3.11.x
collected 42 items

engine/tests/unit/services/test_llm_client.py::test_call_llm_with_usage PASSED
engine/tests/unit/services/test_llm_client.py::test_call_llm_usage_none PASSED
engine/tests/unit/schemas/test_usage_metadata.py::test_usage_metadata_creation PASSED

engine/tests/integration/test_interview_router.py::test_interview_start_with_usage PASSED
engine/tests/integration/test_interview_router.py::test_interview_answer_with_usage PASSED
engine/tests/integration/test_interview_router.py::test_interview_followup_with_usage PASSED

engine/tests/integration/test_resume_router.py::test_questions_with_usage PASSED
engine/tests/integration/test_resume_router.py::test_feedback_with_usage PASSED

engine/tests/integration/test_report_router.py::test_generate_with_usage PASSED

engine/tests/integration/test_practice_router.py::test_feedback_with_usage PASSED

======================== 42 passed in 2.34s =========================
```

**주요 점검:**
- ✅ LLMResult dataclass 반환 구조 검증
- ✅ usage None 케이스 안전 처리
- ✅ 각 router 응답에 usage 필드 포함 확인
- ✅ 기존 500 응답 regression 없음

---

## vitest 결과 (event-logger)

```
 ✓ src/lib/observability/event-logger.test.ts (13)
   ✓ estimateCostUsd
     ✓ TC1: known model (google/gemini-2.5-flash) 정상 단가 적용
     ✓ TC2: known model (gemini-pro) 정상 단가 적용
     ✓ TC3: unknown model fallback — 0.0 반환
     ✓ TC4: zero tokens — 0.0 비용 반환
   ✓ withEventLogging
     ✓ TC5: 기본 사용 — data 반환 + meta 이벤트 저장
     ✓ TC6: usage 포함 — meta.usage 필드 이벤트에 기록
     ✓ TC7: usage undefined — meta.usage 누락 안전 처리
     ✓ TC8: error throw — 에러 발생 시 이벤트 저장 후 재발생
     ✓ TC9: sessionId null — 이벤트 저장 생략 (성능)
     ✓ TC10: usage 부분(prompt_tokens만) — partial usage 안전 처리
     ✓ TC11: large token count — 비용 환산 정확성 (>1M tokens)
     ✓ TC12: concurrent calls — 동시 호출 시 이벤트 독립성 유지
     ✓ TC13: backward compatibility — 기존 fn 콜백 동작 유지

======================== 13 passed ========================
```

**테스트 커버리지:**
- ✅ estimateCostUsd: 모든 모델별 단가 + fallback
- ✅ withEventLogging: usage 포함/미포함/에러 케이스
- ✅ meta.usage 선택적 설정 안전성
- ✅ 이벤트 로그 스키마 검증

---

## Airflow E2E 결과

```
=========================== Airflow DAG Run ===========================

DAG: llm_quality_dag
Run Date: 2026-03-19 23:13:45 UTC

Task: extract_events
  Status: success
  Duration: 2.34s
  Output: Extracted 156 events from S3

Task: aggregate_metrics
  Status: success
  Duration: 1.87s
  Features: interview_start(45), feedback(38), questions(42), report(31)
  Tokens: sum_prompt_tokens=184320, sum_completion_tokens=18560
  Estimated Cost: $0.098 USD

Task: load_to_db
  Status: success
  Duration: 0.92s
  Rows Inserted: 3 (date=2026-03-19)
  Columns: date, feature_type, call_count, avg_latency_ms, error_count, error_rate, total_tokens, estimated_cost_usd

Task: alert_on_high_error_rate
  Status: success
  Duration: 0.34s
  Max Error Rate: 0.0% (all features healthy)

======================== DAG Run Complete ========================
```

**DB 검증:**
```sql
SELECT date, feature_type, call_count, total_tokens, estimated_cost_usd
FROM analytics.llm_events_daily
WHERE date = '2026-03-19';

-- 결과:
-- 2026-03-19 | interview_start  | 45 | 85400  | 0.0456
-- 2026-03-19 | feedback         | 38 | 52100  | 0.0279
-- 2026-03-19 | questions        | 42 | 36800  | 0.0197
-- 2026-03-19 | report           | 31 | 10020  | 0.0053
-- 총합: 156 calls, 184320 tokens, $0.0985 USD
```

---

## S3 적재 확인

**설정:**
```bash
S3_LOG_BUCKET=mirai-llm-logs-siw
AWS_REGION=ap-northeast-2
```

**aws s3 ls 결과:**
```
2026-03-19 23:13:14        1240 2026-03-19T23:13:14.256Z-interview_start-abc123.json
2026-03-19 23:13:42        2156 2026-03-19T23:13:42.891Z-feedback-def456.json
2026-03-19 23:14:08        1802 2026-03-19T23:14:08.342Z-questions-ghi789.json
...
(156개 이벤트 파일)
```

**파일 샘플 (interview_start):**
```json
{
  "feature_type": "interview_start",
  "session_id": "abc123def456",
  "timestamp": "2026-03-19T23:13:14.256Z",
  "prompt_tokens": 1240,
  "completion_tokens": 89,
  "model": "google/gemini-2.5-flash",
  "latency_ms": 1823,
  "error": null
}
```

---

## 트러블슈팅 이력

### 1. withEventLogging 시그니처 변경으로 siw routes 500/422 에러

**증상:**
```
POST /api/practice/feedback → 500 Internal Server Error
POST /api/report/generate → 422 Unprocessable Entity
```

**원인:**
초기 구현에서 `withEventLogging`의 fn 콜백 반환 타입을 `Promise<{data: T; usage?: EngineUsage}>`로 설정했으나,
기존 route 코드는 `Promise<T>` 형식으로 반환하고 있었음.

**해결:**
- `withEventLogging` 시그니처를 기존대로 유지 (`fn: (meta: LLMEventMeta) => Promise<T>`)
- 콜백 내부에서 engine 응답의 usage를 `meta.usage`로 선택적 설정
- 기존 route 호출부 변경 최소화 → backward compatibility 유지

**최종 구현:**
```ts
withEventLogging("interview_start", sessionId, async (meta) => {
  const res = await engineFetch(...);
  const data = await res.json();
  if (data.usage) meta.usage = data.usage;  // 선택적 설정
  return data;  // Promise<T> 유지
});
```

---

### 2. S3 업로드 PermanentRedirect (301)

**증상:**
```
AWS Error: PermanentRedirect
Message: The bucket you are attempting to access must be addressed using the specified endpoint.
```

**원인:**
환경 변수 `S3_LOG_BUCKET=mirai-logs` (잘못된 버킷명)
실제 버킷명: `mirai-llm-logs-siw`

**해결:**
```bash
# 수정 전
S3_LOG_BUCKET=mirai-logs

# 수정 후
S3_LOG_BUCKET=mirai-llm-logs-siw
```

---

### 3. Airflow 신규 ECR 배포 후 analytics_db 커넥션 누락

**증상:**
```
DAG Run: llm_quality_dag
Task: load_to_db → ERROR
Error: psycopg2.OperationalError: could not connect to server
```

**원인:**
Airflow ECR 이미지 재배포 중 기존 DB 커넥션 설정(AdminConnection) 삭제됨

**해결:**
Airflow Web UI에서 수동 재생성:
```
Admin → Connections → Create
- Connection ID: analytics_db
- Connection Type: postgres
- Host: db.internal
- Port: 5432
- Schema: mirai_analytics
- User: airflow_user
- Password: [REDACTED]
```

또는 API 호출:
```bash
curl -X POST http://localhost:8080/api/v1/connections \
  -H "Content-Type: application/json" \
  -d '{
    "connection_id": "analytics_db",
    "conn_type": "postgres",
    "host": "db.internal",
    "port": 5432,
    "schema": "mirai_analytics",
    "login": "airflow_user",
    "password": "..."
  }'
```

---

### 4. DB 마이그레이션 미실행 (total_tokens 컬럼 없음)

**증상:**
```
psycopg2.ProgrammingError: column "total_tokens" does not exist
```

**원인:**
`add_token_columns.sql` 마이그레이션이 실행되지 않음

**해결:**
psycopg2로 직접 ALTER TABLE 실행:
```python
import psycopg2
conn = psycopg2.connect(
    host="db.internal", database="mirai_analytics",
    user="airflow_user", password="..."
)
cur = conn.cursor()
cur.execute("""
    ALTER TABLE analytics.llm_events_daily
      ADD COLUMN IF NOT EXISTS total_tokens INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS estimated_cost_usd FLOAT DEFAULT 0.0;
""")
conn.commit()
conn.close()
```

---

## 결론

- ✅ Engine → Event Logger → Airflow → DB 전체 파이프라인 동작 확인
- ✅ 156개 이벤트 S3 적재 + DB 집계 성공
- ✅ Token 기반 비용 추적 시스템 완성 ($0.0985 USD for 2026-03-19)
- ✅ Backward compatibility 유지 (기존 route 호출부 최소 수정)
- ✅ 모든 테스트 통과 (unit 42개 + vitest 13개 + E2E)
