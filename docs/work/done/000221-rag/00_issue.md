# feat: [seung] RAG 컨텍스트 통합 — 합격 자소서 유사도 검색으로 면접 질문·진단 품질 향상

## 사용자 관점 목표
합격 자소서 999건 벡터 DB를 활용해 유사 사례를 면접 질문 생성·서류 진단에 주입함으로써, 더 날카롭고 실전적인 모의면접 경험을 제공한다.

## 배경
seung 서비스는 자소서 기반 모의면접 시스템이다. 현재 엔진 호출 시 사용자의 자소서 텍스트만 전달하며, `accepted_resume_embeddings` 테이블에 적재된 합격 자소서 999건 벡터 DB를 활용하지 않는다.

siw 서비스에서 구현된 RAG 패턴(`services/siw/src/lib/rag/`)을 seung 서비스에 적용하여:
1. 면접 질문 생성(`/api/resume/questions`) 시 합격 자소서 유사 사례를 `resume_context`로 주입
2. 서류 진단(`/api/resume/feedback`) 시 동일한 RAG 컨텍스트를 엔진에 전달해 더 정확한 강점·약점·개선 방향 제공

### 현재 상태
- `src/lib/engine-client.ts`: `callEngineAnalyze`, `callEngineQuestions` — RAG 없이 resumeText만 전달
- `src/app/api/resume/questions/route.ts`: 엔진 `/api/resume/questions` 호출 시 `resume_context` 미전달
- `src/app/api/resume/feedback/route.ts`: 엔진 `/api/resume/feedback` 호출 시 `resume_context` 미전달
- RAG 관련 코드 없음 (`rag/` 디렉터리 없음, `ENABLE_RAG` 환경변수 없음)

### RAG 인프라 현황
- `accepted_resume_embeddings` 테이블: baai/bge-m3 1024차원, `job_role` 컬럼 포함, 999건 적재 완료
- 엔진 `POST /api/embed`: `{ texts: string[] }` → `{ embeddings: number[][], model, usage }`
- 엔진 `POST /api/resume/feedback`: `resume_context` 파라미터 지원

## 완료 기준
- [x] `ENABLE_RAG=true` 설정 시 `/api/resume/feedback` 엔진 호출에 `resume_context` 포함
- [x] `ENABLE_RAG=false`(기본값) 시 기존 동작 완전 유지 — 기존 테스트 전체 통과
- N/A `/api/resume/questions` — 엔진이 `resume_context` 미지원(QuestionsRequest 스키마 없음), 질문 생성은 자소서 텍스트 자체를 파고드는 방식이므로 RAG 불필요로 판단·제외

## 구현 플랜

### 1. RAG 모듈 추가 (`src/lib/rag/`)
siw 패턴(`services/siw/src/lib/rag/`) 복사·적용:
- `embedding-client.ts`: `embedText(text)` — 엔진 `/api/embed` 호출, `ENABLE_RAG !== 'true'` 시 null 반환
- `resume-search.ts`: `searchSimilarAcceptedResumes(embedding, jobRole?, topK)` — `ragPrisma.$queryRaw` + pgvector cosine similarity
- `rag-prisma.ts`: RAG DB 전용 Prisma 클라이언트 (`RAG_DATABASE_URL` 환경변수)
- `.ai.md`: 모듈 목적·구조·역할 문서화

### 2. `/api/resume/feedback` 라우트 업데이트
- 동일한 RAG 파이프라인으로 `resume_context` 주입
- `ENABLE_RAG=false` 시 기존 동작 유지

### 4. 환경변수 추가
- `ENABLE_RAG=true/false` (기본 false, feature flag)
- `RAG_DATABASE_URL`: pgvector DB 접속 URL (`.env.local` 추가)

### 5. 테스트 추가
- `ENABLE_RAG=false` → `resume_context` 미전달 확인
- `ENABLE_RAG=true` + 임베딩 성공 → `resume_context` 전달 확인
- `ENABLE_RAG=true` + 임베딩 실패 → graceful degradation (resume_context 없이 정상 호출)

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] `src/lib/rag/.ai.md` 생성
- [ ] `services/seung/.ai.md` 최신화
- [ ] 불변식 위반 없음 (엔진은 seung 서비스에서만 호출, RAG DB는 서비스가 직접 쿼리)

---

## 작업 내역

### 신규 파일
- `src/lib/rag/rag-prisma.ts` — RAG 전용 Prisma 클라이언트 (`RAG_DATABASE_URL` 환경변수 사용)
- `src/lib/rag/embedding-client.ts` — `embedText()`: 엔진 `/api/embed` 호출, `ENABLE_RAG !== 'true'` 시 null 반환
- `src/lib/rag/resume-search.ts` — `searchSimilarAcceptedResumes()`: pgvector cosine similarity, jobRole 필터 지원
- `src/lib/rag/.ai.md` — RAG 모듈 목적·구조 문서화

### 수정 파일
- `src/lib/engine-client.ts` — `callEngineFeedback` 함수 추출 (기존 직접 fetch 대체, `resumeContext?: string[]` 지원)
- `src/app/api/resume/feedback/route.ts` — RAG 파이프라인 삽입 (소유권 검증 후), `callEngineFeedback` 사용으로 교체
- `tests/api/resume-feedback.test.ts` — `global.fetch` 모킹 → `vi.mock('@/lib/engine-client')` 전면 교체, RAG 테스트 5개 추가

### 주요 결정 사항
- **questions RAG 제외**: 엔진 `QuestionsRequest` 스키마가 `resume_context` 미지원, 면접 질문은 자소서 텍스트 자체를 파고드는 방식이므로 RAG 불필요로 판단
- **RAG 이중 가드**: `ENABLE_RAG=true` + `RAG_DATABASE_URL` 모두 충족 시에만 실행 — RAG DB 미설정 시 silent failure 방지
- **Graceful degradation**: 임베딩 실패·검색 실패 모두 try-catch로 처리, resume_context 없이 정상 엔진 호출 유지
- **ternary 유지**: `toHaveBeenCalledWith` 인자 수 검사 호환을 위해 `resumeContext` 있을 때만 3번째 인자 전달

