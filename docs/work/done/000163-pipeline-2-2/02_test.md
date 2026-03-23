# [#163] 테스트 명세 — Pipeline 2-2

> 작성: 2026-03-23

---

## 테스트 범위

| 레이어 | 프레임워크 | 파일 |
|--------|-----------|------|
| Airflow DAG (Python) | pytest | `services/siw/airflow/tests/test_job_crawl_dag.py` |
| RAG 벡터 검색 (TS) | vitest | `services/siw/src/lib/rag/__tests__/vector-search.test.ts` |
| GET /feedback route (TS) | vitest | `services/siw/src/app/api/resumes/[id]/feedback/__tests__/route.test.ts` |

---

## 1. pytest — job_crawl_dag

### 실행 방법

```bash
cd services/siw/airflow
pip install -r requirements-test.txt
pytest tests/test_job_crawl_dag.py -v
```

### 테스트 케이스

| 케이스 | 설명 | 검증 포인트 |
|--------|------|------------|
| `test_fetch_postings_returns_list` | fetch_postings mock 호출 | 반환값이 list, 각 항목에 title/company/url 포함 |
| `test_fetch_postings_rate_limit` | 카테고리별 1초 대기 | `time.sleep(1)` 호출 횟수 = 카테고리 수 |
| `test_embed_postings_batches` | 엔진 /api/embed 배치 호출 | 배치 크기(10) 준수, 반환 벡터 길이 = 1024 |
| `test_upsert_postings` | pgvector upsert | ON CONFLICT (source_url, job_role) DO UPDATE 실행 |
| `test_embed_postings_logs_progress` | 임베딩 진행 로그 | `임베딩 완료: N / M` 형태 로그 출력 |
| `test_qualif_keyword_extraction` | 우대사항 텍스트 추출 | QUALIF_KEYWORDS 포함 행 추출, 빈 content 미포함 |
| `test_major_categories_count` | 12개 대분류 | `len(MAJOR_CATEGORIES) == 12` |
| `test_major_categories_codes` | BCtgrCode 정확성 | 1-10, 12, 13 포함, 11 미포함 |

### 주요 Mock 전략

```python
# requests.get mock — 잡코리아 HTML 응답 대체
# psycopg2.connect mock — RAG DB 연결 대체
# requests.post mock — 엔진 /api/embed 응답 대체 (vector [0.1]*1024)
```

---

## 2. vitest — vector-search.ts

### 실행 방법

```bash
cd services/siw
npx vitest run src/lib/rag/__tests__/vector-search.test.ts
```

### 테스트 케이스

| 케이스 | 설명 | 검증 포인트 |
|--------|------|------------|
| `extractTrendSkills — 정상` | 공고 content에서 스킬 추출 | weight 내림차순 정렬, 0 < weight ≤ 1 |
| `extractTrendSkills — 빈 공고` | postings 빈 배열 입력 | 빈 배열 반환 |
| `extractTrendSkills — fallback` | 키워드 미매칭 시 role 기반 fallback | TECH_SKILLS[role] 목록 반환 |
| `searchSimilarPostings — ENABLE_RAG=false` | RAG 비활성 | 빈 배열 반환, ragPrisma 미호출 |
| `searchSimilarPostings — ENABLE_RAG=true` | pgvector 검색 | ragPrisma.$queryRaw 호출, SimilarPosting[] 반환 |
| `getTrendSkillsForRole — 정상` | role → 임베딩 → 검색 → 스킬 | string[] 반환 |
| `getTrendSkillsForRole — embedText 실패` | embedText null 반환 | 빈 배열 반환 (에러 미발생) |

---

## 3. vitest — GET /feedback route

### 실행 방법

```bash
cd services/siw
npx vitest run src/app/api/resumes/\[id\]/feedback/__tests__/route.test.ts
```

### 테스트 케이스

| 케이스 | 설명 | 검증 포인트 |
|--------|------|------------|
| `feedback·trendComparison 모두 null` | DB에 null 저장된 레코드 | `{ feedback: null, trendComparison: null }` 반환 |
| `TrendComparison DB 저장 형태 반환` | `{ role, trendSkills, coverageScore }` 형태 | role, trendSkills[].inResume, coverageScore 검증 |
| `이력서 없을 시 404` | findDetailById throw | status 404 반환 |

### Mock 전략

```typescript
// resumeRepository.findDetailById — DB 레코드 직접 mock
// createServerClient — 인증 user-1 고정
// LLM/임베딩 호출 없음 (GET은 DB 읽기만)
```

---

## 4. 수동 검증 체크리스트

> GitHub Actions 배포 후 확인

- [ ] Supabase SQL Editor: `SELECT COUNT(*) FROM job_posting_embeddings` > 0
- [ ] Airflow UI: `job_crawl_dag` DAG 존재, 다음 실행 일정 일요일 UTC 15:00
- [ ] `ENABLE_RAG=true` 환경에서 이력서 분석 시 `trendComparison` null 아닌 값 저장 확인
- [ ] GET `/api/resumes/[id]/feedback` 응답에 `trendComparison` 필드 포함 (null 또는 객체)
- [ ] ENABLE_RAG=false 환경: 기존 동작 100% 유지 (trendComparison=null, feedback 정상)
- [ ] Prisma migration: `resumes` 테이블에 `trendComparison` 컬럼 존재

---

## 5. 아키텍처 불변식 테스트 (회귀 방지)

| 불변식 | 검증 방법 |
|--------|---------|
| 서비스가 직접 LLM 호출 안 함 | GET /feedback route에 fetch() 호출 없음 확인 |
| 임베딩 AI API는 엔진 경유 | embedding-client.ts가 ENGINE_BASE_URL/api/embed 호출 |
| ENABLE_RAG=false 시 ragPrisma 미접속 | searchSimilarPostings mock 미호출 검증 |
