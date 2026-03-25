# [#221] feat: [seung] RAG 컨텍스트 통합 — 합격 자소서 유사도 검색으로 면접 질문·진단 품질 향상 — 구현 계획

> 작성: 2026-03-25

---

## 단계 요약

| Step | 작업 | 변경 파일 수 |
|------|------|-------------|
| 1 | RAG 모듈 생성 (`rag-prisma.ts`, `embedding-client.ts`, `resume-search.ts`, `.ai.md`) | 4개 신규 |
| 2 | `engine-client.ts` 수정 — `callEngineQuestions`에 `resumeContext?` 추가, `callEngineFeedback` 추출 | 1개 수정 |
| 3 | `resume/questions/route.ts` — RAG 파이프라인 삽입 (analyze 후, Promise.all 전) | 1개 수정 |
| 4 | `resume/feedback/route.ts` — `callEngineFeedback`으로 교체 + RAG 파이프라인 삽입 | 1개 수정 |
| 5 | 테스트 수정 — RAG mock 추가, feedback mock 방식 변경, RAG 케이스 추가 | 2개 수정 |
| 6 | `.ai.md` 최신화, 환경변수 파일 업데이트 | 2개 수정 |

---

## 완료 기준

- [ ] `ENABLE_RAG=true` 설정 시 `/api/resume/questions` 엔진 호출에 `resume_context`(합격 자소서 TOP 5 content 배열) 포함
- [ ] `ENABLE_RAG=true` 설정 시 `/api/resume/feedback` 엔진 호출에 `resume_context` 포함
- [ ] `ENABLE_RAG=false`(기본값) 시 기존 동작 완전 유지 — 기존 테스트 전체 통과

---

## 구현 계획

### 전제 파악

**참조 구현 (siw):**
- `embedding-client.ts`: `embedText(text)` — `ENABLE_RAG !== 'true'` 시 null 반환, 엔진 `/api/embed` 호출
- `resume-search.ts`: `searchSimilarAcceptedResumes(embedding, jobRole?, topK)` — `ragPrisma.$queryRaw` + pgvector
- `rag-prisma.ts`: `RAG_DATABASE_URL` 환경변수로 분리된 Prisma 클라이언트

**seung 현재 상태:**
- `src/lib/engine-client.ts`: `callEngineQuestions(resumeText, targetRole?)` — resume_context 없음
- `resume/questions/route.ts`: analyze → questions + DB 병렬 실행, RAG 없음
- `resume/feedback/route.ts`: 직접 `fetch(engineUrl/api/resume/feedback, ...)`, RAG 없음
- 테스트는 `tests/api/questions.test.ts`, `tests/api/resume-feedback.test.ts`

**seung 특이사항:**
- siw는 `ENABLE_RAG` + `ENABLE_RESUME_RAG` 두 가지 플래그 사용 → seung은 `ENABLE_RAG`만 사용
- feedback 라우트는 engine-client를 거치지 않고 직접 fetch → callEngineFeedback으로 추출 필요

---

### Step 1: RAG 모듈 생성 (`services/seung/src/lib/rag/`)

**1-1. `src/lib/rag/rag-prisma.ts`**

siw 패턴 그대로 복사. `RAG_DATABASE_URL` 환경변수로 별도 Prisma 클라이언트 생성.

```ts
// RAG 전용 Prisma 클라이언트 — 공용 Supabase (RAG_DATABASE_URL)
// accepted_resume_embeddings 테이블 접근용
```

**1-2. `src/lib/rag/embedding-client.ts`**

siw 패턴에서 `ENABLE_RESUME_RAG` 조건 제거, `ENABLE_RAG`만 사용.
- `embedText(text)`: `ENABLE_RAG !== 'true'` 시 null 반환
- `fetchTrendSkills` 스텁 불필요 → 포함하지 않음

**1-3. `src/lib/rag/resume-search.ts`**

siw `resume-search.ts` 그대로 복사. import 경로만 `@/lib/rag/rag-prisma` → `@/lib/rag/rag-prisma`로 동일.

**1-4. `src/lib/rag/.ai.md`**

모듈 목적·구조·역할 문서화.

---

### Step 2: `engine-client.ts` 수정

`callEngineQuestions`에 `resumeContext?: string[]` 파라미터 추가:

