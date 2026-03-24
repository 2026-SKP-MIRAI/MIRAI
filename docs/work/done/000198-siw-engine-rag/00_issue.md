# feat: [siw][engine] 합격 자소서 RAG 컨텍스트 — LLM 평가 기준 내재화

## 사용자 관점 목표
자소서 평가 시 LLM이 "좋은 자소서란 이런 것이다"라는 실제 합격 사례를 참고하여 평가한다. 추상적 기준이 아닌 실증적 기준으로 점수와 피드백이 생성된다.

## 배경

### 핵심 문제: LLM 평가 기준의 공허함
현재 `/api/resume/feedback`는 LLM이 "이 자소서의 구체성은 72점입니다"를 반환하지만, 이 72점의 **기준**이 없다. 무엇과 비교해서 72점인가? 합격 자소서와 비교한 건가, 아니면 LLM이 학습 데이터에서 막연히 추정한 건가?

보유 중인 합격 자소서 1,000개는 이 문제를 해결하는 핵심 자산이다.
"합격한 자소서들이 이 정도 수준이었으니, 이 자소서는 그 기준에서 어떤가?"라는
실증적 평가 기준을 LLM에게 제공할 수 있다.

### 아키텍처 결정 (ADR — #163 패턴 동일 적용)
- **임베딩 생성** = 엔진 `/api/embed` 경유 (불변식: 외부 AI API는 엔진에서만)
- **벡터 DB 검색** = siw가 `ragPrisma.$queryRaw`로 직접 수행 (불변식: DB는 서비스 소유)
- **컨텍스트 주입** = siw가 검색된 합격 자소서를 `resume_context`로 엔진 재호출
- 엔진은 stateless 유지

