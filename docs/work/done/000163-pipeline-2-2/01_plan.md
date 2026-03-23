# [#163] feat: [siw][DE] Pipeline 2-2 — 잡코리아 크롤링·pgvector·RAG Trends API 활성화 — 구현 계획

> 작성: 2026-03-23

---

## 완료 기준

- [x] Supabase pgvector extension 활성화 + `job_posting_embeddings` 테이블 신규 (`jobRole`, `title`, `company`, `content`, `embedding vector(1024)`, `sourceUrl`, `crawledAt`)
- [x] Airflow `job_crawl_dag` 주간 실행 — 잡코리아 전 직무 대분류 채용공고 크롤링 (Rate limit 1초, robots.txt 준수) — 공고 텍스트 → 엔진 `POST /api/embed` 호출 (배치) → pgvector upsert — 스케줄: 매주 일요일 UTC 15:00
- [x] Trends API RAG 로직 구현 — `src/lib/rag/vector-search.ts` 신규 (pgvector cosine similarity search) — `ENABLE_RAG=true` 시 role 임베딩 → pgvector 검색 → TOP 역량 반환
- [x] trendComparison RAG 기반 실제 비교 로직 구현 — 자소서 임베딩 ↔ 채용공고 pgvector 검색 → 부족 역량 추출
- [x] vitest (vector-search, RAG trends) + pytest (job_crawl_dag)
- [x] `ENABLE_RAG=true` 배포 환경변수 설정 + `.ai.md` 최신화 (`.env.example`에 문서화, 배포 시 수동 설정)

---

## 구현 계획

### RALPLAN-DR 요약

**Principles (원칙)**

1. **아키텍처 불변식 준수** — 외부 AI API(임베딩) 호출은 반드시 엔진 경유. 벡터 DB 검색은 서비스 소유 DB이므로 서비스에서 직접 수행.
2. **Feature Flag 안전성** — `ENABLE_RAG=false`이면 기존 동작 100% 유지. 새 코드가 기존 경로에 side-effect 없음.
3. **XCom 경량화** — Airflow XCom에 대용량 텍스트 직접 전달 금지. S3 key 경유 패턴 유지.
4. **robots.txt 준수 + Rate limit** — 잡코리아 크롤링 시 1초 간격, 허용된 경로만 접근.
5. **테스트 선행** — TDD: 테스트 먼저 작성 후 구현. 테스트 없는 PR 머지 금지.

**Decision Drivers (핵심 결정 요인)**

1. **벡터 차원: 1024 (768 아님)** — 엔진 `embedding_service.py`가 `baai/bge-m3` 모델로 1024차원 벡터를 반환하며, `len(emb) != 1024` 검증이 하드코딩되어 있음 (29행). 이슈 `00_issue.md`의 `vector(768)` 기재는 오류이므로 모든 문서에서 `vector(1024)`로 통일.
2. **Prisma + pgvector 통합 방식** — Prisma는 pgvector `vector` 타입을 네이티브 지원하지 않으므로 `Unsupported("vector(1024)")` + `$queryRaw` (tagged template literal) 조합.
3. **embedding 검색 경로: 서비스 직접 pgvector 쿼리** — 아래 ADR 참조.

**Viable Options**

| | Option A: 서비스 직접 pgvector 쿼리 (채택) | Option B: 엔진 /api/rag/trends 경유 |
|---|---|---|
| 설명 | 서비스가 Prisma `$queryRaw`로 pgvector 직접 검색 | 엔진에 /api/rag/trends 엔드포인트 신설, 서비스가 호출 |
| Pros | DB는 서비스 소유 원칙 준수, 레이턴시 낮음, 엔진 stateless 유지 | 엔진 중앙 집중으로 로직 재사용 가능 |
| Cons | 벡터 검색 로직이 서비스에 위치 | 엔진에 DB 커넥션 필요 (불변식 3, 4 위반), stateless 원칙 훼손 |

**결정: Option A** — 불변식 "엔진은 stateless, DB는 서비스 소유"에 부합. "임베딩 생성(AI API) = 엔진 경유"와 "벡터 DB 검색 = 서비스 직접"으로 경계를 명확히 분리.

---

### Task Flow (의존 관계)

```
Step 0 (airflow 디렉토리 구조 보완)
    |
Step 1 (pgvector 스키마)
    |
    +-----> Step 2 (Airflow DAG)  [병렬 가능]
    |
    +-----> Step 3 (vector-search.ts)  [병렬 가능]
                |
                v
          Step 4 (RAG 로직 활성화)
                |
                v
          Step 5 (테스트 + 마무리)
```

- Step 0은 선행 작업 (디렉토리 구조 + .ai.md)
- Step 1은 Step 2, 3 모두의 선행 조건
- Step 2와 Step 3은 병렬 진행 가능
- Step 4는 Step 3 완료 후 진행
- Step 5는 전체 완료 후 통합 검증

---

### 사용자 수동 설정 항목 (코드 배포 전 필수)

> ⚠️ 아래 항목은 코드로 자동화할 수 없으며, 개발자가 직접 설정해야 합니다.

**0. RAG 전용 공용 Supabase 신규 생성 (팀 공유)**

> 개인 Supabase(DATABASE_URL)는 사용자 데이터용, 공용 Supabase는 RAG 벡터 데이터용으로 완전 분리합니다.

- Supabase Dashboard에서 새 프로젝트 생성 (예: `mirai-rag`)
- 팀원 전체가 동일한 프로젝트를 공유 (read/write 권한)
- SQL Editor에서 pgvector extension 활성화:
  ```sql
  CREATE EXTENSION IF NOT EXISTS vector;
  ```
