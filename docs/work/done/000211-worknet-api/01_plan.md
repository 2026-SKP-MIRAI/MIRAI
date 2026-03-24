# [#211] feat: [siw][DE] 워크넷 API 연동 크롤링 — 구현 계획

> 작성: 2026-03-24
> 결정: 잡코리아 드롭 → 워크넷 단독, 상세조회 배치 처리

---

## 완료 기준

- [ ] `airflow/dags/worknet_client.py` 신규 — 워크넷 Open API 클라이언트 (목록 + 상세 2단계)
- [ ] `airflow/dags/job_crawl_dag.py` 교체 — 워크넷 전용 DAG (매주 일요일 12:00)
- [ ] `job_posting_embeddings` 테이블에 `pref_cond` (우대사항 원문), `job_cd` (직종 코드) 컬럼 추가
- [ ] 우대사항 원문을 임베딩 텍스트에 포함해 pgvector upsert
- [ ] Airflow Variable `WORKNET_API_KEY` 추가 가이드 문서화
- [ ] pytest — worknet_client 단위 테스트 (mock API 응답 포함)
- [ ] `.ai.md` 최신화 (airflow/, siw/)

---

## 수집 범위

**엔드포인트**: `GET http://openapi.work.go.kr/opi/opi/opia/wantedApi.do`

**직종 코드 (`occupation` 파라미터)**:

| 코드 | 직종 |
|------|------|
| `0` | 경영·사무·금융·보험직 |
| `1` | 연구직·공학기술직 (IT 포함) |
| `2` | 교육·법률·사회복지·경찰·소방·군인 |
| `4` | 예술·디자인·방송·스포츠직 |
| `60` | 영업·판매직 (운전·운송 제외) |
| `7` | 건설·채굴직 |

**호출 2단계**:
1. `callTp=L` 목록 조회 → `wantedAuthNo` 수집 (페이지당 100건, startPage 순회)
2. `callTp=D` 상세 조회 → `prefCond`(우대사항) 포함 전체 필드 수집

---

## 구현 계획

### Step 1 — 스키마 마이그레이션

**파일**: `services/siw/airflow/sql/006_add_worknet_columns.sql` (신규)

```sql
ALTER TABLE job_posting_embeddings
  ADD COLUMN IF NOT EXISTS pref_cond TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS job_cd   VARCHAR(10) DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_jpe_job_cd ON job_posting_embeddings (job_cd);
```

**검증**:
- `\d job_posting_embeddings`로 2개 컬럼 존재 확인
- 기존 잡코리아 행의 pref_cond, job_cd 값이 DEFAULT('')로 유지되는지 확인

---

### Step 2 — 워크넷 API 클라이언트

**파일**: `services/siw/airflow/dags/worknet_client.py` (신규)

**설계 원칙**:
- 목록 조회(`fetch_list`)와 상세 조회(`fetch_detail`)를 분리
- Rate limit: `WORKNET_RATE_LIMIT_SEC` Airflow Variable, 기본 1.0초
- XML 응답 파싱 (returnType=JSON은 버전별 지원 불안정)

**클래스 구조**:

```python
OCCUPATION_CODES = ["0", "1", "2", "4", "60", "7"]

@dataclass
class WorknetListItem:
    wanted_auth_no: str   # 상세조회 키
    company: str
    title: str
    job_cd: str           # jobsCd
    source_url: str       # wantedInfoUrl
    close_dt: str

@dataclass
class WorknetDetail:
    wanted_auth_no: str
    company: str
    title: str
    job_cd: str
    source_url: str
    pref_cond: str        # prefCond (우대사항 원문)
    job_content: str      # 직무내용
    region: str
    sal: str
    career: str
    education: str

class WorknetClient:
    BASE_URL = "http://openapi.work.go.kr/opi/opi/opia/wantedApi.do"

    def __init__(self, api_key: str | None = None, rate_limit_sec: float | None = None):
        # api_key: Airflow Variable WORKNET_API_KEY 자동 주입
        # rate_limit_sec: Airflow Variable WORKNET_RATE_LIMIT_SEC, 기본 1.0

    def fetch_list(self, occupation: str, page: int = 1, display: int = 100) -> tuple[list[WorknetListItem], int]:
        # callTp=L 호출
        # returns: (items, total_count)

    def fetch_all_list(self, occupation_codes: list[str] = OCCUPATION_CODES) -> list[WorknetListItem]:
        # 코드별 전체 페이지 순회
        # 각 코드마다 fetch_list 반복, total_count 기준 페이지 계산

    def fetch_detail(self, wanted_auth_no: str) -> WorknetDetail:
        # callTp=D 호출 (prefCond 포함)

    def fetch_details_batch(self, items: list[WorknetListItem]) -> list[WorknetDetail]:
        # items 순회하며 fetch_detail 호출, rate limit 적용
        # 에러 발생 시 해당 항목 skip + 로깅

    def _throttle(self) -> None:
        # elapsed 기반 정확한 sleep

    def _parse_list_xml(self, xml_text: str) -> tuple[list[WorknetListItem], int]:

    def _parse_detail_xml(self, xml_text: str) -> WorknetDetail:
```

