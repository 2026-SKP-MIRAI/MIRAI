# [#292] feat: [seung][DE] 뉴스 RSS 기반 직군별 업계 동향 수집 파이프라인 — 구현 계획

> 작성: 2026-03-30

---

## 완료 기준

- [x] 직군별 키워드 맵 정의 (IT/개발, 마케팅, 금융, 의료, 영업, 회계/재무, 인사/HR)
- [x] Airflow DAG: 일 1회 RSS 수집 — `crawl_rss → filter_by_role → deduplicate → load_to_s3 → upsert_db`
- [x] 증분 처리 — `last_published_at` 기준 신규 기사만 처리
- [x] S3 Raw Zone 적재 (`news/YYYY/MM/DD/`)
- [x] DB에 직군별 최신 뉴스 저장 (상위 N건 유지)
- [x] 면접 질문 생성 시 `targetRole` 기반 뉴스 컨텍스트 주입
- [x] `SEUNG_S3_ANALYTICS_BUCKET` 미설정 시 DAG graceful skip, 뉴스 컨텍스트 없이 기존 동작 유지
- [x] 테스트: 중복 제거 및 증분 처리 로직 검증
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (뉴스 컨텍스트 없어도 면접 기본 동작 유지)

---

## 구현 계획

### 전체 흐름

```
[Airflow DAG - 매일 KST 09:00]
crawl_rss → filter_by_role → deduplicate → load_to_s3 → upsert_db
                                                              ↓
                                              seung DB: NewsArticle 테이블

[면접 시작 요청]
interview/start/route.ts
  → DB에서 targetRole 기반 최신 뉴스 N건 조회
  → engine /api/interview/start 호출 (news_context 포함)
  → 면접 질문 생성 시 뉴스 컨텍스트 반영
```

---

### Step 1 — DB 마이그레이션: NewsArticle 테이블

**변경 파일:**
- `services/seung/prisma/schema.prisma`
- `services/seung/prisma/migrations/` (새 migration 파일)

**내용:**

`schema.prisma`에 아래 모델 추가:

```prisma
model NewsArticle {
  id          Int      @id @default(autoincrement())
  role        String                // 직군 (예: "IT/개발", "마케팅")
  title       String
  url         String   @unique
  summary     String?               // 기사 요약 (있으면)
  publishedAt DateTime
  createdAt   DateTime @default(now())
}
```

- `url` UNIQUE → DB 레벨 중복 제거 보장
- `publishedAt` → 증분 처리 기준값 (`MAX(publishedAt) WHERE role = ?`)
- 상위 N건 유지: `upsert_db` task에서 role별 `publishedAt` 기준 상위 30건 초과 시 오래된 것 DELETE

migration 생성:
```bash
cd services/seung && npx prisma migrate dev --name add_news_article
```

---

### Step 2 — Airflow DAG: `seung_news_dag.py`

**변경 파일:**
- `services/seung/airflow/dags/seung_news_dag.py` (신규)
- `services/seung/airflow/requirements.txt` (feedparser 추가)

**스케줄:** `0 0 * * *` (UTC 00:00 = KST 09:00)

**필요 Airflow Variables:**
- `S3_NEWS_BUCKET` — 미설정 시 `crawl_rss`에서 `AirflowSkipException` (graceful skip)
- `SEUNG_DATABASE_URL` — upsert_db 쓰기용

**ROLE_FEED_MAP 구조:**

```python
ROLE_FEED_MAP = {
    "IT/개발":  [<RSS_URL_1>, <RSS_URL_2>, ...],
    "마케팅":   [<RSS_URL_1>, ...],
    "금융":     [<RSS_URL_1>, ...],
    "의료":     [<RSS_URL_1>, ...],
    "영업":     [<RSS_URL_1>, ...],
}
```

실제 RSS URL은 각 직군별 공개 국내 뉴스 피드(ZDNet, Bloter, 한경, 매경 등)에서 확인 후 기재.

**ROLE_KEYWORD_MAP 구조 (필터링용):**

```python
ROLE_KEYWORD_MAP = {
    "IT/개발":  ["AI", "클라우드", "개발자", "스타트업", "반도체", ...],
    "마케팅":   ["마케팅", "광고", "브랜드", "캠페인", ...],
    "금융":     ["금융", "은행", "투자", "주식", "펀드", ...],
    "의료":     ["의료", "병원", "헬스케어", "제약", ...],
    "영업":     ["영업", "세일즈", "거래처", "매출", ...],
}
```