```ts
export async function callEngineQuestions(
  resumeText: string,
  targetRole?: string,
  resumeContext?: string[]
): Promise<Response>
```

body에 `...(resumeContext ? { resume_context: resumeContext } : {})` 추가.

`callEngineFeedback` 함수 추출 (기존 feedback 라우트의 직접 fetch 코드):

```ts
export async function callEngineFeedback(
  resumeText: string,
  targetRole: string,
  resumeContext?: string[]
): Promise<Response>
```

---

### Step 3: `/api/resume/questions/route.ts` 수정

Step 2 (analyze 완료 후, questions 호출 전)에 RAG 파이프라인 삽입:

```
ENABLE_RAG=true?
  └─ embedText(resumeText)
       ├─ 성공: searchSimilarAcceptedResumes(vector, targetRole, 5)
       │         └─ resume_context = results.map(r => r.content)
       └─ 실패(null): resume_context = undefined (graceful degradation)
```

라우트에서 호출 시 **반드시 조건부로** 3번째 인자 전달:

```ts
// ✅ resumeContext가 있을 때만 3번째 인자 전달
resume_context
  ? callEngineQuestions(resumeText, targetRole, resume_context)
  : callEngineQuestions(resumeText, targetRole)
```

> **[치명 주의] `toHaveBeenCalledWith` 호환성**: `callEngineQuestions(text, role, undefined)`처럼 항상 3번째 인자를 전달하면 기존 테스트 `toHaveBeenCalledWith(text, role)` (2개 인자)가 실패한다. 조건부 호출로 ENABLE_RAG=false 경로에서 기존 테스트가 수정 없이 통과하도록 보장한다.

임베딩/검색 실패 시 catch → 로그 출력 + resume_context=undefined로 진행 (기존 동작 유지).

RAG 파이프라인 의사코드:
```ts
let resume_context: string[] | undefined
if (process.env.ENABLE_RAG === 'true') {
  try {
    const embedding = await embedText(resumeText)
    if (embedding) {
      const hits = await searchSimilarAcceptedResumes(embedding.vector, targetRole, 5)
      resume_context = hits.map(r => r.content)
    }
  } catch (err) {
    console.error('[resume/questions] RAG pipeline failed, degrading', { err })
  }
}
```

> **주의:** 현재 `callEngineQuestions`와 `prisma.resume.create`를 `Promise.all`로 병렬 실행 중.
> RAG 파이프라인은 `callEngineQuestions` 호출 전에 완료되어야 하므로, RAG 단계를 병렬 블록 **앞**에서 먼저 실행 (직렬 레이턴시 추가 감수).

---

### Step 4: `/api/resume/feedback/route.ts` 수정

직접 `fetch` 코드를 `callEngineFeedback`으로 교체.
RAG 파이프라인 삽입 (resume DB 조회 후, 엔진 호출 전):

```
ENABLE_RAG=true?
  └─ embedText(resume.resumeText)
       ├─ 성공: searchSimilarAcceptedResumes(vector, targetRole, 5)
       │         └─ resume_context = results.map(r => r.content)
       └─ 실패: resume_context = undefined
```

`callEngineFeedback(resume.resumeText, targetRole.trim(), resume_context)` 호출.

---

### Step 5: 테스트 작성

**`tests/api/questions.test.ts` 수정** (기존 테스트 통과 확인 + RAG 케이스 추가):

기존 mock 확장:
```ts
const { mockEmbedText, mockSearchSimilarAcceptedResumes } = vi.hoisted(...)
vi.mock('@/lib/rag/embedding-client', () => ({ embedText: mockEmbedText }))
vi.mock('@/lib/rag/resume-search', () => ({ searchSimilarAcceptedResumes: mockSearchSimilarAcceptedResumes }))
```

추가할 테스트 케이스:
- `ENABLE_RAG=false` → `callEngineQuestions` 호출 시 `resume_context` 없이 기존 인자만 전달 (기존 테스트 통과)
- `ENABLE_RAG=true` + 임베딩 성공 → `callEngineQuestions`에 `resume_context: string[]` 전달
- `ENABLE_RAG=true` + 임베딩 실패(null) → `resume_context` 없이 graceful degradation
- `ENABLE_RAG=true` + 검색 실패(throw) → `resume_context` 없이 graceful degradation, 200 반환

**`tests/api/resume-feedback.test.ts` 수정** (callEngineFeedback 교체로 인한 mock 방식 변경 + RAG 케이스):

