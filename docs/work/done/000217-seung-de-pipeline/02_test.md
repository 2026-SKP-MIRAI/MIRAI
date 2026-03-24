# [#217] feat: [seung][DE] 면접 분석 데이터 파이프라인 — 테스트 결과

> 작성: 2026-03-24

---

## 최종 테스트 결과

### Vitest 단위 테스트 (TypeScript)

```
Test Files  12 passed (12)
Tests       114 passed (114)
Duration    ~3s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/api/user-progress.test.ts` | 4 | ✅ 전체 통과 | 신규 — 빈 배열·round 정렬·401·500 |
| `tests/api/dashboard.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/questions.test.ts` | 21 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-start.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-answer.test.ts` | 13 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/interview-session.test.ts` | 8 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-generate.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/report-get.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-feedback.test.ts` | 14 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-delete.test.ts` | 5 | ✅ 전체 통과 | 변경 없음 |
| `tests/api/resume-diagnosis.test.ts` | 7 | ✅ 전체 통과 | 변경 없음 |

### pytest (Airflow DAG — Python)

```
4 passed in 0.02s
```

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `airflow/tests/test_seung_analytics_dag.py` | 4 | ✅ 전체 통과 | 신규 — 완료율·분포·빈데이터·skip 조건 |

### TypeScript 빌드

```
npx tsc --noEmit → 에러 0건
```

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/app/api/user/progress/route.ts` | GET /api/user/progress — Auth 필수, Report.userId 직접 쿼리, round = index+1 | ✅ |
| `src/app/api/analytics/daily/route.ts` | GET /api/analytics/daily — timingSafeEqual X-Internal-Key 검증, ANALYTICS_API_KEY 미설정 시 503, date 정규식 검증, NoSuchKey instanceof 처리, transformToString() 사용 | ✅ |
| `tests/api/user-progress.test.ts` | /api/user/progress 단위 테스트 4개 | ✅ |
| `airflow/docker-compose.yml` | Airflow standalone (webserver + scheduler), SEUNG_DB_READONLY_CONN 연결 | ✅ |
| `airflow/Dockerfile` | siw 패턴 동일 | ✅ |
| `airflow/requirements.txt` | apache-airflow[amazon,postgres] 등 | ✅ |
| `airflow/dags/seung_analytics_dag.py` | extract_sessions → compute_metrics → load_to_s3 → alert_on_low_completion | ✅ |
| `airflow/tests/conftest.py` | pytest airflow mock fixture | ✅ |
| `airflow/tests/test_seung_analytics_dag.py` | DAG 단위 테스트 4개 | ✅ |
| `airflow/.ai.md` | 불변식 4 예외 사항 + ADR 명시 | ✅ |
| `.github/workflows/deploy-seung-airflow.yml` | `services/seung/airflow/**` 변경 시 Airflow EC2 자동 배포 (git pull + docker compose restart) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/lib/types.ts` | `UserProgressItem`, `UserProgressResponse` 타입 추가 | ✅ |
| `src/app/dashboard/page.tsx` | /api/user/progress 호출 + recharts LineChart 성장 추이 섹션 추가 (items≥2 조건) | ✅ |
| `services/seung/.ai.md` | DE 파이프라인 섹션 추가, 신규 API 라우트·airflow 디렉토리·환경변수 반영 | ✅ |
| `docs/work/active/000217-seung-de-pipeline/01_plan.md` | 구현 계획 작성 (Architect+Critic 합의 완료) | ✅ |

---

## TDD 사이클

### RED → GREEN

- `tests/api/user-progress.test.ts` 4개 작성 → route 없음으로 RED 확인 → `src/app/api/user/progress/route.ts` 구현 → 4/4 통과
- 기존 110개 테스트 회귀 없음, 신규 4개 추가 → 114개 전체 통과
- Airflow pytest 4개 작성 → `seung_analytics_dag.py` 구현 → 4/4 통과

---

## 코드 리뷰 수정 내역

| 심각도 | 이슈 | 수정 |
|--------|------|------|
| CRITICAL | `/api/analytics/daily` API key 비교에 타이밍 어택 취약점 | `timingSafeEqual` 적용 |
| CRITICAL | `date` 파라미터 미검증으로 S3 path traversal 가능 | `/^\d{4}-\d{2}-\d{2}$/` 정규식 검증 추가 |
| HIGH | `response.Body` null 체크 없음 | null 가드 추가, 502 반환 |
| HIGH | `S3Client`를 요청마다 생성 | 모듈 스코프로 이동 |
| HIGH | `compute_metrics`가 `extract_sessions` skip을 감지 못하고 빈 메트릭 저장 | `raw_s3_key is None` 시 `AirflowSkipException` 전파 |
| MEDIUM | `getYesterday()`가 UTC 기준 → DAG KST 스케줄과 불일치 | KST+9 오프셋 적용 |
| MEDIUM | SQL `DATE(createdAt)` UTC 기준 → KST 00:00 배치 스케줄과 날짜 불일치 | `AT TIME ZONE 'Asia/Seoul'` 적용 |
| MEDIUM | `report_rate` 분모가 `sessionComplete=true` 세션 — `report/generate`가 미완료 세션에도 리포트 생성 가능하므로 >1.0 될 수 있음 | 분모를 전체 세션으로 변경 |
| CRITICAL | AWS 자격증명을 Airflow Variables에 저장 → Airflow UI 평문 노출 | EC2 IAM Instance Role 적용, `boto3.client("s3")` explicit credential 제거 |
| HIGH | `load_to_s3`에서 `metrics=None` → `json.dumps(None)` → S3에 `"null"` 적재 | `AirflowSkipException` 전파 추가 |
| HIGH | `alert_on_low_completion`에서 `metrics=None` → `AttributeError` DAG fail | `if not metrics: return` 추가 |
| HIGH | `ANALYTICS_API_KEY` 미설정 시 `expected=''` → 명시적 처리 없음 | 미설정 시 503 반환 추가 |