**Task 구조:**

```
crawl_rss
  → 각 role의 RSS 피드를 feedparser로 파싱
  → DB에서 role별 MAX(publishedAt) 조회 → 이후 기사만 수집 (증분)
  → XCom: {role: [{title, url, summary, publishedAt}, ...]}

filter_by_role
  → ROLE_KEYWORD_MAP으로 제목/요약에 키워드 포함 여부 필터링
  → XCom: 필터 통과한 기사 목록

deduplicate
  → url 기반 중복 제거 (같은 DAG 실행 내 중복 URL 제거)
  → XCom: 최종 기사 목록

load_to_s3
  → S3_NEWS_BUCKET Variable 확인 (없으면 skip)
  → `news/YYYY/MM/DD/{role}.jsonl` 형태로 S3 Raw Zone 적재
  → boto3 (EC2 IAM Instance Role)

upsert_db
  → SEUNG_DATABASE_URL로 psycopg2 직접 접근
  → INSERT INTO "NewsArticle" ... ON CONFLICT (url) DO NOTHING
  → role별 상위 30건 초과 시 오래된 것 DELETE
```

**requirements.txt에 추가:**
```
feedparser>=6.0.0,<7.0.0
```

**주의사항:**
- `feedparser`는 네트워크 I/O → timeout 설정 필수 (각 피드 10s)
- `publishedAt` 파싱: `feedparser`의 `entry.published_parsed` → `datetime` 변환
  - `published_parsed` 없는 entry는 현재 시각으로 fallback
- S3 적재와 DB upsert는 순서 의존성 없음 (둘 다 deduplicate 다음)
  → 실제 구현에서는 load_to_s3 >> upsert_db 순서 유지 (S3가 raw 보관 목적)

---

### Step 3 — 뉴스 컨텍스트 주입 (서비스 레이어, 엔진 수정 없음)

> ⚠️ **계획 변경**: 초안은 엔진(`schemas.py`, `interview_service.py`, `routers/interview.py`)에 `news_context` 필드를 추가하는 방식이었으나, 아키텍처 불변식 준수를 위해 **엔진 수정 없이** `services/seung` 레이어에서 처리하는 방식으로 변경했다.

**실제 구현 방식:**

`resumeText` 앞에 뉴스 블록을 append하여 엔진에 전달 — 엔진 API 계약 변경 없음.

```typescript
// services/seung/src/app/api/interview/start/route.ts
body: JSON.stringify({
  resumeText: newsContext.length > 0
    ? `[최근 업계 동향]\n${newsContext.map(n => `- ${n}`).join('\n')}\n\n${resume.resumeText}`
    : resume.resumeText,
  personas,
  mode: 'panel',
})
```

**변경 파일:**
- `services/seung/src/app/api/interview/start/route.ts` — `ROLE_CATEGORY_MAP`, `resolveNewsRole()`, 뉴스 조회, resumeText append
- `services/seung/src/app/resume/page.tsx` — `targetRole` 프론트엔드에서 body로 전달

---

### Step 4 — seung `interview/start` 라우트 수정

**변경 파일:**
- `services/seung/src/app/api/interview/start/route.ts`

**흐름:**

1. 기존과 동일하게 `resumeId`로 Resume 조회
2. `diagnosisResult` JSON에서 `targetRole` 추출 (없으면 `null`)
3. `targetRole`이 있으면 DB에서 최신 뉴스 5건 조회:
   ```ts
   const news = targetRole
     ? await prisma.newsArticle.findMany({
         where: { role: { contains: targetRole } },
         orderBy: { publishedAt: 'desc' },
         take: 5,
         select: { title: true },
       })
     : []
   const newsContext = news.map(n => n.title)
   ```
4. 엔진 호출 body에 `news_context` 추가:
   ```ts
   body: JSON.stringify({
     resumeText: resume.resumeText,
     personas,
     mode: 'panel',
     ...(newsContext.length > 0 ? { news_context: newsContext } : {}),
   })
   ```