```ts
vi.mock('@/lib/engine-client', () => ({ callEngineFeedback: mockCallEngineFeedback }))
vi.mock('@/lib/rag/embedding-client', () => ({ embedText: mockEmbedText }))
vi.mock('@/lib/rag/resume-search', () => ({ searchSimilarAcceptedResumes: mockSearchSimilarAcceptedResumes }))
```

> **기존 테스트 마이그레이션 전체 범위**: 현재 테스트 10개가 `global.fetch = mockFetch`로 직접 fetch를 모킹하고 `mockFetch.mock.calls[0]`로 URL/body/signal을 검증 중. `callEngineFeedback` 추출 후 변환 방향:
> - `mockFetch.mockResolvedValueOnce({ok, status, json})` → `mockCallEngineFeedback.mockResolvedValueOnce(makeMockResponse(ok, status, data))`
> - `mockFetch.mock.calls[0][0].toContain('/api/resume/feedback')` 검증 → 불필요 (engine-client에서 처리)
> - `JSON.parse(mockFetch.mock.calls[0][1].body).resumeText` 검증 → `expect(mockCallEngineFeedback).toHaveBeenCalledWith(resumeText, targetRole)`
> - `mockFetch.mock.calls[0][1].signal` signal 검증 → engine-client 테스트 범주로 이동, route 테스트에서 제거
> - `expect(mockFetch).not.toHaveBeenCalled()` → `expect(mockCallEngineFeedback).not.toHaveBeenCalled()`

추가할 테스트 케이스:
- `ENABLE_RAG=false` → `callEngineFeedback` 호출 시 2개 인자만 전달 (`resume_context` 미전달)
- `ENABLE_RAG=true` + 임베딩 성공 → `callEngineFeedback`에 `resume_context: string[]` 전달
- `ENABLE_RAG=true` + 임베딩 실패(null) → graceful degradation, 200 반환
- `ENABLE_RAG=true` + 검색 throw → graceful degradation, 200 반환

---

### Step 6: `.ai.md` 최신화 + 환경변수 파일 업데이트

- `services/seung/src/lib/rag/.ai.md` 생성
- `services/seung/.ai.md` (또는 `services/seung/src/lib/.ai.md`) 최신화
- `.env.example` 또는 `services/seung/.env.local.example`에 `ENABLE_RAG`, `RAG_DATABASE_URL` 항목 추가

---

### 파일 변경 목록

| 파일 | 변경 유형 |
|------|-----------|
| `services/seung/src/lib/rag/rag-prisma.ts` | 신규 생성 |
| `services/seung/src/lib/rag/embedding-client.ts` | 신규 생성 |
| `services/seung/src/lib/rag/resume-search.ts` | 신규 생성 |
| `services/seung/src/lib/rag/.ai.md` | 신규 생성 |
| `services/seung/src/lib/engine-client.ts` | 수정 (callEngineQuestions 파라미터 추가, callEngineFeedback 추출) |
| `services/seung/src/app/api/resume/questions/route.ts` | 수정 (RAG 파이프라인 삽입) |
| `services/seung/src/app/api/resume/feedback/route.ts` | 수정 (callEngineFeedback 교체 + RAG 파이프라인) |
| `services/seung/tests/api/questions.test.ts` | 수정 (RAG mock + 테스트 케이스 추가) |
| `services/seung/tests/api/resume-feedback.test.ts` | 수정 (mock 방식 전면 변경 + RAG 테스트 케이스 추가) |
| `services/seung/.ai.md` | 최신화 |
| `services/seung/.env.local.example` (또는 루트 `.env.example`) | 환경변수 항목 추가 |

---

### 주의사항

1. **불변식 준수**: 임베딩 생성(AI 호출)은 엔진 `/api/embed` 경유, 벡터 검색은 seung 서비스가 직접 ragPrisma로 수행
2. **Graceful degradation 필수**: RAG 실패 시 기존 동작 유지, 에러 전파 금지
3. **기존 테스트 전체 통과**: `ENABLE_RAG` 미설정(=false) 기본값에서 기존 동작 변경 없음
4. **`callEngineQuestions` 시그니처 변경**: 기존 테스트에서 인자 검증 케이스가 있으므로, `resumeContext` 없을 때 body에 `resume_context` 키 자체를 포함하지 않아야 함
