# feat: [siw][DE] 워크넷 API 연동 크롤링 업그레이드 — Pipeline 2-2 후속 (#163)

## 사용자 관점 목표
워크넷 공식 API로 채용공고를 수집해 pgvector 데이터 품질을 높이고,
RAG Trends API가 더 넓은 채용 시장 데이터를 반영하도록 한다.

## 배경
잡코리아는 공고 상당수가 이미지 형식이어서 OCR 없이 우대사항 수집이 불가능하다.
워크넷은 고용노동부 공식 채용정보 Open API로 구조화된 텍스트 데이터를 제공하며, `prefCond`(우대사항) 필드를 직접 제공한다.
**잡코리아 드롭, 워크넷 단독 운영**으로 방향을 전환한다.

우대사항(`prefCond`)은 별도 파싱 없이 **원문 텍스트 그대로 임베딩**하여 pgvector에 저장한다.
직종 코드(`jobCd`)와 함께 저장해 직무별 벡터 검색이 가능하도록 한다.

> **수집 직종**: `0` 경영·사무, `1` 연구직·IT, `2` 교육·법률·사회복지, `4` 예술·디자인, `60` 영업·판매, `7` 건설·채굴

> 🚧 작업 시작 조건: #163 완료 + 워크넷 채용정보 Open API 이용 승인 완료
> ✅ 워크넷 Open API 신청: https://www.work24.go.kr/cm/e/a/0110/selectOpenApiIntro.do

## 완료 기준
- [x] `airflow/dags/worknet_client.py` 신규 — HTML 크롤러 (목록 + 상세 2단계, BeautifulSoup)
- [x] `airflow/dags/job_crawl_dag.py` 교체 — 워크넷 전용 DAG (매주 일요일 12:00)
- [x] `job_posting_embeddings` 테이블에 `pref_cond` (우대사항 원문), `job_cd` (직종 코드) 컬럼 추가
- [x] 우대사항 원문을 임베딩 텍스트에 포함해 pgvector upsert
- [x] 크롤링 방식 + Rate limit 가이드 `.ai.md` 문서화 (WORKNET_API_KEY 불필요)
- [x] pytest — worknet_client 단위 테스트 12개 통과 (mock HTML 응답 포함)
- [x] `.ai.md` 최신화 (airflow/)

## 구현 플랜

### Step 1 — 스키마 마이그레이션
- `airflow/sql/006_add_worknet_columns.sql` 신규
- `pref_cond TEXT`, `job_cd VARCHAR(10)` 컬럼 추가 (비파괴)

### Step 2 — 워크넷 API 클라이언트
- `airflow/dags/worknet_client.py` 신규
- `fetch_all_list(occupation_codes)` — 목록 전체 페이지 순회
- `fetch_details_batch(items)` — 상세 배치 조회 (prefCond 포함)
- Rate limit: 기본 1.0초, `WORKNET_RATE_LIMIT_SEC` Variable로 조정 가능

### Step 3 — job_crawl_dag.py 교체
- 스케줄: `0 12 * * 0` (매주 일요일 12:00)
- 선형 체인: `crawl_list → crawl_details → embed_postings → upsert_vectors → log_summary`
- content = `title + job_content + pref_cond` (임베딩 대상)
- XCom: S3 key만 전달 (`list_s3_key`, `details_s3_key`, `embedded_s3_key`)

### Step 4 — 테스트 + 문서화
- pytest worknet_client (7개 케이스: 파싱/페이지네이션/에러/rate limit)
- airflow/.ai.md에 직종 코드 목록 + WORKNET_API_KEY 설정 가이드 추가

## 개발 체크리스트
- [ ] 테스트 코드 포함 (pytest)
- [ ] `airflow/.ai.md`, `services/siw/.ai.md` 최신화
- [ ] 불변식 준수 — 임베딩 AI API 호출은 엔진 경유
- [ ] 워크넷 API 이용약관 준수 (상업적 이용 범위 확인)
- [ ] XCom에 대용량 텍스트 직접 전달 금지 (S3 key 경유)

---

## 작업 내역

### 2026-03-24

**현황**: 7/7 완료

**기술 결정사항**:
- work24.go.kr 채용정보 Open API → 개인회원 이용 불가 확인 → HTML 크롤링 전환
- 직종 코드(jobsCd) GET 파라미터 필터링 서버에서 무시됨 확인 → 직종 필터 제거
- 주요기업 공채속보 테마(S00074) 발견: POST `/wk/a/b/1700/themeEmpInfoSrchListPost.do`
  - GET으로 세션·CSRF 확보 후 POST로 resultCnt=100 요청 → 코스피/코스닥/대기업 중심 공고 수집
  - 총 292건 중 max_pages=1 기준 최신 100건 수집 (실제 Supabase upsert 확인)

**완료된 항목**:
- `airflow/dags/worknet_client.py` 신규 — 주요기업 공채속보 POST 크롤러
  - `_init_session()`: GET으로 세션·CSRF 확보
  - `fetch_all_list(max_pages)`: POST themeEmpInfoSrchListPost.do (S00074)
  - `fetch_detail()`: GET empDetailAuthView.do (pref_cond, job_content, 근무조건 파싱)
- `job_crawl_dag.py` 교체 (워크넷 전용, 매주 일요일 KST 12:00, 5-step 파이프라인)
  - xcom_pull null guard 추가 (3개 태스크)
- `sql/006_add_worknet_columns.sql` — pref_cond, job_cd 컬럼 추가
- 우대사항 원문 임베딩 포함 pgvector upsert (ON CONFLICT upsert 확인)
- `airflow/.ai.md` 최신화 (POST theme 방식, 엔드포인트 명시)
- pytest 12개 케이스 통과 (worknet_client 7개 + job_crawl_dag 5개)

**변경 파일**: 9개
- services/siw/airflow/dags/worknet_client.py (신규)
- services/siw/airflow/dags/job_crawl_dag.py (교체)
- services/siw/airflow/sql/006_add_worknet_columns.sql (신규)
- services/siw/airflow/tests/test_worknet_client.py (신규)
- services/siw/airflow/tests/test_job_crawl_dag.py (신규)
- services/siw/airflow/tests/conftest.py (수정)
- services/siw/airflow/.ai.md (수정)
- services/siw/airflow/docker-compose.yml (수정 — admin 계정 자동생성)
- services/siw/airflow/.env (수정 — Variable 자동등록 추가)