**검증**:
- `test_worknet_client.py` pytest 통과
- `fetch_all_list()` 빈 응답 시 빈 리스트 반환 확인

---

### Step 3 — job_crawl_dag.py 교체 (워크넷 전용)

**파일**: `services/siw/airflow/dags/job_crawl_dag.py` (전면 교체)

**DAG 스케줄**: `0 12 * * 0` (매주 일요일 12:00)

**선형 태스크 체인**:

```
crawl_list → crawl_details → embed_postings → upsert_vectors → log_summary
```

**각 태스크 설명**:

```python
# crawl_list
# WorknetClient.fetch_all_list(OCCUPATION_CODES) 호출
# 결과를 S3에 저장: s3://bucket/job-crawl/{ds}/worknet/list.jsonl
# XCom push: list_s3_key

# crawl_details
# XCom pull: list_s3_key
# S3에서 list.jsonl 로드 → WorknetClient.fetch_details_batch() 호출
# 결과를 S3에 저장: s3://bucket/job-crawl/{ds}/worknet/details.jsonl
# XCom push: details_s3_key
# content 구성: f"{title} {job_content} {pref_cond}"

# embed_postings
# XCom pull: details_s3_key
# 엔진 /api/embed 배치 호출 (불변식: 직접 LLM 호출 금지)
# 결과를 S3에 저장: s3://bucket/job-crawl/{ds}/worknet/embedded.jsonl
# XCom push: embedded_s3_key

# upsert_vectors
# XCom pull: embedded_s3_key
# pgvector INSERT ... ON CONFLICT (source_url, job_role) DO UPDATE SET
#   title, company, content, embedding, pref_cond, job_cd, crawled_at
# XCom push: upserted_count

# log_summary
# XCom pull: upserted_count
# 수집 건수, 직종별 분포 로깅
```

**검증**:
- DAG 파싱 에러 없음: `python -c "from job_crawl_dag import dag; print(dag.schedule_interval)"`
- 기존 테스트 파일 업데이트 (잡코리아 테스트 제거, 워크넷 테스트 추가)

---

### Step 4 — 테스트

**파일**: `services/siw/airflow/tests/test_worknet_client.py` (신규)

**테스트 케이스**:

```python
class TestWorknetClient:
    def test_fetch_list_parses_xml(self):
        # 정상 XML 응답 → WorknetListItem 리스트 + total_count 파싱

    def test_fetch_list_empty_response(self):
        # 빈 응답 → ([], 0) 반환

    def test_fetch_all_list_paginates(self):
        # total=250 → 3페이지 호출 (100, 100, 50)

    def test_fetch_detail_extracts_pref_cond(self):
        # 상세 XML → WorknetDetail.pref_cond 추출 검증

    def test_fetch_details_batch_skips_errors(self):
        # 첫 번째 항목 HTTP 500 → skip, 나머지 처리 계속

    def test_rate_limit_between_calls(self):
        # 연속 호출 간 최소 rate_limit_sec 간격 검증

    def test_api_key_in_request_params(self):
        # 모든 요청에 authKey 파라미터 포함 확인
```

**파일**: `services/siw/airflow/tests/test_job_crawl_dag.py` (수정)
- 잡코리아 관련 테스트 제거
- 워크넷 DAG 스케줄 `0 12 * * 0` 확인 테스트 추가
- content 구성에 pref_cond 포함 검증 테스트 추가

---

### Step 5 — 문서화

**파일**: `services/siw/airflow/.ai.md` (수정)
- worknet_client.py 설명 추가
- 수집 직종 코드 목록 (0, 1, 2, 4, 60, 7)
- `WORKNET_API_KEY` Airflow Variable 설정 가이드:
  - 발급: https://www.data.go.kr → "워크넷 채용정보" 검색 → 활용신청
  - 등록: Airflow Admin → Variables → `WORKNET_API_KEY` 값 입력
  - 선택: `WORKNET_RATE_LIMIT_SEC` (기본 1.0초)
- S3 키 경로: `job-crawl/{ds}/worknet/{list|details|embedded}.jsonl`

**파일**: `services/siw/.ai.md` (수정)
- `job_posting_embeddings` 스키마 변경 (pref_cond, job_cd 컬럼 추가)
- 워크넷 전용 파이프라인으로 전환 내역

---

## 배포 순서

```
1. 006_add_worknet_columns.sql 실행 (컬럼 추가, 비파괴)
2. worknet_client.py 배포
3. job_crawl_dag.py 교체 배포
4. Airflow Variable WORKNET_API_KEY 등록
5. 수동 DAG 트리거로 첫 수집 검증
```

---

## ADR

**Decision**: 잡코리아 드롭, 워크넷 단독 운영

**Why**:
- 잡코리아 공고 상당수가 이미지 형식 → OCR 없이 pref_cond 수집 불가
- 워크넷은 정부 공식 API → 구조화된 텍스트, prefCond 필드 직접 제공
- OCR 추가보다 워크넷 단독으로 먼저 검증 후 필요 시 잡코리아 OCR 별도 이슈 처리

**Consequences**:
- 공고 수가 순수 민간 공고보다 적을 수 있음 (공공기관 비중 높음)
- 향후 잡코리아 OCR 이슈는 별도 분기로 처리
