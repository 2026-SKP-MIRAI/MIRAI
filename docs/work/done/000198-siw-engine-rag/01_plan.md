# [#198] feat: [siw][engine] 합격 자소서 RAG 컨텍스트 — LLM 평가 기준 내재화 — 구현 계획

> 작성: 2026-03-24

---

## 완료 기준

### 합격 자소서 임베딩 인덱스 구축
- [x] `accepted_resume_embeddings` 테이블 — 공용 Supabase에 DDL 적용 확인 (#163에서 사전 생성)
- [x] 합격 자소서 1,000개 → 엔진 `/api/embed` 배치 호출 → pgvector upsert 스크립트 완료 (`engine/scripts/build_resume_index.py`)
- [x] `services/siw/src/lib/rag/resume-search.ts` — pgvector cosine similarity 검색 함수

### LLM 평가 컨텍스트 주입
- [x] `engine/app/schemas.py` — `ResumeFeedbackRequest`에 `resume_context: list[str] | None = None` 추가
- [x] `engine/app/services/feedback_service.py` — `resume_context` 있을 때 LLM 프롬프트에 합격 자소서 예시 주입
- [x] `resume_context=None` 시 엔진 기존 동작 100% 유지 (backward compatible)
- [x] `ENABLE_RESUME_RAG=true` 시 siw가 TOP 5 유사 합격 자소서를 `resume_context`로 엔진 재호출
- [x] pytest + vitest 커버리지 80% 이상

---

## 전제 조건 확인 (코드베이스 분석 결과)

### 모델 결정 (고정)
- **임베딩 모델: `baai/bge-m3`** (OpenRouter, 1024차원) — 변경 불가
- esco, xlm-r, minilm 등 로컬 모델은 사용하지 않는다
- `accepted_resume_embeddings.embedding` 컬럼이 `vector(1024)`로 생성됨 → 반드시 1024차원 벡터 사용

### 핵심 파일 현황
| 파일 | 상태 | 적용 패턴 |
|------|------|---------|
| `engine/app/schemas.py` | `job_context: list[str] \| None` 존재 | `resume_context` 동일 패턴 추가 |
| `engine/app/services/feedback_service.py` | `_build_prompt(job_context)` 주입 패턴 존재 | `resume_context` 동일 패턴 추가 |
| `services/siw/src/lib/rag/vector-search.ts` | `searchSimilarPostings` + `ragPrisma.$queryRaw` 확립 | `searchSimilarAcceptedResumes` 동일 패턴 |
| `services/siw/src/app/api/resumes/route.ts` | `fetchFeedback(text, role, jobContext?)` 존재 | `resumeContext?` 파라미터 추가 |
| `services/siw/airflow/sql/004_accepted_resumes.sql` | **이미 생성됨** (ivfflat, vector(1024)) | 확인 완료 ✓ |

---

## 구현 계획

### Track A — Engine 변경 (독립, 병렬 가능)

**파일:**
- `engine/app/schemas.py`
- `engine/app/services/feedback_service.py`
- `engine/app/routers/resume.py`
- `engine/tests/unit/services/test_feedback_service.py`
- `engine/tests/integration/test_resume_router.py` (또는 기존 통합 테스트 파일)
- `engine/.ai.md`

#### Step A-1: `engine/app/schemas.py`

`ResumeFeedbackRequest`에 `resume_context` 필드 추가:

```python
class ResumeFeedbackRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=50_000)
    targetRole: str | None = Field(None, max_length=100)
    job_context: list[str] | None = Field(None, description="채용공고 컨텍스트 (RAG)")
    resume_context: list[str] | None = Field(None, description="합격 자소서 예시 컨텍스트 (RAG)")  # 신규
```

#### Step A-2: `engine/app/services/feedback_service.py`

`_build_prompt` 시그니처 + 본문 확장:

```python
def _build_prompt(
    resume_text: str,
    target_role: str,
    job_context: list[str] | None = None,
    resume_context: list[str] | None = None,   # 신규
) -> str:
    ...
    # 기존 job_context 블록 유지
    if job_context:
        context_block = "\n\n## 관련 채용공고 컨텍스트\n"
        for i, ctx in enumerate(job_context, 1):
            safe_ctx = ctx[:2000].replace("<", "&lt;").replace(">", "&gt;")
            context_block += f"{i}. {safe_ctx}\n"
        context_block += "\n위 채용공고들을 참고하여 자소서의 직무 적합성을 평가해주세요."
        prompt += context_block

    # 신규: resume_context 블록
    if resume_context:
        resume_block = "\n\n## 유사 직무 합격 자소서 예시\n"
        resume_block += "아래는 유사 직무에서 실제로 합격한 자소서 발췌입니다. "
        resume_block += "이 예시들을 평가 기준으로 참고하세요.\n"
        for i, ctx in enumerate(resume_context[:5], 1):
            safe_ctx = ctx[:3000].replace("<", "&lt;").replace(">", "&gt;")
            resume_block += f"\n### 합격 예시 {i}\n{safe_ctx}\n"
        resume_block += "\n위 합격 자소서들과 비교하여 이 자소서를 평가해주세요."
        prompt += resume_block

    return prompt
```

`generate_resume_feedback` 시그니처 확장:

```python
def generate_resume_feedback(
    resume_text: str,
    target_role: str | None = None,
    *,
    model: str | None = None,
    job_context: list[str] | None = None,
    resume_context: list[str] | None = None,   # 신규
) -> tuple[ResumeFeedbackResponse, UsageMetadata | None]:
    role_label = target_role.strip() if target_role and target_role.strip() else "미지정 직무"
    prompt = _build_prompt(resume_text, role_label, job_context, resume_context)
    ...
```

#### Step A-3: `engine/app/routers/resume.py`

라우터 호출부에 `resume_context` 전달 확인 (기존 `job_context` 전달 코드와 동일 패턴):

```python
feedback, usage = generate_resume_feedback(
    body.resumeText,
    body.targetRole,
    job_context=body.job_context,
    resume_context=body.resume_context,   # 신규
)
```

#### Step A-4: 테스트 (pytest, 목표 80%)

```python
# test_feedback_service.py 추가 케이스
def test_build_prompt_resume_context_injected():
    """resume_context 있을 때 프롬프트에 합격 예시 블록 포함"""
    prompt = _build_prompt("자소서", "백엔드", resume_context=["예시1", "예시2"])
    assert "합격 자소서 예시" in prompt
    assert "예시1" in prompt

def test_build_prompt_resume_context_none_unchanged():
    """resume_context=None 시 기존 프롬프트와 동일"""
    p1 = _build_prompt("자소서", "백엔드")
    p2 = _build_prompt("자소서", "백엔드", resume_context=None)
    assert p1 == p2

def test_build_prompt_both_contexts():
    """job_context + resume_context 동시 → 둘 다 포함"""
    prompt = _build_prompt("자소서", "백엔드",
                           job_context=["공고1"], resume_context=["합격1"])
    assert "채용공고" in prompt
    assert "합격 자소서" in prompt

def test_resume_context_capped_at_5():
    """resume_context 6개 전달 → 최대 5개만 사용"""
    prompt = _build_prompt("자소서", "백엔드",
                           resume_context=[f"예시{i}" for i in range(6)])
    assert "예시5" not in prompt or prompt.count("합격 예시") <= 5

# test_resume_router.py (integration)
def test_feedback_with_resume_context(mock_llm):
    """resume_context 포함 요청 → 200, scores 반환"""

def test_feedback_without_resume_context_backward_compat(mock_llm):
    """resume_context 없는 기존 요청 → 100% 동일 동작"""
```

#### Step A-5: `engine/.ai.md` 최신화

`ResumeFeedbackRequest`에 `resume_context` 파라미터 계약 추가.

---

### Track B — siw RAG 변경 (독립, 병렬 가능)

**파일:**
- `services/siw/src/lib/rag/resume-search.ts` (신규)
- `services/siw/src/app/api/resumes/route.ts` (수정)
- `services/siw/src/lib/rag/__tests__/resume-search.test.ts` (신규)
- `services/siw/src/app/api/resumes/__tests__/route.test.ts` (수정)
- `services/siw/.env.example`
- `services/siw/src/lib/rag/.ai.md`

#### Step B-1: `resume-search.ts` 신규 생성

`vector-search.ts`의 `searchSimilarPostings` 패턴 그대로 적용:

```typescript
import { ragPrisma } from '@/lib/rag-prisma'

export interface AcceptedResumeResult {
  id: string
  jobRole: string
  content: string
  similarity: number
}

/**
 * 임베딩 벡터로 유사 합격 자소서 TOP K 검색
 * ragPrisma.$queryRaw + pgvector cosine similarity
 *
 * @param embedding  baai/bge-m3 벡터 (1024차원)
 * @param jobRole    직무 필터 (없으면 전체 검색)
 * @param topK       반환 최대 개수 (기본 5)
 */
export async function searchSimilarAcceptedResumes(
  embedding: number[],
  jobRole?: string,
  topK = 5
): Promise<AcceptedResumeResult[]> {
  const vectorStr = `[${embedding.join(',')}]`

  const results = jobRole
    ? await ragPrisma.$queryRaw<Array<{
        id: string; job_role: string; content: string; similarity: number
      }>>`
        WITH q AS (SELECT ${vectorStr}::vector AS qvec)
        SELECT id, job_role, content,
               1 - (embedding <=> q.qvec) AS similarity
        FROM accepted_resume_embeddings, q
        WHERE job_role = ${jobRole}
        ORDER BY embedding <=> q.qvec
        LIMIT ${topK}
      `
    : await ragPrisma.$queryRaw<Array<{
        id: string; job_role: string; content: string; similarity: number
      }>>`
        WITH q AS (SELECT ${vectorStr}::vector AS qvec)
        SELECT id, job_role, content,
               1 - (embedding <=> q.qvec) AS similarity
        FROM accepted_resume_embeddings, q
        ORDER BY embedding <=> q.qvec
        LIMIT ${topK}
      `

  return results.map((r) => ({
    id: r.id,
    jobRole: r.job_role,
    content: r.content,
    similarity: Number(r.similarity),
  }))
}
```

#### Step B-2: `resumes/route.ts` 수정

**fetchFeedback 함수 — `resumeContext` 파라미터 추가:**

```typescript
async function fetchFeedback(
  resumeText: string,
  targetRole: string,
  jobContext?: string[],
  resumeContext?: string[],    // 신규
) {
  return withEventLogging('resume_feedback', null, async (meta) => {
    const r = await fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resumeText,
        targetRole,
        ...(jobContext ? { job_context: jobContext } : {}),
        ...(resumeContext ? { resume_context: resumeContext } : {}),  // 신규
      }),
      signal: AbortSignal.timeout(35000),
    })
    if (!r.ok) return null
    const d = await r.json().catch(() => null)
    if (d?.usage) meta.usage = d.usage
    return d
  }).catch(...)
}
```

**POST 핸들러 — ENABLE_RESUME_RAG 분기 + 임베딩 공유:**

현재 구조 (변경 전):
```
enableRag → embedText(resumeText) → searchSimilarPostings → fetchFeedback(jobContext)
else      → fetchFeedback()
```

변경 후 구조:
```typescript
const enableRag = process.env.ENABLE_RAG === "true" && !!normalizedRole
const enableResumeRag = process.env.ENABLE_RESUME_RAG === "true"

// 임베딩: enableRag 또는 enableResumeRag 중 하나라도 true면 1회만 생성
const [storageKey, engineData, embResult] = await Promise.all([
  uploadResumePdf(user.id, buffer, file.name),
  withEventLogging('resume_questions', null, async (meta) => { ... }),
  (enableRag || enableResumeRag)
    ? embedText(resumeText).catch(() => null)
    : Promise.resolve(null),
])

let jobContext: string[] | undefined
let resumeContext: string[] | undefined
let trendComparison: TrendComparison | null = null

if (embResult) {
  // 채용공고 RAG + 합격 자소서 RAG 병렬 검색
  const [postings, acceptedResumes] = await Promise.all([
    enableRag
      ? searchSimilarPostings(embResult.vector, normalizedRole!, 5).catch(() => [])
      : Promise.resolve([]),
    enableResumeRag
      ? searchSimilarAcceptedResumes(embResult.vector, normalizedRole ?? undefined, 5).catch(() => [])
      : Promise.resolve([]),
  ])

  if (enableRag && postings.length > 0) {
    const relevant = postings.filter(p => p.similarity >= MIN_SIMILARITY)
    jobContext = relevant.length > 0 ? relevant.map(p => p.content) : undefined
    // trendComparison 계산 (기존 로직 유지)
    const rawSkills = extractTrendSkills(postings)
    const resumeTextLower = resumeText.toLowerCase()
    const trendSkillsWithMeta = rawSkills.map(({ skill, weight }) => ({
      skill, weight,
      inResume: resumeTextLower.includes(skill.toLowerCase()),
    }))
    const coveredCount = trendSkillsWithMeta.filter(s => s.inResume).length
    const coverageScore = trendSkillsWithMeta.length > 0
      ? Math.round((coveredCount / trendSkillsWithMeta.length) * 100)
      : 0
    trendComparison = { role: normalizedRole!, trendSkills: trendSkillsWithMeta, coverageScore }
  }

  if (enableResumeRag && acceptedResumes.length > 0) {
    resumeContext = acceptedResumes.map(r => r.content)
  }
}

feedbackJson = await fetchFeedback(resumeText, targetRole, jobContext, resumeContext)
```

**핵심 불변식:**
- `ENABLE_RESUME_RAG=false` → `resumeContext=undefined` → `fetchFeedback`에 `resume_context` 미전달 → 엔진 기존 동작 100% 유지
- 임베딩은 두 RAG 모두 활성화돼도 1회만 호출 (성능)

#### Step B-3: 테스트 (vitest)

```typescript
// resume-search.test.ts
describe('searchSimilarAcceptedResumes', () => {
  test('TOP 5 반환', async () => { ... })
  test('jobRole 필터 적용', async () => { ... })
  test('DB 오류 시 빈 배열 (try-catch 확인)', async () => { ... })
  test('결과 없을 때 빈 배열', async () => { ... })
})

// route.test.ts 추가 케이스
test('ENABLE_RESUME_RAG=false → resume_context 미전달', async () => {
  // fetchFeedback 호출 시 body에 resume_context 없음 확인
})
test('ENABLE_RESUME_RAG=true + 임베딩 성공 → resume_context 전달', async () => {
  // fetchFeedback body에 resume_context 포함 확인
})
test('ENABLE_RESUME_RAG=true + 임베딩 실패 → fallback (resume_context 없이 요청)', async () => {
  // embedText null 반환 시 resume_context 없이 정상 동작
})
test('ENABLE_RAG=true + ENABLE_RESUME_RAG=true → 임베딩 1회만 호출', async () => {
  // embedText 호출 횟수 = 1
})
```

#### Step B-4: 기타

```
services/siw/.env.example 에 추가:
  ENABLE_RESUME_RAG=false   # true: 합격 자소서 RAG (RAG_DATABASE_URL 필요)

services/siw/src/lib/rag/.ai.md 업데이트:
  resume-search.ts 파일 설명 추가
```

---

### Track C — 인덱스 빌드 스크립트 (독립)

**파일:**
- `engine/scripts/build_resume_index.py` (신규)
- `engine/requirements.txt` (psycopg2-binary 확인)

**목적:** 1회성 스크립트. 합격 자소서 JSON → 엔진 `/api/embed` 배치(100개) → `RAG_DATABASE_URL` upsert.

**설계 요구사항:**
- 입력: JSON 파일 `[{"job_role": "백엔드", "content": "...", "source": "..."}]`
- 배치 크기: 100개 (엔진 `/api/embed` max_length=100 제한 준수)
- 모델: `baai/bge-m3` 고정 (1024차원 검증)
- upsert: `ON CONFLICT DO NOTHING`
- `--dry-run` 플래그: 실제 DB 쓰기 없이 입력 검증만
- 진행률 출력: `배치 N/M: K개 처리 중...`
- 오류 복구: 배치 실패 시 해당 배치 재시도 후 skip

**의존성:**
```
# engine/requirements.txt 에 없으면 추가
psycopg2-binary>=2.9
requests>=2.28  # 이미 있을 가능성 높음
```

**실행 가이드 (스크립트 상단 docstring에 포함):**
```
환경변수:
  ENGINE_BASE_URL  = http://localhost:8000 (기본값)
  RAG_DATABASE_URL = postgresql://...     (공용 Supabase)

실행:
  cd MIRAI
  python engine/scripts/build_resume_index.py --input data/accepted_resumes.json
  python engine/scripts/build_resume_index.py --dry-run  # 검증만
```

---

## 수정 파일 최종 목록

| 파일 | 트랙 | 작업 |
|------|------|------|
| `engine/app/schemas.py` | A | `resume_context` 필드 추가 |
| `engine/app/services/feedback_service.py` | A | `_build_prompt` + `generate_resume_feedback` 확장 |
| `engine/app/routers/resume.py` | A | `resume_context=body.resume_context` 전달 |
| `engine/tests/unit/services/test_feedback_service.py` | A | resume_context 테스트 추가 |
| `engine/tests/integration/test_resume_router.py` | A | 통합 테스트 추가 |
| `engine/.ai.md` | A | resume_context 파라미터 계약 추가 |
| `services/siw/src/lib/rag/resume-search.ts` | B | 신규 생성 |
| `services/siw/src/app/api/resumes/route.ts` | B | fetchFeedback + POST 핸들러 수정 |
| `services/siw/src/lib/rag/__tests__/resume-search.test.ts` | B | 신규 생성 |
| `services/siw/src/app/api/resumes/__tests__/route.test.ts` | B | ENABLE_RESUME_RAG 케이스 추가 |
| `services/siw/.env.example` | B | ENABLE_RESUME_RAG 추가 |
| `services/siw/src/lib/rag/.ai.md` | B | resume-search.ts 항목 추가 |
| `engine/scripts/build_resume_index.py` | C | 신규 생성 |
| `engine/requirements.txt` | C | psycopg2-binary 확인/추가 |
| `engine/.ai.md` | A | resume_context 파라미터 계약 |

---

## 아키텍처 불변식 최종 체크

- [x] 임베딩 생성: `embedding-client.ts` → 엔진 `/api/embed` 경유 (AI API 직접 호출 없음)
- [x] 벡터 DB 검색: siw가 `ragPrisma.$queryRaw`로 직접 수행 (엔진은 검색 안 함)
- [x] 엔진 stateless 유지: `resume_context`는 매 요청마다 전달 (엔진이 캐시·저장 안 함)
- [x] `resume_context=None` / `ENABLE_RESUME_RAG=false` → 기존 동작 100% 유지
- [x] `baai/bge-m3` (1024차원) 외 임베딩 모델 없음
- [x] `RAG_DATABASE_URL` = 공용 Supabase (팀 공유, 개인 DB 아님)
