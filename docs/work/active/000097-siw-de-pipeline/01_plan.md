# [#97 + #163] Pipeline 2 통합 구현 계획

> 작성: 2026-03-20 | 수정: 2026-03-20 (RALPLAN-DR 통합 플랜 — Critic OKAY)
> 브랜치: feat/000097-siw-de-pipeline

---

## 이슈 구조

| 이슈 | 제목 | Step | 상태 |
|------|------|------|------|
| **#97 Pipeline 2-1** | inferredTargetRole + 엔진 embed API + trendComparison 뼈대 | Steps 1-5 | 진행 중 |
| **#163 Pipeline 2-2** | 잡코리아 크롤링 + pgvector + RAG 로직 활성화 | Steps 6-10 | 백로그 |

---

## RALPLAN-DR Summary

### Principles (5)

1. **Feature Flag 격리** — `ENABLE_RAG` 미설정 시 기존 흐름 100% 보존. 다른 팀원 서비스 무관.
2. **AI API 엔진 경유** — 임베딩(Gemini), LLM 호출은 반드시 engine을 거친다 (불변식 #2).
3. **점진적 활성화** — #97이 뼈대(guard + stub), #163이 실체(크롤링 + RAG). 각각 독립 배포 가능.
4. **XCom 경량 원칙** — Airflow XCom에 대용량 텍스트 직접 전달 금지. S3/DB 경유.
5. **Robots.txt 준수** — 잡코리아 크롤링 시 robots.txt 확인 + 요청 간 1초 rate limit.

### ADR

**Decision**: #97(Pipeline 2-1)과 #163(Pipeline 2-2)을 한 브랜치에서 순차 구현. 10 Steps, #97 checkpoint 이후 #163 진행.

**Drivers**: Feature flag 격리, 엔진 경유 불변식, 점진적 활성화

**Alternatives considered**: (1) 별도 브랜치 분리 — 머지 충돌 위험, 동일 파일 수정 다수 (2) 한꺼번에 RAG 활성화 — 중간 검증 불가

**Why chosen**: 한 브랜치 순차 구현이 파일 충돌 최소화 + #97 checkpoint에서 중간 검증 가능

**Consequences**: 브랜치가 길어질 수 있음 (10 steps). 각 step에서 테스트 통과 확인 필수.

**Follow-ups**: `ENABLE_RAG=true` 배포는 #163 완료 후 별도 배포 설정에서 처리.

---

## Guardrails

### Must Have
- `ENABLE_RAG` 미설정 시 기존 흐름 100% 동일
- 모든 AI API 호출은 engine 경유
- 각 Step 완료 시 테스트 통과
- robots.txt 준수 + 1초 rate limit (잡코리아)
- XCom에 대용량 텍스트 직접 전달 금지

### Must NOT Have
- 다른 팀원 서비스(kwan, lww, seung) 코드 변경
- 기존 엔진 엔드포인트 시그니처 변경
- pgvector를 Prisma로 관리 (raw SQL + Supabase client 사용)
- ENABLE_RAG 없이 RAG 로직이 실행되는 경로

---

## 환경변수 (신규)

| 변수 | 용도 | 기본값 |
|------|------|--------|
| `ENABLE_RAG` | RAG 기능 활성화 플래그 | 미설정 시 기존 흐름 |
| `GEMINI_API_KEY` | Gemini Embedding API 키 | engine 환경변수 |

---

## Task Flow (10 Steps)

```
#97 Pipeline 2-1 (Steps 1-5)
================================
Step 1: S3 raw 적재 + inferredTargetRole 저장
Step 2: 엔진 POST /api/embed
Step 3: Trends API 뼈대 (ENABLE_RAG guard)
Step 4: trendComparison 피드백 뼈대 + 클라이언트 마이그레이션
Step 5: #97 테스트 + 문서 + CHECKPOINT
    |
    v
#163 Pipeline 2-2 (Steps 6-10)
================================
Step 6: pgvector 스키마 + Supabase extension
Step 7: Airflow job_crawl_dag (크롤링 + 임베딩 + upsert)
Step 8: Trends API RAG 로직 (vector-search.ts)
Step 9: trendComparison RAG 기반 비교 로직
Step 10: #163 테스트 + ENABLE_RAG 배포 설정 + 문서
```

---

## 구현 계획

### Step 1 — S3 raw 적재 + inferredTargetRole 저장

**AC 매핑**: #97-AC1

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/src/lib/role-normalizer.ts` | 신규 |
| `services/siw/src/app/api/resumes/route.ts` | 수정 |
| `services/siw/prisma/schema.prisma` | 수정 |

**함수 시그니처**:
```typescript
// role-normalizer.ts
const ROLE_MAP: Record<string, string> = {
  "소프트웨어 개발자": "백엔드개발자",
  "백엔드 개발자": "백엔드개발자",
  "프론트엔드 개발자": "프론트엔드개발자",
  "데이터 엔지니어": "데이터엔지니어",
  // 잡코리아 대분류 기준으로 확장
}
export function normalizeRole(raw: string): string
// 매핑 없으면 공백 제거 후 원본 반환
```

**route.ts 수정 사항**:
- [CRITICAL] `route.ts:99` `resumeRepository.create()` 호출에 `inferredTargetRole: normalizeRole(targetRole)` 추가

**schema.prisma 수정**:
- `@@index([inferredTargetRole])` 추가 (Resume 모델)

**검증 기준**:
- [ ] Resume DB에 `inferredTargetRole` 정규화되어 저장됨
- [ ] 기존 자소서 업로드 흐름 영향 없음

---

### Step 2 — 엔진 POST /api/embed

**AC 매핑**: #97-AC2

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `engine/app/routers/embed.py` | 신규 |
| `engine/app/services/embedding_service.py` | 신규 |
| `engine/app/schemas.py` | 수정 |
| `engine/app/main.py` | 수정 |
| `engine/pyproject.toml` | 수정 (`google-generativeai` 의존성 추가) |
| `engine/app/config.py` | 수정 (`gemini_api_key` 설정 추가) |

**API 스키마**:
```python
# schemas.py 추가
class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)
    model: str = "text-embedding-004"

