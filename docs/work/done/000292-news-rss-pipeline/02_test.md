# [#292] feat: [seung][DE] 뉴스 RSS 기반 직군별 업계 동향 수집 파이프라인 — 테스트 결과

> 작성: 2026-03-30

---

## 최종 테스트 결과

### pytest 단위 테스트 (services/seung/airflow/tests/test_seung_news_dag.py)

```
9 passed in 0.06s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/test_seung_news_dag.py` | 9 | ✅ 전체 통과 | TestDeduplicate 3개 + TestFilterByRole 2개 + TestCrawlRssIncremental 2개 + TestUpsertDb 2개 |

### 기존 테스트 회귀 확인

```
29 passed in 0.19s
```

| 범위 | 결과 | 비고 |
|------|------|------|
| `tests/test_seung_analytics_dag.py` | ✅ 회귀 없음 | 변경 없음 |
| `tests/test_seung_event_dag.py` | ✅ 회귀 없음 | 변경 없음 |
| `tests/test_seung_resume_embed_dag.py` | ✅ 회귀 없음 | 변경 없음 |
| `tests/test_seung_news_dag.py` (신규) | ✅ 9/9 통과 | — |

### RSS 피드 URL 검증 (수동)

```
python -c "import urllib.request; ..." 으로 실제 HTTP 응답 확인
```

| 직군 | URL | 결과 |
|------|-----|------|
| IT/개발 | `feeds.feedburner.com/zdnet/` | ✅ 200 |
| IT/개발 | `www.etnews.com/rss/section005.xml` | ✅ 200 |
| 마케팅 | `www.mk.co.kr/rss/30100041/` | ✅ 200 |
| 금융 | `www.hankyung.com/feed/finance` | ✅ 200 |
| 금융 | `www.mk.co.kr/rss/30200030/` | ✅ 200 |
| 의료 | `www.bosa.co.kr/rss/allArticle.xml` | ✅ 200 |
| 영업 | `www.businesspost.co.kr/BP?command=rss` | ✅ 200 |
| 영업 | `www.sedaily.com/RSS/` | ✅ 200 |
| 회계/재무 | `www.edaily.co.kr/rss/economy.xml` | ✅ 200 |
| 회계/재무 | `www.hankyung.com/feed/economy` | ✅ 200 |
| 인사/HR | `www.mk.co.kr/rss/30100046/` | ✅ 200 |
| 인사/HR | `www.econovill.com/rss/allArticle.xml` | ✅ 200 |

> 초기 후보 중 3개(zdnet.co.kr/rss/news/, medicaltimes.com/rss/S1N1.xml, businesspost.co.kr/rss/allnews.xml)가 404 반환 → 대체 URL로 교체.

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
| `services/seung/prisma/migrations/20260330000000_add_news_article/migration.sql` | NewsArticle 테이블 DDL + url unique index | ✅ |
| `services/seung/airflow/dags/seung_news_dag.py` | crawl_rss → filter_by_role → deduplicate → load_to_s3 → upsert_db DAG (UTC 00:00) | ✅ |
| `services/seung/airflow/tests/test_seung_news_dag.py` | 단위 테스트 9개 (dedup, filter, 증분 처리, upsert_db) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `services/seung/prisma/schema.prisma` | `NewsArticle` 모델 추가 | ✅ |
| `services/seung/airflow/requirements.txt` | `feedparser>=6.0.0,<7.0.0` 추가 | ✅ |
| `services/seung/airflow/tests/conftest.py` | `feedparser`, `psycopg2.extras` sys.modules mock 추가 | ✅ |
| `services/seung/src/app/api/interview/start/route.ts` | `targetRole` 파라미터, `ROLE_CATEGORY_MAP`, `resolveNewsRole`, 뉴스 조회 + `resumeText` 앞에 뉴스 블록 append (엔진 수정 없음) | ✅ |
| `services/seung/airflow/.ai.md` | seung_news_dag 목적·구조·Variables 섹션 최신화, SQLite 기술부채 4번째 DAG 반영 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `test_seung_news_dag.py` 9개 작성 → `seung_news_dag.py` 구현 → 9/9 통과
- 기존 테스트 20개 회귀 없음 (29 passed 전체)

---

## 주요 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| S3 버킷 | `SEUNG_S3_ANALYTICS_BUCKET` 재사용 (`news/` prefix) | 기존 #291, analytics DAG 패턴과 일치. 별도 버킷·Variable 불필요 |
| graceful skip 기준 | `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 `crawl_rss`에서 skip | 기존 DAG 패턴 동일. 뉴스 없어도 면접 기본 동작 유지 |
| targetRole → role 매핑 | `ROLE_CATEGORY_MAP` 키워드 매핑 (route.ts) | `diagnosisResult`에 targetRole 미저장. 프론트엔드가 body로 전달하는 자유형식 텍스트를 7개 카테고리로 변환 |
| news_context 주입 방식 | `resumeText` 앞에 `[최근 업계 동향]` 블록 append (seung 서비스 내) | 엔진 코드 수정 없음. `newsContext` 빈 배열이면 원본 `resumeText` 그대로 전달 |
| 직군 수 | 7개 (IT/개발, 마케팅, 금융, 의료, 영업, 회계/재무, 인사/HR) | 이슈 AC 5개 + 한국 채용 시장 채용량 기준 상위 2개 추가 |
| 상위 N건 유지 | role별 30건 초과 시 `publishedAt` 오래된 것 DELETE | DB 무한 증가 방지 |
| 배포 전 필수 작업 | Supabase SQL Editor에서 migration.sql 실행 | `NewsArticle` 테이블 미생성 시 `upsert_db` 에러 |