- `airflow/sql/003_enable_pgvector.sql` 실행 (`job_posting_embeddings` 테이블 생성)
- `airflow/sql/004_accepted_resumes.sql` 실행 (`accepted_resume_embeddings` 테이블 생성 — #198 pre-alignment)
- Connection String 복사 (Settings → Database → Connection String → URI)

**1. Next.js 서비스 환경변수 설정**
- `.env.local`에 추가:
  ```
  ENABLE_RAG=true
  RAG_DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
  ```
- `RAG_DATABASE_URL`: 공용 RAG Supabase connection string
- `DATABASE_URL`: 개인 Supabase connection string (기존 유지)

**2. Airflow Variables 설정**
- Airflow UI (Admin → Variables)에서 아래 값 설정:
  ```
  RAG_POSTGRES_CONN_ID = postgresql://[user]:[pass]@db.[rag-project].supabase.co:5432/postgres
  AWS_ACCESS_KEY_ID    = ...
  AWS_SECRET_ACCESS_KEY = ...
  S3_BUCKET_NAME       = mirai-[env]           # job-crawl/ prefix 사용
  ENGINE_BASE_URL      = https://[engine-host] # /api/embed 호출 대상
  ```
  - `RAG_POSTGRES_CONN_ID`: 공용 RAG Supabase (개인 DB가 아님)

**3. S3 버킷 확인 / 생성**
- `job-crawl/` prefix로 raw.jsonl, embedded.jsonl을 저장할 버킷 존재 확인
- 없으면 신규 생성 + Airflow IAM 사용자에 `s3:PutObject`, `s3:GetObject` 권한 부여

**4. 배포 환경변수 설정 (Vercel / Docker)**
- `services/siw` 배포 환경에 추가:
  ```
  ENABLE_RAG=true
  RAG_DATABASE_URL=...   # 공용 RAG Supabase
  ```

---

### Step 0 — airflow 디렉토리 구조 보완

**배경:** `services/siw/airflow/` 디렉토리는 이미 존재하며 `dags/`, `sql/`, `migrations/` 하위 디렉토리가 있으나, `tests/` 디렉토리가 없음. Step 2, 5에서 필요한 구조를 선행 구축.

**파일:**
- `services/siw/airflow/tests/__init__.py` (신규 — 빈 파일)
- `services/siw/airflow/tests/conftest.py` (신규)
- `services/siw/airflow/.ai.md` (수정 — tests 디렉토리 설명 추가)

**불변식 예외 명시:** Airflow 배치 파이프라인(`job_crawl_dag`)은 서비스 DB(`job_posting_embeddings`)에 직접 접근한다. 이는 "DB는 서비스가 소유" 원칙의 배치 파이프라인 확장으로, Airflow가 서비스의 인프라 구성 요소로서 서비스 DB에 쓰기 권한을 가진다.

**Acceptance Criteria:**
- [ ] `services/siw/airflow/tests/` 디렉토리 존재
- [ ] `airflow/.ai.md`에 tests 디렉토리 및 배치 파이프라인 DB 접근 원칙 기재

---

### Step 1 — pgvector 스키마 + 마이그레이션

**파일:**
- `services/siw/airflow/sql/003_enable_pgvector.sql` (신규)
- `services/siw/prisma/schema.prisma` (수정)

**1-1. DDL — `003_enable_pgvector.sql`:**

```sql
-- pgvector extension 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- job_posting_embeddings 테이블
CREATE TABLE IF NOT EXISTS job_posting_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role    TEXT NOT NULL,
  title       TEXT NOT NULL,
  company     TEXT NOT NULL,
  content     TEXT NOT NULL,
  embedding   vector(1024) NOT NULL,   -- baai/bge-m3 1024차원
  source_url  TEXT NOT NULL UNIQUE,     -- 중복 방지 (upsert 기준)
  crawled_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 검색 인덱스
CREATE INDEX IF NOT EXISTS idx_jpe_job_role ON job_posting_embeddings (job_role);
-- ⚠️ IVFFlat: 초기 적재 데이터가 1,000건 미만이면 인덱스 생성을 생략하고 나중에 REINDEX
-- lists=100은 ~100만 행 기준 최적값이며 소량 데이터에서는 오히려 성능 저하
-- 권장: 초기에는 lists=10 또는 인덱스 없이 seq scan, 1,000건 이상 적재 후 REINDEX
CREATE INDEX IF NOT EXISTS idx_jpe_embedding ON job_posting_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
```

**1-2. Prisma 모델 — `schema.prisma` 수정:**

```prisma
model JobPostingEmbedding {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobRole   String   @map("job_role")
  title     String
  company   String
  content   String
  embedding Unsupported("vector(1024)")
  sourceUrl String   @unique @map("source_url")
  crawledAt DateTime @default(now()) @map("crawled_at")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([jobRole])
  @@map("job_posting_embeddings")
}
```

**주의사항:**
- `source_url`에 UNIQUE 제약 추가 — Airflow upsert (`ON CONFLICT (source_url) DO UPDATE`)의 기준 키
- **IVFFlat `lists` 값**: 초기 적재량이 1,000건 미만이면 인덱스 생성을 미루고 seq scan 사용. 데이터가 1,000건 이상 쌓인 후 `DROP INDEX idx_jpe_embedding; CREATE INDEX ... WITH (lists = 10);`으로 재생성. 최종적으로 수만 건이 적재되면 `lists = 100`으로 업그레이드.
- Prisma `migrate dev`는 `Unsupported` 필드에 경고를 내므로, DDL은 SQL 파일로 별도 실행
- 벡터 차원은 반드시 **1024** (엔진 `embedding_service.py` 29행 `len(emb) != 1024` 검증과 일치)

**Acceptance Criteria:**
- [ ] `CREATE EXTENSION vector` 성공 (Supabase Dashboard 또는 SQL Editor에서 수동 확인)
- [ ] `job_posting_embeddings` 테이블에 `vector(1024)` 컬럼 존재 (수동/CI 확인)
- [ ] `source_url`에 UNIQUE 제약 존재 (수동/CI 확인)
- [ ] `schema.prisma`에 `JobPostingEmbedding` 모델 정의됨
- [ ] `idx_jpe_embedding` cosine 인덱스 생성됨 (수동 확인 — 단위 테스트 대상 아님)

---

### Step 2 — Airflow `job_crawl_dag`

**파일:**
- `services/siw/airflow/dags/job_crawl_dag.py` (신규)
- `services/siw/airflow/requirements.txt` (수정 — 아래 패키지 추가)

**requirements.txt 분리 (prod/dev):**

`airflow/requirements.txt` (프로덕션 — EC2 배포용):
```
boto3>=1.26.0
psycopg2-binary>=2.9.0
lxml>=4.9.0
pgvector>=0.2.0
```

`airflow/requirements-dev.txt` (테스트 전용):
```
-r requirements.txt
pytest>=7.0.0
pytest-mock>=3.0.0
moto[s3]>=4.0.0      # S3 mock (~50-80MB — 테스트만 필요)
```

> ⚠️ moto[s3]는 ~50-80MB로 EC2 용량을 낭비하므로 프로덕션 배포에서 제외.

**DAG 파이프라인 (4개 태스크):**

**2-1. `crawl_jobkorea(ds, **kwargs)`:**
- 잡코리아 대분류별 채용공고 크롤링
- 대상 URL: `/recruit/joblist` (목록), `/Recruit/GI_Read` (상세)
- 직무 대분류 리스트: 백엔드, 프론트엔드, 데이터, AI/ML, 인프라/DevOps 등
- robots.txt 준수: `urllib.robotparser.RobotFileParser`로 사전 검증 (`User-Agent: MirAI-Crawler/1.0`)
- Rate limit: `time.sleep(1)` 매 요청 사이
- 결과를 S3에 JSON Lines로 저장
  - S3 key 패턴: `job-crawl/{year}/{month}/{day}/raw.jsonl` (ds `"2026-03-23"` → `ds.replace("-", "/")` = `"2026/03/23"`)
  - 기존 `llm_quality_dag.py` S3 경로 패턴(`ds.replace("-", "/")`)과 통일
- XCom에 S3 key만 push
- 시그니처: `def crawl_jobkorea(ds: str, **kwargs) -> str` (반환: S3 key)

**2-2. `embed_postings(ds, **kwargs)`:**
- S3에서 크롤링 결과 읽기 (XCom에서 S3 key pull)
- 공고 텍스트를 배치(최대 100개)로 엔진 `POST /api/embed` 호출
  - 배치 청크 코드: `batches = [texts[i:i+100] for i in range(0, len(texts), 100)]`
- 임베딩 결과를 S3에 저장 (`job-crawl/{ds.replace("-", "/")}/embedded.jsonl`)
- `embedded.jsonl` 레코드 스키마 (upsert_vectors에서 파싱 기준):
  ```json
  {"job_role": "백엔드", "title": "...", "company": "...", "content": "...", "source_url": "https://...", "embedding": [0.012, -0.034, ...]}
  ```
- XCom에 S3 key만 push
- 시그니처: `def embed_postings(ds: str, **kwargs) -> str` (반환: S3 key)

**2-3. `upsert_vectors(ds, **kwargs)`:**
- S3에서 임베딩 결과 읽기
- `job_posting_embeddings` 테이블에 upsert:
  ```sql
  INSERT INTO job_posting_embeddings (job_role, title, company, content, embedding, source_url, crawled_at)
  VALUES (%s, %s, %s, %s, %s::vector, %s, %s)
  ON CONFLICT (source_url) DO UPDATE SET
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    crawled_at = EXCLUDED.crawled_at;
  ```
- **⚠️ 중요 — embedding 직렬화**: psycopg2 `%s::vector` 바인딩은 `list[float]`가 아닌 **문자열** `"[0.012,-0.034,...]"` 형식이어야 함. `pgvector` 패키지의 `Vector` 타입 또는 수동 직렬화 사용:
  ```python
  # 방법 1: pgvector 패키지 사용 (권장)
  from pgvector.psycopg2 import register_vector
  register_vector(conn)
  # → embedding을 list[float]로 전달 가능

  # 방법 2: 수동 직렬화 (pgvector 없을 때)
  embedding_str = "[" + ",".join(str(x) for x in embedding_list) + "]"
  # → %s 자리에 embedding_str 전달
  ```
- 시그니처: `def upsert_vectors(ds: str, **kwargs) -> int` (반환: upsert 건수)

**2-4. `log_summary(ds, **kwargs)`:**
- 크롤링 건수, 임베딩 건수, upsert 건수 로깅
- 시그니처: `def log_summary(ds: str, **kwargs) -> None`

**DAG 설정:**
- `dag_id`: `job_crawl_dag`
- `schedule`: `0 15 * * 0` (매주 일요일 UTC 15:00 = KST 월요일 00:00)
- `catchup`: False
- `retries`: 0 (크롤링 재시도는 DAG 수준이 아닌 개별 공고 단위 skip으로 처리)
- `execution_timeout`: `timedelta(hours=2)` (크롤링 + 임베딩 전체 시간 상한)
- `tags`: `["mirai", "rag", "crawling"]`
- 의존 관계: `crawl_jobkorea >> embed_postings >> upsert_vectors >> log_summary`

**주의사항:**
- 엔진 `/api/embed` 배치 크기 최대 100개 (스키마 제약)
- 크롤링 실패 시 개별 공고 skip + 로깅 (DAG 전체 실패 방지)
- Airflow가 서비스 DB에 직접 접근하는 것은 배치 파이프라인 예외로 허용 (Step 0에서 명시)

**Acceptance Criteria:**
- [ ] DAG가 Airflow에 정상 등록됨 (`dag_id = job_crawl_dag`)
- [ ] 태스크 의존 관계: `crawl >> embed >> upsert >> log`
- [ ] Rate limit 1초 적용 (`time.sleep(1)`)
- [ ] XCom에 S3 key만 전달 (텍스트 직접 전달 없음)
- [ ] 크롤링 실패 시 개별 skip + 로깅

---

### Step 3 — `vector-search.ts` 모듈

**파일:**
- `services/siw/src/lib/rag-prisma.ts` (신규 — RAG 전용 PrismaClient)
- `services/siw/src/lib/rag/vector-search.ts` (신규)

**3-0. `rag-prisma.ts` — RAG 전용 PrismaClient:**

```typescript
// 공용 RAG Supabase 전용 싱글턴 (RAG_DATABASE_URL)
// 개인 prisma(DATABASE_URL)와 완전 분리
import { PrismaClient } from '@prisma/client'
const globalForRagPrisma = globalThis as unknown as { ragPrisma: PrismaClient | undefined }
export const ragPrisma =
  globalForRagPrisma.ragPrisma ??
  new PrismaClient({ datasources: { db: { url: process.env.RAG_DATABASE_URL } } })
if (process.env.NODE_ENV !== 'production') globalForRagPrisma.ragPrisma = ragPrisma
```

**중요: `$queryRaw` 사용 (tagged template literal) + `ragPrisma`**
기존 코드베이스에서 `observability/route.ts`가 `prisma.$queryRaw(Prisma.sql\`...\`)` 패턴을 사용하고 있으므로 동일한 패턴을 따름. 단, `prisma` 대신 `ragPrisma` 사용. `$queryRawUnsafe` 사용 금지.

**3-1. `searchSimilarPostings` 함수:**

```typescript
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

type SearchResult = {
  id: string
  jobRole: string
  title: string
  company: string
  content: string
  similarity: number
  sourceUrl: string
}

export async function searchSimilarPostings(
  embedding: number[],
  jobRole?: string,
  topK = 10
): Promise<SearchResult[]> {
  if (process.env.ENABLE_RAG !== "true") return []

  const vectorStr = `[${embedding.join(",")}]`

  // CTE 패턴: 1024차원 벡터 문자열을 한 번만 바인딩 (이중 바인딩 비효율 방지)
  // $queryRaw tagged template: ${vectorStr}::vector 는 PostgreSQL에서 유효한 캐스트
  if (jobRole) {
    return ragPrisma.$queryRaw<SearchResult[]>`
      WITH q AS (SELECT ${vectorStr}::vector AS qvec)
      SELECT id, job_role AS "jobRole", title, company, content, source_url AS "sourceUrl",
             1 - (embedding <=> q.qvec) AS similarity
      FROM job_posting_embeddings, q
      WHERE job_role = ${jobRole}
      ORDER BY embedding <=> q.qvec
      LIMIT ${topK}
    `
  }

  return ragPrisma.$queryRaw<SearchResult[]>`
    WITH q AS (SELECT ${vectorStr}::vector AS qvec)
    SELECT id, job_role AS "jobRole", title, company, content, source_url AS "sourceUrl",
           1 - (embedding <=> q.qvec) AS similarity
    FROM job_posting_embeddings, q
    ORDER BY embedding <=> q.qvec
    LIMIT ${topK}
  `
}
```

**3-2. `extractTrendSkills(postings)` 함수:**
- 검색된 공고 `content`에서 역량/스킬 키워드 추출
- TECH_SKILLS 사전 기반 키워드 매칭 + 빈도 정규화 (weight = count / max, 0~1)
- 구현 스펙:
  ```typescript
  const TECH_SKILLS = [
    "Python", "TypeScript", "JavaScript", "React", "Next.js", "Node.js",
    "FastAPI", "Django", "Spring", "Docker", "Kubernetes", "PostgreSQL",
    "MySQL", "MongoDB", "Redis", "AWS", "GCP", "Azure", "Git", "CI/CD",
    "GraphQL", "REST", "Kafka", "Elasticsearch", "Spark", "Airflow",
    "TensorFlow", "PyTorch", "LangChain", "RAG", "Vector DB",
  ] as const

  export function extractTrendSkills(
    postings: SearchResult[]
  ): { skill: string; weight: number }[] {
    const counts = new Map<string, number>()
    for (const p of postings) {
      for (const skill of TECH_SKILLS) {
        if (p.content.toLowerCase().includes(skill.toLowerCase())) {
          counts.set(skill, (counts.get(skill) ?? 0) + 1)
        }
      }
    }
    const max = Math.max(...counts.values(), 1)  // 0-division 방지
    return Array.from(counts.entries())
      .map(([skill, count]) => ({ skill, weight: count / max }))
      .filter((s) => s.weight > 0)
      .sort((a, b) => b.weight - a.weight)
  }
  ```
- 시그니처: `(postings: SearchResult[]) => { skill: string; weight: number }[]`

**3-3. `getTrendSkillsForRole(role, topK)` 통합 함수:**
- role 텍스트를 `embedText()` (엔진 `/api/embed` 경유)로 임베딩
- **⚠️ null 체크 필수**: `embedText()`는 `EmbeddingResult | null` 반환 — null이면 빈 배열 반환
- `searchSimilarPostings`로 유사 공고 검색
- `extractTrendSkills`로 트렌드 스킬 추출
- `embedding-client.ts`의 `fetchTrendSkills()` 스텁을 대체
- 구현 스펙:
  ```typescript
  export async function getTrendSkillsForRole(
    role: string,
    topK = 10
  ): Promise<{ skill: string; weight: number }[]> {
    if (process.env.ENABLE_RAG !== "true") return []
    try {
      const embResult = await embedText(role)
      if (!embResult) return []                  // ← null 체크 필수
      const postings = await searchSimilarPostings(embResult.embedding, role, topK)
      return extractTrendSkills(postings)
    } catch {
      return []                                  // graceful fallback
    }
  }
  ```
- 시그니처: `(role: string, topK?: number) => Promise<{ skill: string; weight: number }[]>`

**주의사항:**
- `ENABLE_RAG` guard 유지 — false이면 빈 배열 반환
- Prisma `$queryRaw` tagged template literal로 SQL injection 방지
- 임베딩 실패 시 graceful fallback (빈 배열)

**Acceptance Criteria:**
- [ ] `searchSimilarPostings` — `$queryRaw` tagged template literal 사용 (`$queryRawUnsafe` 아님)
- [ ] `searchSimilarPostings` — jobRole 필터 있을 때/없을 때 모두 동작
- [ ] `extractTrendSkills` — 공고 텍스트에서 스킬 추출 + 가중치 계산
- [ ] `getTrendSkillsForRole` — end-to-end: 역할 텍스트 → 임베딩 → 검색 → 스킬 추출
- [ ] `ENABLE_RAG=false` 시 빈 배열 반환

---

### Step 4 — RAG 로직 활성화 (Trends API + trendComparison)

**파일:**
- `engine/app/schemas/feedback.py` (수정 — `job_context` optional 파라미터 추가)
- `engine/app/services/feedback_service.py` (수정 — job_context를 LLM 프롬프트에 주입)
- `services/siw/src/lib/rag/embedding-client.ts` (수정)
- `services/siw/src/app/api/resumes/[id]/feedback/route.ts` (수정)
- `services/siw/src/lib/types.ts` (수정 — `FeedbackTrendComparison` 신규 타입 추가)
- `services/siw/src/app/(app)/resumes/[id]/page.tsx` (수정 — trendComparison 상태 타입 변경)
- `services/siw/src/components/FeedbackTrendCard.tsx` (신규)

**4-0. 엔진 `job_context` optional 파라미터 추가:**

`engine/app/schemas/feedback.py` — `FeedbackRequest`에 optional 필드 추가:
```python
class FeedbackRequest(BaseModel):
    resume_text: str
    job_context: list[str] | None = None  # pgvector 검색 결과 공고 내용 (optional)
```

`engine/app/services/feedback_service.py` — `job_context`가 있을 때 LLM 시스템 프롬프트에 주입:
```python
def build_prompt(resume_text: str, job_context: list[str] | None = None) -> str:
    base_prompt = FEEDBACK_SYSTEM_PROMPT  # 기존 프롬프트
    if job_context:
        context_block = "\n\n[채용 시장 참고 데이터 — 유사 채용공고]\n" + "\n---\n".join(job_context[:5])
        base_prompt += context_block
    return base_prompt
```

**호환성**: `job_context` 기본값이 `None`이므로 기존 호출자(엔진 테스트 포함) 수정 불필요.

**4-1. `embedding-client.ts` 수정:**
- 6행 주석 업데이트: `"엔진 /api/rag/trends 구현 후 활성화"` → `"Pipeline 2-2(#163) 완료: 서비스 직접 pgvector 쿼리로 구현 (ADR 참조)"`
- 49행 TODO 주석 업데이트: `"엔진 POST /api/rag/trends 구현 후 실제 호출로 교체"` → `"서비스 직접 pgvector 쿼리로 구현됨 — vector-search.ts의 getTrendSkillsForRole() 참조"`
- `fetchTrendSkills()` 본문을 `vector-search.ts`의 `getTrendSkillsForRole()` 위임으로 교체

**4-2. `trends/route.ts`:**
- 현재 코드가 이미 `fetchTrendSkills(role, topK)` 호출하므로, `embedding-client.ts` 수정만으로 자동 활성화
- 추가 수정 불필요 (이미 ENABLE_RAG guard 있음)

**4-3. `feedback/route.ts` — trendComparison 로직 추가:**
- **⚠️ 명시적 ENABLE_RAG guard 추가 필수**: 현재 route.ts에는 ENABLE_RAG guard가 없음 (22행이 `trendComparison: null` 반환하지만 이는 가드가 아님). 반드시 route 레벨에서 명시적으로 분기:
  ```typescript
  // feedback/route.ts — RAG 분기 (ENABLE_RAG guard)
  if (process.env.ENABLE_RAG !== "true") {
    return NextResponse.json({ feedback: feedbackResult, trendComparison: null })
  }
  ```
- `inferredTargetRole` null 체크 필수: null이면 trendComparison 없이 반환
- 이력서의 `inferredTargetRole` + `resumeText`를 기반으로:
  1. resumeText를 `embedText()` (엔진 `/api/embed` 경유)로 임베딩
  2. `searchSimilarPostings`로 유사 채용공고 검색 (TOP 5)
  3. 검색된 공고 내용(`content`)을 `job_context`로 수집
  4. **엔진 `/api/feedback` 재호출 시 `job_context` 포함** → LLM이 채용공고 컨텍스트를 보고 비교 분석 생성
  5. 검색된 공고 메타데이터(`similarPostings`)를 UI용으로 별도 반환

- 구현 흐름:
  ```typescript
  // ENABLE_RAG=true 경로
  const embResult = await embedText(resumeText)
  if (!embResult) return NextResponse.json({ feedback: feedbackResult, trendComparison: null })

  const postings = await searchSimilarPostings(embResult.embedding, inferredTargetRole, 5)
  const jobContext = postings.map((p) => p.content)

  // 엔진 재호출 — job_context 포함 (LLM 피드백 퀄리티 향상)
  const ragFeedback = await fetchFeedback({ resumeText, jobContext })

  const trendSkills = extractTrendSkills(postings)
  const trendComparison: FeedbackTrendComparison = {
    trendingSkills: trendSkills.slice(0, 10).map((s) => s.skill),
    similarPostings: postings.map((p) => ({
      title: p.title, company: p.company,
      similarity: p.similarity, sourceUrl: p.sourceUrl,
    })),
  }
  return NextResponse.json({ feedback: ragFeedback, trendComparison })
  ```

- `ENABLE_RAG=false` 시 기존대로 `trendComparison: null` 유지

**trendComparison 응답 구조 (간소화 — 역량 비교는 LLM 피드백 텍스트에 포함):**

```typescript
{
  trendComparison: {
    trendingSkills: string[],    // 채용공고 TECH_SKILLS 빈도 TOP 10
    similarPostings: {           // 참고 채용공고 (출처 표시용)
      title: string,
      company: string,
      similarity: number,
      sourceUrl: string,
    }[],
  } | null
}
```

> **설계 노트**: matchedSkills / missingSkills는 LLM 피드백 텍스트 내에 자연어로 포함됨. trendComparison은 "어떤 공고를 참고했는지" UI 투명성 + 트렌딩 스킬 배지 표시 용도.

**타입 변경 전략 — `services/siw/src/lib/types.ts`:**

기존 `TrendComparison` 타입(90-94행)은 Trends API 응답용(`role`, `trendSkills`, `coverageScore`)으로 프론트엔드 `TrendComparisonCard` 컴포넌트가 사용 중이므로 변경하지 않는다.

feedback route의 `trendComparison` 필드는 구조가 완전히 다르므로 별도 타입 `FeedbackTrendComparison`을 신규 정의하고, `FeedbackWithTrends.trendComparison`의 타입을 `FeedbackTrendComparison | null`로 변경한다.

`types.ts`에 추가할 타입:

```typescript
export type FeedbackTrendComparison = {
  trendingSkills: string[]   // 채용공고 TECH_SKILLS 빈도 TOP 10
  similarPostings: Array<{
    title: string
    company: string
    similarity: number
    sourceUrl: string
  }>
}
```

그리고 `FeedbackWithTrends` 타입의 `trendComparison` 필드를 `FeedbackTrendComparison | null`로 변경한다. 기존 `TrendComparison` 타입 및 `TrendComparisonCard` 컴포넌트는 영향 없음.

**4-4. `page.tsx` 업데이트 — UI 분기 처리:**

`page.tsx` 63행의 `useState<TrendComparison | null>` 상태 타입을 `useState<FeedbackTrendComparison | null>`로 변경하고, 72행의 타입 캐스팅을 `{ trendComparison: FeedbackTrendComparison | null }`로 수정한다.

기존 `TrendComparisonCard`는 Trends API 탭(`/trends`)용으로 유지하고, feedback 탭의 `trendComparison` 렌더링에는 새 컴포넌트를 사용한다.

**권장 선택: 신규 `FeedbackTrendCard` 컴포넌트 작성 (역할 분리)**

기존 `TrendComparisonCard`(`TrendComparison` props: `role`, `trendSkills`, `coverageScore`)와 feedback route 응답 구조(`matchedSkills`, `missingSkills`, `trendingSkills`, `similarPostings`)는 완전히 다르므로, props 확장보다 컴포넌트 분리가 더 명확하다.

- 파일: `services/siw/src/components/FeedbackTrendCard.tsx` (신규)
- Props: `FeedbackTrendComparison`
- UI 구성:
  - `matchedSkills` — 이력서와 공고에 공통된 역량 목록
  - `missingSkills` — 공고 요구 but 이력서 미보유 역량 목록 (강조)
  - `trendingSkills` — 최근 트렌딩 스킬 배지
  - `similarPostings` — 참고 채용공고 링크 목록 (`sourceUrl` 링크, `title` + `company` + `similarity` 표시)

`page.tsx` 261행에서 `TrendComparisonCard` 대신 `FeedbackTrendCard`를 조건부 렌더링:

```tsx
// trendComparison이 FeedbackTrendComparison 구조일 때
{trendComparison && <FeedbackTrendCard data={trendComparison} />}
```

**Acceptance Criteria:**
- [ ] 엔진 `FeedbackRequest`에 `job_context: list[str] | None = None` 추가됨
- [ ] 엔진 feedback_service가 `job_context` 있을 때 LLM 프롬프트에 채용공고 컨텍스트 주입
- [ ] `job_context=None` 시 엔진 기존 동작 100% 유지 (backward compatible)
- [ ] `embedding-client.ts`의 엔진 경유 TODO 주석이 "서비스 직접 pgvector 쿼리" 결정을 반영하도록 업데이트됨
- [ ] `ENABLE_RAG=true` 시 Trends API가 실제 pgvector 데이터 기반 스킬 반환
- [ ] `ENABLE_RAG=true` 시 feedback API가 채용공고 `job_context` 포함하여 엔진 재호출
- [ ] `ENABLE_RAG=true` 시 feedback API 응답에 `trendComparison` (`trendingSkills`, `similarPostings`) 포함
- [ ] `ENABLE_RAG=false` 시 기존 동작 유지 (`skills: []`, `trendComparison: null`)
- [ ] 임베딩/검색 실패 시 graceful fallback (null / 빈 배열)
- [ ] `types.ts`에 `FeedbackTrendComparison` 타입 신규 정의됨 (`trendingSkills`, `similarPostings`)
- [ ] `FeedbackWithTrends.trendComparison`이 `FeedbackTrendComparison | null`로 변경됨
- [ ] 기존 `TrendComparison` 타입(Trends API용) 및 `TrendComparisonCard` 컴포넌트 영향 없음
- [ ] `page.tsx`의 `trendComparison` 상태가 `FeedbackTrendComparison | null` 타입으로 변경됨
- [ ] `FeedbackTrendCard` 컴포넌트가 `FeedbackTrendComparison` props를 받아 렌더링됨

---

### Step 5 — 테스트 + .ai.md 최신화

**파일:**
- `engine/tests/test_feedback_service.py` (수정 — job_context 케이스 추가)
- `services/siw/tests/unit/vector-search.test.ts` (신규)
- `services/siw/tests/api/trends-route.test.ts` (수정 — RAG 활성 케이스 추가)
- `services/siw/tests/api/feedback-route-rag.test.ts` (신규)
- `services/siw/airflow/tests/test_job_crawl_dag.py` (신규)
- `services/siw/.ai.md` (수정)
- `services/siw/airflow/.ai.md` (수정)

**vitest 테스트 계획:**

**공통 mock 패턴 (기존 코드베이스 패턴 준수):**
```typescript
// RAG Prisma mock — rag-prisma 모듈 사용
vi.mock("@/lib/rag-prisma", () => ({ ragPrisma: { $queryRaw: vi.fn() } }))

// fetch mock — MSW 없음, stubGlobal 사용
vi.stubGlobal("fetch", vi.fn())

// ENABLE_RAG 환경변수 mock
beforeEach(() => { vi.stubEnv("ENABLE_RAG", "true") })
afterEach(() => { vi.unstubAllEnvs() })
```

**5-1. `vector-search.test.ts`:**
- `searchSimilarPostings` — Prisma `$queryRaw` mock, 정상 검색 결과 반환 확인
- `searchSimilarPostings` — jobRole 필터링 동작 확인
- `searchSimilarPostings` — `ENABLE_RAG=false` 시 빈 배열 (환경변수 mock)
- `extractTrendSkills` — 공고 텍스트에서 스킬 추출 + 가중치 정확도 (weight = count/max)
- `extractTrendSkills` — 공고가 없을 때 빈 배열 반환
- `getTrendSkillsForRole` — 임베딩 → 검색 → 추출 end-to-end (mock)
- `getTrendSkillsForRole` — `ENABLE_RAG=false` 시 빈 배열
- **[P1] `getTrendSkillsForRole` — `embedText()` null 반환 시 빈 배열 fallback** (embedText mock → null)

**5-2. `trends-route.test.ts` 추가 케이스:**
- `ENABLE_RAG=true` 시 실제 스킬 데이터 반환 확인
- 임베딩 실패 시 빈 배열 fallback

**5-0. `engine/tests/test_feedback_service.py` 추가 케이스:**
- `job_context=None` 시 기존 프롬프트 그대로 사용 (backward compatible)
- `job_context=["공고1", "공고2"]` 시 프롬프트에 채용공고 컨텍스트 블록 포함 확인
- `job_context=[]` 빈 리스트 시 컨텍스트 블록 없음 (None과 동일 동작)
- 최대 5개 공고만 주입 확인 (`job_context[:5]`)

**5-3. `feedback-route-rag.test.ts`:**
- `ENABLE_RAG=true` 시 `trendComparison` 객체 반환 (`trendingSkills`, `similarPostings`)
- `ENABLE_RAG=true` 시 엔진 호출 payload에 `job_context` 포함 확인
- `ENABLE_RAG=false` 시 `trendComparison: null` 유지
- 벡터 검색 실패 시 graceful fallback (null)
- **[P1] `inferredTargetRole`이 null일 때 `trendComparison: null` 반환** (edge case)
- `FeedbackTrendComparison` 응답 구조 (`trendingSkills`, `similarPostings`)가 `FeedbackTrendCard` props 타입과 호환되는지 확인

**pytest 테스트 계획:**

**`conftest.py` 필수 fixture:**
```python
import pytest
from unittest.mock import MagicMock

@pytest.fixture
def mock_ti():
    """Airflow TaskInstance mock — XCom push/pull 검증용"""
    ti = MagicMock()
    ti.xcom_push = MagicMock()
    ti.xcom_pull = MagicMock()
    return ti
```

**5-4. `test_job_crawl_dag.py`:**
- DAG 로딩 + 태스크 의존성 검증 (`DagBag` 로드 후 `dag.topological_sort()` 확인)
- `crawl_jobkorea` — requests mock, S3 적재 확인, Rate limit `time.sleep(1)` 호출 확인
- `embed_postings` — 엔진 API mock (`vi.stubGlobal` 대신 `requests_mock` 또는 `unittest.mock.patch`), 배치 호출 확인
- **[P1] `embed_postings` — 101개 공고 입력 시 배치 2회 호출 확인** (100개 + 1개 청크)
- `upsert_vectors` — psycopg2 mock, upsert SQL 확인
- **[P1] `upsert_vectors` — `ON CONFLICT` 중복 source_url 처리 확인** (동일 URL 2회 upsert → 1건)
- 에러 핸들링 — 크롤링 실패 시 개별 skip + 로깅 확인 (나머지 공고는 계속 처리)

**.ai.md 최신화:**
- `services/siw/.ai.md` — Issue #163 완료 기록, `job_posting_embeddings` 테이블, `vector-search.ts`, DAG 추가
- `services/siw/airflow/.ai.md` — `job_crawl_dag`, `tests/` 디렉토리, 배치 파이프라인 DB 접근 원칙 기재

**Acceptance Criteria:**
- [ ] vitest 전체 통과 (`vector-search`, `trends-route`, `feedback-route-rag`)
- [ ] pytest 전체 통과 (`test_job_crawl_dag`)
- [ ] `.ai.md` 최신화 완료 (siw, airflow 모두)

---

### ADR: Embedding 검색 경로 결정

**Decision**
벡터 유사도 검색(pgvector cosine similarity)은 서비스(`siw`)가 Prisma `$queryRaw`로 직접 수행한다. 임베딩 생성(AI API 호출)은 기존대로 엔진 `/api/embed`를 경유한다.

**Drivers**
1. 아키텍처 불변식 "DB는 서비스가 소유" — `job_posting_embeddings`는 서비스 DB 테이블이므로 서비스가 직접 쿼리하는 것이 원칙에 부합
2. 아키텍처 불변식 "엔진은 stateless" — 엔진에 DB 커넥션을 추가하면 stateless 원칙 위반
3. "외부 AI API 호출은 엔진에서만" — 임베딩 생성은 AI API 호출이므로 엔진 경유, 벡터 검색은 DB 쿼리이므로 서비스 직접

**Alternatives Considered**
- **엔진 `/api/rag/trends` 경유 (Option B):** `embedding-client.ts` 49행의 원래 TODO가 이 방식을 상정했으나, 엔진에 DB 커넥션이 필요해지며 불변식 3("서비스 간 직접 통신 금지")과 불변식 4("DB는 서비스가 소유")에 충돌. 엔진이 서비스 DB를 직접 읽게 되면 소유권 경계가 모호해짐.

**Why Chosen**
"임베딩 생성 = AI API = 엔진" / "벡터 검색 = DB 쿼리 = 서비스"로 경계를 명확히 분리하면, 기존 불변식을 모두 준수하면서 레이턴시도 줄일 수 있다. 엔진에 DB 커넥션을 추가하는 것보다 아키텍처적으로 깔끔하다.

**Consequences**
- `embedding-client.ts`의 "엔진 /api/rag/trends 구현 후 활성화" TODO 주석을 업데이트해야 함 (Step 4에서 처리)
- 벡터 검색 로직이 서비스에 위치하므로, 다른 서비스에서 동일 기능이 필요하면 공유 패턴 정립 필요
- `$queryRaw` tagged template literal로 SQL injection 방지

**Follow-ups**
- IVFFlat 인덱스는 데이터 적재 후 `REINDEX` 필요 (초기 적재 완료 시점)
- 크롤링 대상 직무 대분류 리스트 최종 확정
- 스킬 추출 로직 고도화 (키워드 매칭 → NLP 기반) 검토
- `00_issue.md`의 `vector(768)` 기재를 `vector(1024)`로 정정 필요

---

### 벡터 차원 768 → 1024 수정 대상 목록

| 파일 | 현재 값 | 수정 값 | 비고 |
|------|---------|---------|------|
| `docs/work/active/000163-pipeline-2-2/00_issue.md` 18행 | `vector(768)` | `vector(1024)` | 이슈 문서 정정 |
| `docs/work/active/000163-pipeline-2-2/01_plan.md` 완료 기준 | `vector(768)` | `vector(1024)` | 본 문서 (수정 완료) |
| `airflow/sql/003_enable_pgvector.sql` | (신규) | `vector(1024)` | 1024로 작성 |
| `prisma/schema.prisma` | (신규 모델) | `Unsupported("vector(1024)")` | 1024로 작성 |

근거: 엔진 `embedding_service.py` 29행에 `if len(emb) != 1024: raise ValueError` 하드코딩됨.

---

### #97 (Pipeline 2-1) overlap 분석

| 항목 | #97에서 완성된 것 | #163 관계 |
|------|------------------|-----------|
| 엔진 `/api/embed` | ✅ 구현됨 (`embedding_service.py`) | #163 Step 2에서 호출만 함 — 코드 변경 없음 |
| `embedding-client.ts` | ✅ `embedText()`, `fetchTrendSkills()` 뼈대 | `fetchTrendSkills()` stub → `getTrendSkillsForRole()`로 교체 |
| Trends API (`/api/resumes/trends`) | ✅ 뼈대 (빈 배열 반환) | Step 4에서 RAG 로직 주입 (ENABLE_RAG guard) |
| `trendComparison` 뼈대 | ✅ `null` 반환 skeleton | Step 4에서 실제 pgvector 검색 결과로 채움 |
| 엔진 `ResumeFeedbackRequest` | ✅ 기본 스키마 | Step 4에서 `job_context: list[str] | None = None` 추가 |

**결론: 충돌 없음.** #97은 인프라·뼈대, #163은 데이터 적재·활성화. #97의 코드에 직접 덮어쓰는 변경은 없고, 확장(optional 파라미터 추가, stub 교체)만 발생함.

---

### #198 (합격 자소서 RAG) pre-alignment

**#163에서 선행 작업:**
- `airflow/sql/004_accepted_resumes.sql` 신규 — 공용 RAG Supabase에 `accepted_resume_embeddings` 테이블 DDL
- 테이블: `id, job_role, content, embedding vector(1024), source, created_at`
- IVFFlat cosine index (`lists = 10`)

**#198에서 할 작업 (scope 외):**
- 합격 자소서 1000개 데이터 수집 + 임베딩 빌드 스크립트
- `accepted_resume_embeddings` 테이블에 데이터 적재
- 엔진 `ResumeFeedbackRequest`에 `resume_context: list[str] | None = None` 추가 (job_context와 공존 가능)
- feedback route에서 `accepted_resume_embeddings` 검색 → `resume_context` 주입

**#163 ↔ #198 coexistence:**
- `job_context` (#163) 와 `resume_context` (#198)는 독립적인 optional 파라미터 — 충돌 없음
- 두 테이블 모두 공용 RAG Supabase(`RAG_DATABASE_URL`)에 위치 — `ragPrisma` 하나로 조회 가능

---

### 공용 RAG Supabase 아키텍처 요약

```
개인 Supabase (DATABASE_URL)           공용 RAG Supabase (RAG_DATABASE_URL)
──────────────────────────────         ──────────────────────────────────────
resumes, users, sessions, ...          job_posting_embeddings   ← Airflow (#163)
                                       accepted_resume_embeddings ← 빌드 스크립트 (#198)
```

- 팀원 모두 동일한 `RAG_DATABASE_URL` 공유 → 누가 Airflow 실행하든 모두 같은 데이터 사용
- `ENABLE_RAG=false`이면 `ragPrisma` 코드 경로 전체 skip → 개인 Supabase만으로 정상 동작

---

## 실제 구현 내역 (2026-03-23)

### 계획 대비 변경 사항

#### 1. trendComparison 아키텍처 변경 (핵심)

**원래 계획 (Step 4):**
- GET `/api/resumes/[id]/feedback` 호출 시마다 pgvector 검색 + 엔진 LLM 재호출

**실제 구현:**
- POST `/api/resumes` 분석 시점에 RAG 계산 → `trendComparison` DB 컬럼에 캐싱
- GET `/api/resumes/[id]/feedback` → DB 읽기만, LLM 재호출 없음
- **이유:** 피드백 페이지 매 로드마다 LLM 호출하는 것은 과도한 비용·latency. `trendComparison Json?` 컬럼 하나 추가로 해결.

**추가된 파일/변경:**
- `prisma/schema.prisma` — `trendComparison Json?` 컬럼 추가
- `prisma/migrations/20260323000000_add_trend_comparison/migration.sql` 신규
- `src/lib/resume-repository.ts` — `trendComparison` 필드 추가

#### 2. ON CONFLICT 키 변경

**원래:** `UNIQUE (source_url)` — 동일 URL은 한 번만 저장
**변경:** `UNIQUE (source_url, job_role)` — 동일 공고가 여러 직군 카테고리에 출현 가능
- `airflow/sql/005_unique_source_url_job_role.sql` 마이그레이션 추가

#### 3. 잡코리아 BCtgrCode 수정

**원래:** 1~11 (11개)
**실제 HTML:** 1-10, 12, 13 (12개, 11번 없음)
- `job_crawl_dag.py` MAJOR_CATEGORIES 딕셔너리 수정

#### 4. UI에서 TrendComparisonCard 제거

**원래 계획:** `trendingSkills` 배지 + `similarPostings` 참고 공고 UI 표시
**실제:** 컴포넌트 제거 — RAG는 피드백 품질 향상용 내부 로직, 별도 UI 불필요
- `src/app/(app)/resumes/[id]/page.tsx` — TrendComparisonCard import/state/render 제거

#### 5. POST 병렬 처리 구조

```typescript
// 업로드 + 질문 생성 + 임베딩을 병렬 실행
const [storageKey, engineData, embResult] = await Promise.all([
  uploadResumePdf(...),
  withEventLogging('resume_questions', ...),  // /api/resume/questions
  enableRag ? embedText(resumeText) : Promise.resolve(null),
])
// 이후 pgvector 검색 → 단 1회 LLM 호출 (job_context 포함)
```

### 최종 파일 목록

| 파일 | 상태 | 내용 |
|------|------|------|
| `airflow/sql/003_enable_pgvector.sql` | 신규 | pgvector extension + job_posting_embeddings 테이블 |
| `airflow/sql/004_accepted_resumes.sql` | 신규 | accepted_resume_embeddings 테이블 (#198 pre-alignment) |
| `airflow/sql/005_unique_source_url_job_role.sql` | 신규 | ON CONFLICT 키 변경 마이그레이션 |
| `airflow/dags/job_crawl_dag.py` | 신규 | 잡코리아 크롤링 + 임베딩 + pgvector upsert DAG |
| `airflow/tests/test_job_crawl_dag.py` | 신규 | pytest 단위 테스트 |
| `src/lib/rag/vector-search.ts` | 신규 | pgvector cosine similarity 검색, extractTrendSkills |
| `src/lib/rag/embedding-client.ts` | 신규 | 엔진 /api/embed 호출 클라이언트 |
| `src/lib/rag/__tests__/vector-search.test.ts` | 신규 | vitest 단위 테스트 |
| `src/lib/rag-prisma.ts` | 신규 | RAG DB Prisma 클라이언트 |
| `src/app/api/resumes/route.ts` | 수정 | RAG 파이프라인 통합, trendComparison 저장 |
| `src/app/api/resumes/[id]/feedback/route.ts` | 수정 | LLM 재호출 제거, DB 읽기만 |
| `src/app/api/resumes/[id]/feedback/__tests__/route.test.ts` | 수정 | TrendComparison 형태로 테스트 수정 |
| `src/lib/resume-repository.ts` | 수정 | trendComparison 필드 추가 |
| `prisma/schema.prisma` | 수정 | trendComparison Json? 컬럼 |
| `prisma/migrations/20260323000000_add_trend_comparison/` | 신규 | Prisma 마이그레이션 |
| `src/app/(app)/resumes/[id]/page.tsx` | 수정 | TrendComparisonCard 제거 |
- `ragPrisma` 클라이언트가 `RAG_DATABASE_URL` 미설정 시 `undefined` datasource로 초기화 — ENABLE_RAG guard로 실제 쿼리는 실행되지 않음
