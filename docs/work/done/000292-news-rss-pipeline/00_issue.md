# feat: [seung][DE] 뉴스 RSS 기반 직군별 업계 동향 수집 파이프라인

## 사용자 관점 목표

면접 시 \"최근 업계 동향\"에 관한 질문에 최신 컨텍스트가 반영되어 더 현실적인 면접 연습이 가능하다.

## 배경

현재 seung은 자소서 텍스트만으로 면접 질문을 생성한다. 업계 최신 트렌드나 이슈가 반영되지 않아 실제 면접과 괴리가 있다. 뉴스 RSS 피드(공개 배포 데이터, 법적 문제 없음)를 통해 직군별 최신 이슈를 주기적으로 수집하고 면접 질문 생성 컨텍스트에 주입한다.

siw의 채용공고 파이프라인과 달리 이 파이프라인은 업계 뉴스를 수집하며 전 직군을 커버한다.

## 완료 기준

- [x] 직군별 키워드 맵 정의 (IT/개발, 마케팅, 금융, 의료, 영업, 회계/재무, 인사/HR)
- [x] Airflow DAG: 일 1회 RSS 수집 — `crawl_rss → filter_by_role → deduplicate → load_to_s3 → upsert_db`
- [x] 증분 처리 — `last_published_at` 기준 신규 기사만 처리
- [x] S3 Raw Zone 적재 (`news/YYYY/MM/DD/`)
- [x] DB에 직군별 최신 뉴스 저장 (상위 N건 유지)
- [x] 면접 질문 생성 시 `targetRole` 기반 뉴스 컨텍스트 주입
- [x] `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 DAG graceful skip, 뉴스 컨텍스트 없이 기존 동작 유지
- [x] 테스트: 중복 제거 및 증분 처리 로직 검증

## 구현 플랜

### Step 1 — 직군별 RSS 피드 및 키워드 맵 정의
```python
ROLE_FEED_MAP = {
    "IT/개발": ["https://feeds.feedburner.com/...", ...],
    "마케팅": [...],
    "금융": [...],
}
```

### Step 2 — Airflow DAG
- `services/seung/airflow/dags/seung_news_dag.py`
- 스케줄: 매일 UTC 00:00 (KST 09:00)
- 중복 제거: URL 해시 기반

### Step 3 — 컨텍스트 주입
- `interview/start/route.ts` — 세션 시작 시 targetRole 기반 뉴스 조회
- 엔진에 `news_context` 필드로 전달

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (뉴스 컨텍스트 없어도 면접 기본 동작 유지)

---

## 작업 내역

### 신규 파일

- **`services/seung/airflow/dags/seung_news_dag.py`** — 5-task DAG 구현 (crawl_rss → filter_by_role → deduplicate → load_to_s3 → upsert_db). 스케줄 UTC 00:00(KST 09:00). SEUNG_S3_ANALYTICS_BUCKET 미설정 시 AirflowSkipException으로 graceful skip. 증분 처리는 role별 MAX(publishedAt)를 DB에서 조회해 기준값으로 사용. upsert_db는 trigger_rule='all_done'으로 load_to_s3 실패 시에도 실행됨.
- **`services/seung/airflow/tests/test_seung_news_dag.py`** — TDD. 9개 단위 테스트: TestDeduplicate(3) + TestFilterByRole(2) + TestCrawlRssIncremental(2) + TestUpsertDb(2).
- **`services/seung/prisma/migrations/20260330000000_add_news_article/migration.sql`** — NewsArticle 테이블 DDL + url UNIQUE 인덱스 + role 인덱스. Supabase SQL Editor에서 수동 적용.

### 수정 파일

- **`services/seung/prisma/schema.prisma`** — NewsArticle 모델 추가 (id, role, title, url@unique, summary?, publishedAt, createdAt, @@index([role])).
- **`services/seung/airflow/requirements.txt`** — feedparser>=6.0.0,<7.0.0 추가.
- **`services/seung/airflow/tests/conftest.py`** — feedparser, psycopg2.extras sys.modules mock 추가.
- **`services/seung/airflow/.ai.md`** — seung_news_dag 목적·구조·Variables 섹션 최신화. SQLite 기술부채 4번째 DAG 반영.
- **`services/seung/src/app/api/interview/start/route.ts`** — ROLE_CATEGORY_MAP, resolveNewsRole() 추가. targetRole → newsRole 매핑 후 NewsArticle 조회(5건). newsContext가 있으면 resumeText 앞에 `[최근 업계 동향]` 블록 append하여 엔진 전달(엔진 수정 없음).
- **`services/seung/src/app/resume/page.tsx`** — handleStartInterview 호출 시 targetRole state를 body에 포함.

### 주요 설계 결정

- **엔진 수정 없음**: news_context 필드를 엔진 스키마에 추가하는 대신 resumeText 앞에 뉴스 블록을 append하는 방식 채택. 아키텍처 불변식(외부 AI 호출은 엔진에서만) 준수.
- **S3 버킷 재사용**: 기존 SEUNG_S3_ANALYTICS_BUCKET에 news/ prefix 추가. 별도 버킷/Variable 불필요.
- **직군 7개**: 이슈 AC 5개 + 한국 채용시장 상위 2개(회계/재무, 인사/HR) 추가.
- **RSS URL 검증**: 초기 후보 3개(zdnet.co.kr/rss/news/, medicaltimes.com/rss/S1N1.xml, businesspost.co.kr/rss/allnews.xml) 404 확인 후 대체 URL로 교체.