class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    usage: UsageMetadata | None = None
```

**embedding_service.py**:
```python
def get_embeddings(texts: list[str], model: str = "text-embedding-004") -> tuple[list[list[float]], UsageInfo | None]:
    # Gemini text-embedding-004 (768차원)
    # GEMINI_API_KEY 환경변수 사용 (config.py에서 읽기)
    # 반환된 임베딩 차원 검증: assert len(emb) == 768
    # 배치 처리: texts 그대로 전달 (최대 100개 제한은 schema에서)
```

**main.py 수정**:
- `from app.routers.embed import router as embed_router`
- `app.include_router(embed_router, prefix="/api")`

**검증 기준**:
- [ ] `POST /api/embed {"texts": ["hello"]}` → 200 + `embeddings: [[...768 floats]]`
- [ ] texts 빈 배열 → 400
- [ ] texts 100개 초과 → 400
- [ ] 기존 `/api/resume/*`, `/api/interview/*` 등 엔드포인트 영향 없음

---

### Step 3 — Trends API 뼈대 (ENABLE_RAG guard)

**AC 매핑**: #97-AC3

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/src/app/api/resumes/trends/route.ts` | 신규 |
| `services/siw/src/lib/rag/embedding-client.ts` | 신규 |

**함수 시그니처**:
```typescript
// trends/route.ts
export async function GET(request: Request): Promise<NextResponse>
// ?role= 필수, 미인증 401, role 없음 400
// ENABLE_RAG 미설정 → { trends: [], totalJobs: 0, role }
// ENABLE_RAG 설정 → Step 8에서 RAG 로직 추가

// embedding-client.ts — engine /api/embed 호출 클라이언트
export async function getEmbeddings(texts: string[]): Promise<number[][]>
// ENGINE_BASE_URL/api/embed 호출
```

**검증 기준**:
- [ ] `GET /api/resumes/trends?role=백엔드개발자` → 200 + `{ trends: [], totalJobs: 0, role: "백엔드개발자" }` (ENABLE_RAG 미설정)
- [ ] role 없음 → 400
- [ ] 미인증 → 401

---

### Step 4 — trendComparison 피드백 뼈대 + 클라이언트 마이그레이션

**AC 매핑**: #97-AC4

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/src/lib/types.ts` | 수정 |
| `services/siw/src/app/api/resumes/[id]/feedback/route.ts` | 수정 |
| `services/siw/src/app/(app)/resumes/[id]/page.tsx` | 수정 |
| `services/siw/src/components/TrendComparisonCard.tsx` | 신규 |

**타입 추가** (types.ts):
```typescript
export type TrendSkill = {
  skill: string;
  inMyResume: boolean;
  relevanceScore: number;
};

export type TrendComparison = {
  role: string;
  topSkills: TrendSkill[];
  matchCount: number;
  totalSkills: number;
} | null;

export type FeedbackWithTrends = {
  feedback: ResumeFeedback | null;
  trendComparison: TrendComparison;
};
```

**feedback/route.ts 수정** (Breaking Change):
```typescript
// 기존: return NextResponse.json(resume.feedbackJson ?? null)
// 변경:
const trendComparison = process.env.ENABLE_RAG
  ? null  // Step 9에서 RAG 로직 추가
  : null;
return NextResponse.json({
  feedback: resume.feedbackJson ?? null,
  trendComparison,
});
```

**page.tsx 수정** (Breaking Change 마이그레이션):
```typescript
// 1) state 추가
const [trendComparison, setTrendComparison] = useState<TrendComparison>(null)

// 2) line 69: fetch 후 파싱 변경
//   기존: feedbackData as ResumeFeedback | null
//   변경:
const { feedback: fb, trendComparison: tc } = feedbackData
  ?? { feedback: null, trendComparison: null }
setFeedback(fb)
setTrendComparison(tc)

// 3) JSX: "자소서 분석 결과" 카드 아래, "8축 역량 평가" 카드 위에 추가
<TrendComparisonCard trendComparison={trendComparison} />
```

**TrendComparisonCard.tsx** (신규 컴포넌트):
```typescript
// trendComparison === null → 렌더링 없음 (Pipeline 2-2 활성화 전까지 섹션 숨김)
// trendComparison !== null (ENABLE_RAG=true, Step 9 이후):
//   헤더: "채용 시장 트렌드 비교" + role 뱃지
//   요약: matchCount / totalSkills → "시장 요구 역량 {totalSkills}개 중 {matchCount}개 보유"
//   스킬 목록:
//     inMyResume=true  → 초록 체크 아이콘 + skill 이름 + relevanceScore 바
//     inMyResume=false → 회색 X 아이콘 + skill 이름 + relevanceScore 바 (강조: "내 자소서에 없음")
// 기존 카드 스타일 재사용:
//   className="bg-white/90 backdrop-blur-sm border border-black/[0.08] rounded-2xl p-6 ..."
```

**검증 기준**:
- [ ] `GET /api/resumes/{id}/feedback` → `{ feedback: {...}, trendComparison: null }` 반환
- [ ] `trendComparison: null` 시 TrendComparisonCard 미렌더링 (섹션 숨김)
- [ ] 기존 feedback 데이터 정상 렌더링 (page.tsx)
- [ ] feedback이 null인 경우 "분석 결과가 없습니다" 메시지 정상 표시
- [ ] `tests/api/resume-feedback-route.test.ts` assertion 업데이트

---

### Step 5 — #97 테스트 + 문서 (CHECKPOINT)

**AC 매핑**: #97-AC5, #97-AC6

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/tests/unit/role-normalizer.test.ts` | 신규 |
| `services/siw/tests/api/trends-route.test.ts` | 신규 |
| `services/siw/tests/api/resume-feedback-route.test.ts` | 수정 |
| `engine/tests/integration/test_embed_route.py` | 신규 |
| `services/siw/.ai.md` | 수정 |
| `engine/.ai.md` | 수정 |
| `.env.example` | 수정 |

**테스트 케이스**:
- `role-normalizer.test.ts`: 한글 직무명 매핑 ("소프트웨어 개발자" → "백엔드개발자"), 미매핑 시 공백제거 원본
- `trends-route.test.ts`: 200 빈 배열 (ENABLE_RAG 미설정), 400 (role 없음), 401 (미인증)
- `resume-feedback-route.test.ts`: 응답 `{ feedback, trendComparison: null }` 래핑 확인
- `test_embed_route.py`: 200 정상 + 768차원 확인, 빈 texts 400, 기존 라우터 무영향

**CHECKPOINT — #97 완료 기준**:
- [ ] `npx vitest run` 전체 통과 (services/siw)
- [ ] `pytest` 전체 통과 (engine)
- [ ] `.ai.md` 최신화 완료
- [ ] #97 AC 전체 충족 확인 후 #163 진행

---

### ===== #163 Pipeline 2-2 시작 =====

---

### Step 6 — pgvector 스키마 + Supabase extension

**AC 매핑**: #163-AC1

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/airflow/sql/002_create_job_posting_embeddings.sql` | 신규 |
| `services/siw/src/lib/rag/vector-search.ts` | 신규 (타입 + 빈 구현) |

**SQL DDL**:
```sql
-- Supabase에서 pgvector extension 활성화
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS job_posting_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_title     TEXT NOT NULL,
  company       TEXT NOT NULL,
  role_category TEXT NOT NULL,        -- 정규화된 직무 대분류 (role-normalizer.ts와 동일 값)
  skills        TEXT[] NOT NULL,       -- 추출된 기술 스택
  embedding     vector(768) NOT NULL,  -- Gemini text-embedding-004
  source_url    TEXT,
  crawled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_embeddings_role ON job_posting_embeddings (role_category);
CREATE INDEX idx_job_embeddings_vector ON job_posting_embeddings
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

> **Note**: pgvector는 Prisma로 관리하지 않음 (Prisma native vector 지원 없음). SQL을 Supabase Dashboard에서 직접 실행.

**vector-search.ts** (Step 8에서 구현, 여기서는 타입 + export):
```typescript
export type VectorSearchResult = {
  jobTitle: string;
  company: string;
  skills: string[];
  similarity: number;
};

export async function searchSimilarJobs(
  embedding: number[], roleCategory: string, limit?: number
): Promise<VectorSearchResult[]> {
  // Step 8에서 구현
  return [];
}
```

**검증 기준**:
- [ ] SQL을 Supabase에 실행하면 테이블 + 인덱스 생성됨
- [ ] `vector(768)` 타입 정상 동작 확인
- [ ] vector-search.ts 타입 export 정상

---

### Step 7 — Airflow job_crawl_dag

**AC 매핑**: #163-AC2

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/airflow/dags/job_crawl_dag.py` | 신규 |
| `services/siw/airflow/dags/crawlers/jobkorea.py` | 신규 |
| `services/siw/airflow/requirements.txt` | 수정 |

**DAG 구조** (llm_quality_dag.py 패턴 참고):
```python
# job_crawl_dag.py
# Schedule: 매주 일요일 UTC 15:00 (KST 월요일 00:00)
# Pipeline: crawl_jobs >> upload_to_s3 >> embed_texts >> upsert_to_pgvector

def crawl_jobs(**kwargs):
    # jobkorea.py 크롤러 호출
    # robots.txt 확인 + 1초 rate limit
    # 결과를 S3에 JSON 저장 (XCom에는 S3 키만 전달)
    kwargs["ti"].xcom_push(key="s3_key", value=s3_key)

def embed_texts(**kwargs):
    # S3에서 크롤링 결과 로드
    # engine /api/embed 배치 호출 (100개씩)
    # 임베딩 결과를 S3에 저장
    kwargs["ti"].xcom_push(key="embed_s3_key", value=embed_s3_key)

def upsert_to_pgvector(**kwargs):
    # S3에서 임베딩 결과 로드
    # Supabase pgvector upsert (psycopg2)
```

**jobkorea.py 크롤러**:
```python
def crawl_jobkorea(role_categories: list[str]) -> list[dict]:
    # requests + BeautifulSoup
    # robots.txt: /recruit/joblist 및 /Recruit/GI_Read Allow 확인됨
    # 요청 간 time.sleep(1)
    # 반환: [{ job_title, company, role_category, skills, source_url }]
```

**검증 기준**:
- [ ] DAG가 Airflow에서 정상 파싱됨
- [ ] robots.txt 준수 + 1초 rate limit 코드 존재
- [ ] XCom에는 S3 키만 전달 (대용량 텍스트 아님)
- [ ] engine `/api/embed` 호출로 임베딩 생성
- [ ] pgvector upsert 정상 동작

---

### Step 8 — Trends API RAG 로직 (vector-search.ts)

**AC 매핑**: #163-AC3

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/src/lib/rag/vector-search.ts` | 수정 (구현 채우기) |
| `services/siw/src/app/api/resumes/trends/route.ts` | 수정 |

**vector-search.ts 구현**:
```typescript
import { createServiceClient } from "@/lib/supabase/server";

export async function searchSimilarJobs(
  embedding: number[], roleCategory: string, limit = 20
): Promise<VectorSearchResult[]> {
  const supabase = createServiceClient();
  // Supabase rpc로 pgvector similarity search
  // SELECT *, 1 - (embedding <=> $1::vector) AS similarity
  // FROM job_posting_embeddings
  // WHERE role_category = $2
  // ORDER BY embedding <=> $1::vector
  // LIMIT $3
}
```

**trends/route.ts 수정** (ENABLE_RAG 분기 실제 구현):
```typescript
if (process.env.ENABLE_RAG) {
  const resumeEmbedding = await getEmbeddings([role]);
  const jobs = await searchSimilarJobs(resumeEmbedding[0], normalizedRole);
  // skills 집계 → trends 배열 생성
  // { skill, relevanceScore, jobCount }
  return NextResponse.json({ trends, totalJobs, role: normalizedRole, weekOf });
}
```

**검증 기준**:
- [ ] `ENABLE_RAG=true` 시 pgvector에서 유사 채용공고 검색
- [ ] trends 배열에 skill + relevanceScore + jobCount 포함
- [ ] `ENABLE_RAG` 미설정 시 기존 빈 배열 반환 (Step 3 동작 유지)

---

### Step 9 — trendComparison RAG 기반 비교 로직

**AC 매핑**: #163-AC4

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/src/lib/rag/trend-comparison.ts` | 신규 |
| `services/siw/src/app/api/resumes/[id]/feedback/route.ts` | 수정 |

**trend-comparison.ts**:
```typescript
export async function computeTrendComparison(
  resumeText: string, targetRole: string
): Promise<TrendComparison> {
  // 1. embedding-client로 resumeText 임베딩
  // 2. vector-search로 유사 채용공고 검색
  // 3. 채용공고 skills vs 내 이력서 키워드 매칭
  // 4. TrendComparison 객체 반환
}
```

**feedback/route.ts 수정**:
```typescript
const trendComparison = process.env.ENABLE_RAG
  ? await computeTrendComparison(resume.resumeText, resume.inferredTargetRole ?? "")
  : null;
```

**검증 기준**:
- [ ] `ENABLE_RAG=true` 시 `trendComparison` 객체에 topSkills, matchCount, totalSkills 포함
- [ ] `ENABLE_RAG` 미설정 시 `trendComparison: null` (Step 4 동작 유지)
- [ ] 내 이력서에 없는 시장 요구 역량이 `inMyResume: false`로 표시됨

---

### Step 10 — #163 테스트 + ENABLE_RAG 배포 설정 + 문서

**AC 매핑**: #163-AC5, #163-AC6

**변경 파일**:
| 파일 | 유형 |
|------|------|
| `services/siw/tests/unit/vector-search.test.ts` | 신규 |
| `services/siw/tests/unit/trend-comparison.test.ts` | 신규 |
| `services/siw/tests/api/trends-route-rag.test.ts` | 신규 |
| `engine/tests/integration/test_embed_route.py` | 수정 (배치 테스트 추가) |
| `services/siw/airflow/tests/test_job_crawl_dag.py` | 신규 |
| `services/siw/.ai.md` | 수정 |
| `services/siw/airflow/.ai.md` | 수정 |
| `engine/.ai.md` | 수정 |
| `.env.example` | 수정 |

**테스트 케이스**:
- `vector-search.test.ts`: pgvector similarity search mock, 빈 결과, role 필터링
- `trend-comparison.test.ts`: 매칭 로직 (inMyResume true/false), 빈 채용공고
- `trends-route-rag.test.ts`: ENABLE_RAG=true 시 trends 배열 반환, similarity 정렬
- `test_job_crawl_dag.py`: DAG 파싱, task 의존성, S3 mock
- `test_embed_route.py` 추가: 배치 100개 정상, **768차원 검증** (`assert len(emb) == 768`)

**배포 설정**:
- `.env.example`에 `ENABLE_RAG=true` 추가 + 설명 주석
- Airflow Variables: `ENGINE_BASE_URL`, `S3_DATA_BUCKET`, `SUPABASE_DB_URL`
  (Airflow DAG 전용 — 채용공고 크롤링 결과 + 임베딩 중간 저장용. 자소서 로깅과 무관)

**검증 기준**:
- [ ] `npx vitest run` 전체 통과
- [ ] `pytest` 전체 통과
- [ ] DAG 테스트 통과
- [ ] `.ai.md` 전체 최신화
- [ ] `.env.example`에 신규 환경변수 문서화

---

## 파일 변경 요약 (전체)

| # | 파일 | 유형 | Step | 이슈 |
|---|------|------|------|------|
| 1 | `services/siw/src/lib/role-normalizer.ts` | 신규 | 1 | #97 |
| 3 | `services/siw/src/app/api/resumes/route.ts` | 수정 | 1 | #97 |
| 4 | `services/siw/prisma/schema.prisma` | 수정 | 1 | #97 |
| 5 | `engine/app/routers/embed.py` | 신규 | 2 | #97 |
| 6 | `engine/app/services/embedding_service.py` | 신규 | 2 | #97 |
| 7 | `engine/app/schemas.py` | 수정 | 2 | #97 |
| 8 | `engine/app/main.py` | 수정 | 2 | #97 |
| 9 | `engine/pyproject.toml` | 수정 | 2 | #97 |
| 10 | `engine/app/config.py` | 수정 | 2 | #97 |
| 11 | `services/siw/src/app/api/resumes/trends/route.ts` | 신규 | 3 | #97 |
| 12 | `services/siw/src/lib/rag/embedding-client.ts` | 신규 | 3 | #97 |
| 13 | `services/siw/src/lib/types.ts` | 수정 | 4 | #97 |
| 14 | `services/siw/src/app/api/resumes/[id]/feedback/route.ts` | 수정 | 4,9 | #97,#163 |
| 15 | `services/siw/src/app/(app)/resumes/[id]/page.tsx` | 수정 | 4 | #97 |
| 15a | `services/siw/src/components/TrendComparisonCard.tsx` | 신규 | 4 | #97 |
| 16 | `services/siw/tests/unit/role-normalizer.test.ts` | 신규 | 5 | #97 |
| 18 | `services/siw/tests/api/trends-route.test.ts` | 신규 | 5 | #97 |
| 19 | `services/siw/tests/api/resume-feedback-route.test.ts` | 수정 | 5 | #97 |
| 20 | `engine/tests/integration/test_embed_route.py` | 신규 | 5,10 | #97,#163 |
| 21 | `services/siw/.ai.md` | 수정 | 5,10 | #97,#163 |
| 22 | `engine/.ai.md` | 수정 | 5,10 | #97,#163 |
| 23 | `services/siw/airflow/sql/002_create_job_posting_embeddings.sql` | 신규 | 6 | #163 |
| 24 | `services/siw/src/lib/rag/vector-search.ts` | 신규 | 6,8 | #163 |
| 25 | `services/siw/airflow/dags/job_crawl_dag.py` | 신규 | 7 | #163 |
| 26 | `services/siw/airflow/dags/crawlers/jobkorea.py` | 신규 | 7 | #163 |
| 27 | `services/siw/airflow/requirements.txt` | 수정 | 7 | #163 |
| 28 | `services/siw/src/lib/rag/trend-comparison.ts` | 신규 | 9 | #163 |
| 29 | `services/siw/tests/unit/vector-search.test.ts` | 신규 | 10 | #163 |
| 30 | `services/siw/tests/unit/trend-comparison.test.ts` | 신규 | 10 | #163 |
| 31 | `services/siw/tests/api/trends-route-rag.test.ts` | 신규 | 10 | #163 |
| 32 | `services/siw/airflow/tests/test_job_crawl_dag.py` | 신규 | 10 | #163 |
| 33 | `services/siw/airflow/.ai.md` | 수정 | 10 | #163 |
| 34 | `.env.example` | 수정 | 5,10 | #97,#163 |

**Total: 32 files (16 신규, 16 수정)**

---

## 전체 완료 기준

- [ ] #97 AC 1-6 전체 충족 (Step 5 checkpoint)
- [ ] #163 AC 1-6 전체 충족 (Step 10)
- [ ] `ENABLE_RAG` 미설정 시 기존 전체 테스트 통과
- [ ] `ENABLE_RAG=true` 시 RAG 기능 정상 동작
- [ ] 다른 팀원 서비스 코드 변경 없음
- [ ] 기존 엔진 엔드포인트 시그니처 변경 없음