**불변식 준수:**
- `newsContext`가 빈 배열이면 `news_context` 필드 자체를 제외 → 엔진 기존 동작 그대로
- DB 조회 실패 시 `try/catch`로 감싸고 `newsContext = []`로 fallback (면접 세션 생성 차단 금지)

**`targetRole` 추출 전략:**
- `diagnosisResult`가 `{ targetRole: string, ... }` 구조임을 가정
- 없거나 파싱 실패 시 `null`로 처리 (컨텍스트 없이 진행)

---

### Step 5 — 테스트

**변경 파일:**
- `services/seung/airflow/tests/test_seung_news_dag.py` (신규)

**테스트 케이스:**

```python
# 1. 중복 제거 로직
def test_deduplicate_removes_duplicate_urls():
    # 같은 URL이 2번 등장 → 1건만 남아야 함

# 2. 증분 처리 로직
def test_crawl_rss_filters_by_last_published_at():
    # last_published_at = T, 새 기사 published_at = T+1h → 포함
    # 오래된 기사 published_at = T-1h → 제외

# 3. S3_NEWS_BUCKET 미설정 시 skip
def test_crawl_rss_skips_when_no_s3_bucket(monkeypatch):
    # Variable.get("S3_NEWS_BUCKET") → KeyError → AirflowSkipException

# 4. 키워드 필터링
def test_filter_by_role_keeps_matching_articles():
    # "AI 스타트업 투자 유치" → IT/개발 키워드 포함 → 통과
    # "야구 경기 결과" → 어떤 직군 키워드도 없음 → 제외
```

기존 conftest.py 패턴 (`seung/airflow/tests/conftest.py`) 참고해서 작성.

---

### Step 6 — .ai.md 최신화

**변경 파일:**
- `services/seung/airflow/.ai.md`
  - `seung_news_dag.py` 항목 추가 (목적, 스케줄, 필요 Variables)
  - `S3_NEWS_BUCKET` Variable 섹션 추가
  - SQLite 기술부채 섹션: 4번째 DAG 추가로 전환 트리거 조건 재평가 기재
- `engine/.ai.md`
  - `/api/interview/start` 엔드포인트 계약에 `news_context` 옵션 필드 추가 기재

---

### 구현 순서 (의존성 기준)

```
1. DB 마이그레이션 (Step 1)          ← 독립
2. Airflow DAG (Step 2)              ← Step 1 완료 후 (NewsArticle 테이블 필요)
3. 엔진 수정 (Step 3)                ← 독립 (인터페이스 확장)
4. seung 라우트 수정 (Step 4)        ← Step 1, 3 완료 후
5. 테스트 작성 (Step 5)              ← Step 2 완료 후
6. .ai.md 최신화 (Step 6)            ← 전체 완료 후
```

---

### 엣지 케이스 & 주의사항

| 케이스 | 처리 방식 |
|--------|-----------|
| RSS 피드 URL 응답 없음 (timeout/오류) | 해당 피드 skip, 나머지 피드 계속 처리. 로그만 남김 |
| `published_parsed` 없는 entry | `datetime.utcnow()` fallback |
| `diagnosisResult`에 targetRole 없음 | `newsContext = []` → 엔진에 news_context 미전달 |
| DB 뉴스 조회 실패 | try/catch → `newsContext = []` fallback, 면접 진행 차단 금지 |
| 같은 날 DAG 재실행 | `url` UNIQUE → ON CONFLICT DO NOTHING으로 idempotent 보장 |
| 특정 직군 뉴스 0건 | upsert_db에서 0건이면 DELETE 단계 skip |
| feedparser `bozo=True` (비표준 RSS) | 경고 로그만, 파싱 가능한 entry는 처리 |

---

### 아키텍처 불변식 준수 확인

| 불변식 | 검토 결과 |
|--------|-----------|
| 1. 인증은 서비스에서만 | ✅ 엔진에 인증 로직 없음 |
| 2. 외부 AI API 호출은 엔진에서만 | ✅ 서비스는 엔진을 호출, LLM 직접 호출 없음 |
| 3. 서비스 간 직접 통신 금지 | ✅ |
| 4. DB는 서비스가 소유 (DAG 예외) | ✅ DAG는 기존 예외 패턴(psycopg2 직접 접근) 유지. seung_news_dag도 동일 기준 적용 |
| 5. 테스트 없는 PR 머지 금지 | ✅ Step 5 테스트 포함 |