### DB 분리 결정 (2026-03-23 확정)
- `accepted_resume_embeddings`는 **공용 Supabase** (`RAG_DATABASE_URL`)에 저장
- 개인 Supabase (`DATABASE_URL`)에는 저장하지 않음 → 팀원 모두 동일 합격 자소서 데이터 사용
- `schema.prisma`에 Prisma 모델 추가하지 않음 — `ragPrisma.$queryRaw`로 직접 쿼리
- DDL은 `services/siw/airflow/sql/004_accepted_resumes.sql` (→ #163에서 이미 생성됨)
- 공용 Supabase: `RAG_DATABASE_URL` 환경변수로 설정 (팀 공유)

선행 조건: **#163 merge 완료 후 시작** (#197 완료, #163 pgvector 인프라 + 공용 Supabase 확정)

## 완료 기준

### 합격 자소서 임베딩 인덱스 구축
- [x] `accepted_resume_embeddings` 테이블 — 공용 Supabase에 DDL 적용 확인 (#163에서 사전 생성)
- [x] 합격 자소서 1,000개 → 엔진 `/api/embed` 배치 호출 → pgvector upsert 스크립트 완료 (`engine/scripts/build_resume_index.py` 작성 완료, 실행은 RAG_DATABASE_URL + 데이터 파일 필요)
- [x] `services/siw/src/lib/rag/resume-search.ts` — pgvector cosine similarity 검색 함수

### LLM 평가 컨텍스트 주입
- [x] `engine/app/schemas.py` — `ResumeFeedbackRequest`에 `resume_context: list[str] | None = None` 추가
- [x] `engine/app/services/feedback_service.py` — `resume_context` 있을 때 LLM 프롬프트에 합격 자소서 예시 주입
- [x] `resume_context=None` 시 엔진 기존 동작 100% 유지 (backward compatible)
- [x] `ENABLE_RESUME_RAG=true` 시 siw가 TOP 5 유사 합격 자소서를 `resume_context`로 엔진 재호출
- [x] pytest + vitest 커버리지 80% 이상

## 구현 플랜

**1단계: DDL 확인 (신규 작업 없음)**
- `services/siw/airflow/sql/004_accepted_resumes.sql` → #163에서 이미 생성
- 공용 Supabase에 테이블 존재 여부 확인 후 진행

**2단계: `engine/scripts/build_resume_index.py` (1회성 빌드)**
```python
# 합격 자소서 JSON → 엔진 /api/embed 배치(100개) → 공용 Supabase(RAG_DATABASE_URL) upsert
```

**3단계: `services/siw/src/lib/rag/resume-search.ts`**
```typescript
// #163 vector-search.ts와 동일한 ragPrisma.$queryRaw 패턴
export async function searchSimilarAcceptedResumes(
  embedding: number[],
  jobRole?: string,
  topK = 5
): Promise<AcceptedResumeResult[]>
```

**4단계: 엔진 `resume_context` 파라미터 추가**
```python
# engine/app/schemas.py
class ResumeFeedbackRequest(BaseModel):
    resume_text: str
    target_role: str | None = None
    resume_context: list[str] | None = None  # 합격 자소서 예시 (optional)

# engine/app/services/feedback_service.py
def build_prompt(resume_text, target_role, resume_context=None):
    base_prompt = FEEDBACK_SYSTEM_PROMPT
    if resume_context:
        examples = "\n\n---\n".join(resume_context[:5])
        base_prompt += f"\n\n[참고 — 유사 직무 합격 자소서 예시]\n{examples}"
    return base_prompt
```

**5단계: `services/siw/src/app/api/resumes/[id]/feedback/route.ts` 수정**
```typescript
// ENABLE_RESUME_RAG=true 경로
const embResult = await embedText(resumeText)
if (!embResult) return fallback()

const acceptedResumes = await searchSimilarAcceptedResumes(embResult.embedding, inferredTargetRole, 5)
const resumeContext = acceptedResumes.map(r => r.content)

// 엔진 재호출 — resume_context 포함
const feedback = await fetchFeedback({ resumeText, targetRole, resumeContext })
```

## LLM 프롬프트 효과

```
[현재] LLM: "구체성이 부족합니다. 수치를 넣으세요." (기준 없음)

[#198 적용 후]
LLM: 아래 유사 직무 합격 자소서를 참고하여 평가해주세요.
--- 합격 예시 1 ---
"React 기반 대시보드에서 렌더링 최적화로 로딩 속도 40% 개선, 월간 활성 사용자 2,000명 달성"
--- 합격 예시 2 ---
...
→ LLM: "합격 자소서에는 구체적 수치(40%, 2,000명)가 있는 반면, 이 자소서는..."
```

## 개선 효과 측정 지표

| 지표 | 현재 | 목표 | 측정 방법 |
|------|------|------|---------|
| 평가 근거 구체성 | 추상적 기준 ("구체성 부족") | 합격 예시 비교 언급 | 수동 검토: 피드백 10건 중 합격 예시 참조 비율 |
| 점수 편차 (동일 자소서 5회) | ±10~20점 | ±5점 이하 (컨텍스트 고정 효과) | 동일 자소서 5회 호출 → 표준편차 |
| resume_context=None fallback | - | 100% (기존 동작 유지) | vitest: ENABLE_RESUME_RAG=false mock |

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `services/siw/airflow/sql/004_accepted_resumes.sql` | #163에서 사전 생성 — 확인만 |
| `engine/scripts/build_resume_index.py` | 신규 생성 (1회성 적재 스크립트) |
| `services/siw/src/lib/rag/resume-search.ts` | 신규 생성 |
| `engine/app/schemas.py` | `resume_context` 파라미터 추가 |
| `engine/app/services/feedback_service.py` | 합격 자소서 예시 프롬프트 주입 |
| `services/siw/src/app/api/resumes/[id]/feedback/route.ts` | resume_context 주입 |
| `services/siw/.env.example` | ENABLE_RESUME_RAG 추가 |
| `services/siw/.ai.md` | 최신화 |
| `engine/.ai.md` | resume_context 파라미터 계약 추가 |

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 불변식 준수: 임베딩 생성은 엔진, DB 검색은 siw (`ragPrisma.$queryRaw`)
- [x] `resume_context=None` 시 기존 동작 100% 유지
- [x] build_resume_index.py 실행 가이드 주석 포함
- [x] `engine/.ai.md` 최신화 (resume_context 파라미터 계약)


---

## 작업 내역

### 2026-03-24

**현황**: 10/10 완료

**완료된 항목**:
- `accepted_resume_embeddings` 테이블 DDL 적용 확인 (#163 사전 생성)
- `engine/scripts/build_resume_index.py` — 배치 임베딩 upsert 스크립트 작성 완료 (배치 100개, dry-run 지원, 재시도 1회)
- `services/siw/src/lib/rag/resume-search.ts` — pgvector cosine similarity 검색 함수 신규 생성
- `engine/app/schemas.py` — `resume_context: list[str] | None = None` 추가
- `engine/app/services/feedback_service.py` — 합격 자소서 예시 프롬프트 주입 (최대 5개, XSS 방지, 로그 추가)
- `resume_context=None` 시 기존 동작 100% 유지 (backward compatible)
- `ENABLE_RESUME_RAG=true` 시 siw TOP 5 검색 → `resume_context`로 엔진 재호출 (임베딩 1회 공유)
- pytest (engine) 31/31 통과
- vitest (siw) 신규 테스트 10/10 통과
- `engine/.ai.md` — `/api/resume/feedback` 계약에 `resume_context` 파라미터 추가
- `services/siw/.env.example` — `ENABLE_RESUME_RAG=false` 항목 추가
- 실제 데이터 적재: `build_resume_index.py`로 999개 Supabase upsert 완료 (RAG_DATABASE_URL 환경변수 필요)
- **[코드 리뷰 수정]** `embedding-client.ts` — CRITICAL 버그 수정: `ENABLE_RAG` guard만 체크하여 `ENABLE_RESUME_RAG=true` 단독 사용 시 임베딩이 null 반환하는 문제 → `ENABLE_RAG !== "true" && ENABLE_RESUME_RAG !== "true"` 조건으로 수정
- **[코드 리뷰 수정]** `route.ts` — HIGH: 합격 자소서 검색 결과에 similarity 필터 누락 → 채용공고와 동일하게 `MIN_SIMILARITY` (0.6) threshold 적용

**변경 파일**:
- `engine/app/schemas.py`
- `engine/app/services/feedback_service.py`
- `engine/app/routers/resume.py`
- `engine/pyproject.toml`
- `engine/.ai.md`
- `engine/scripts/build_resume_index.py` (신규)
- `engine/tests/unit/services/test_feedback_service.py` (테스트 추가)
- `engine/tests/integration/test_resume_feedback_router.py` (테스트 추가)
- `services/siw/src/lib/rag/resume-search.ts` (신규)
- `services/siw/src/lib/rag/__tests__/resume-search.test.ts` (신규)
- `services/siw/src/app/api/resumes/route.ts`
- `services/siw/src/app/api/resumes/__tests__/route.test.ts` (테스트 추가)
- `services/siw/.env.example`
- `services/siw/src/lib/rag/.ai.md`

