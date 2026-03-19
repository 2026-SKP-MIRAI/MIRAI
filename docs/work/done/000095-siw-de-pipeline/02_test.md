# [#95] 테스트 내역 — LLM 옵저버빌리티 파이프라인

> 작성: 2026-03-19

---

## 테스트 결과 요약

| 구분 | 결과 |
|------|------|
| vitest 단위 테스트 | 131개 통과 (26 test files) |
| S3 직접 적재 검증 | ✅ 성공 |
| 브라우저 end-to-end | ✅ S3 JSONL 실 확인 |

---

## 1. 단위 테스트 (vitest)

### 1-1. event-logger 테스트

**파일:** `services/siw/tests/unit/event-logger.test.ts`

| TC | 테스트 케이스 | 검증 내용 | 결과 |
|----|---|---|---|
| TC1 | S3 적재 성공 | `S3_LOG_BUCKET` 설정 시 `PutObjectCommand` 호출, Bucket/Key/Body 검증 | ✅ |
| TC2 | 로컬 fallback | `S3_LOG_BUCKET` 미설정 시 `fs.appendFile` 호출, 경로 `.jsonl` 확인 | ✅ |
| TC3 | S3 실패 무영향 | S3 `send` reject → `logLLMEvents` throw 안함 | ✅ |
| TC4 | 로컬 fallback 실패 무영향 | `appendFile` reject → throw 안함 | ✅ |
| TC5 | `withEventLogging` 성공 | `success=true`, `latency_ms>0`, 반환값 보존 | ✅ |
| TC6 | `withEventLogging` 실패 | `fn` throw → `success=false`, 원 에러 re-throw | ✅ |
| TC7 | JSONL 복수 이벤트 | 2개 이벤트 → 2줄 JSONL, feature_type 순서 보존 | ✅ |
| TC8 | S3 key 패턴 | `S3_LOG_PREFIX` 사용 시 key가 `prefix/YYYY/MM/DD/` 포함 | ✅ |
| TC9 | retry_count 기록 | `meta.retry_count = 2` → 로그에 `retry_count: 2` | ✅ |
| TC10 | retry_count 기본값 | retry 없으면 `retry_count: 0` | ✅ |

**mock 설계:**
- `@aws-sdk/client-s3`: `vi.mock`으로 `S3Client`, `PutObjectCommand` mock
- `fs/promises`: `vi.mock`으로 `appendFile`, `mkdir` mock
- `beforeEach`: `vi.resetModules()` — S3Client singleton 테스트간 격리
- 환경변수: `vi.stubEnv` / `vi.unstubAllEnvs`

### 1-2. API 계측 테스트

**파일:** `services/siw/tests/unit/api-instrumentation.test.ts`

| TC | 테스트 케이스 | 검증 내용 | 결과 |
|----|---|---|---|
| ST-1 | interview start feature_type | `withEventLogging` spy → `"interview_start"` 호출 확인 | ✅ |
| ST-2 | interview answer feature_type | `withEventLogging` spy → `"interview_answer"` 호출 확인 | ✅ |
| ST-3 | interview followup feature_type | `withEventLogging` spy → `"interview_followup"` 호출 확인 | ✅ |

---

## 2. S3 직접 적재 검증 (로컬)

**일시:** 2026-03-19
**방법:** Node.js로 `@aws-sdk/client-s3` 직접 호출

```bash
# .env에서 크레덴셜 로드 후 PutObjectCommand 실행
node -e "..."  # S3Client → PutObjectCommand → send()
```

**결과:**
```
✅ S3 적재 성공!
버킷: mirai-llm-logs-siw
키: llm-events/2026/03/19/test-1773885352393.jsonl
```

**사전 작업:**
- AWS IAM 유저 `siw-github-actions`에 `s3:PutObject` 권한 추가 (버킷: `mirai-llm-logs-siw`)

---

## 3. 브라우저 End-to-End 검증

**일시:** 2026-03-19
**환경:** 로컬 (`localhost:3002`) + 실제 S3 (`mirai-llm-logs-siw`)
**엔진:** `engine/` 디렉토리에서 uvicorn 실행, OPENROUTER_API_KEY 설정

**흐름:**
1. 브라우저 `localhost:3002` 로그인
2. 기존 이력서로 면접 시작 → 답변 → 보고서 생성
3. AWS S3 콘솔 `mirai-llm-logs-siw/llm-events/2026/03/19/` 확인

**S3에서 확인된 실 이벤트:**
```json
{
  "timestamp": "2026-03-19T02:51:58.633Z",
  "feature_type": "report_generate",
  "mode": "interview",
  "latency_ms": 12399,
  "success": true,
  "session_id": "6913b2ec-9ce1-45f5-9ff2-bf82c79ef384",
  "retry_count": 0
}
```

**검증 항목:**
- [x] `feature_type` 정확 (`report_generate`)
- [x] `mode` 자동 파생 (`interview`)
- [x] `latency_ms` 측정 (12.4초 — 보고서 LLM 생성 포함)
- [x] `success: true`
- [x] `session_id` 추적 가능
- [x] `retry_count: 0` (재시도 없음)
- [x] JSONL 형식 유효

---

## 4. 로컬 Fallback 동작

`S3_LOG_BUCKET` 미설정 시 자동으로 로컬 파일에 저장:

```
services/siw/logs/llm-events/2026-03-19.jsonl
```

vitest TC2, TC4에서 mock으로 검증 완료.

---

## 5. 회귀 테스트

`withEventLogging` 래핑 적용 후 기존 테스트 전수 통과 확인:

```
Test Files: 26 passed
Tests:      131 passed
Duration:   ~5s
```

기존 interview-service, resumes, report, practice 테스트 모두 회귀 없음.

---

## 6. 로컬 docker-compose 검증

**일시:** 2026-03-19
**방법:** `cd services/siw/airflow && docker compose up`

**결과:**
- `Airflow is ready` 확인
- `localhost:8080` 로그인 성공 (admin / 자동생성 비밀번호)
- `llm_quality_dag` DAG 목록에 표시
- `airflow variables set S3_LOG_BUCKET mirai-llm-logs-siw` 설정 후 Trigger 실행
- `extract_events` 태스크 실행 진입 확인 (Variables 설정 전 `KeyError: 'Variable S3_LOG_BUCKET does not exist'` 에러 → 설정 후 정상)

---

## 환경변수 (로컬 테스트용)

```bash
# services/siw/.env
S3_LOG_BUCKET=mirai-llm-logs-siw
S3_LOG_PREFIX=llm-events
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=<IAM 유저 키>
AWS_SECRET_ACCESS_KEY=<IAM 유저 시크릿>
```

`S3_LOG_BUCKET` 제거 시 로컬 fallback 모드로 전환.
