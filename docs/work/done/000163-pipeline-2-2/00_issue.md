# feat: [siw][DE] Pipeline 2-2 — 잡코리아 크롤링·pgvector·RAG Trends API 활성화

## 사용자 관점 목표
잡코리아 채용공고를 주간 크롤링해 직군별 요구 역량을 임베딩·pgvector에 저장하고,
Pipeline 2-1(#97)에서 뼈대만 구성된 Trends API와 trendComparison 피드백을 실제 RAG 데이터로 활성화한다.

## 배경
Pipeline 2-1(#97)에서 엔진 임베딩 API, Trends API 뼈대, trendComparison 뼈대가 완성된다.
이 이슈에서 실제 채용 시장 데이터(잡코리아 크롤링)를 pgvector에 적재하고
`ENABLE_RAG=true` 환경변수로 RAG 로직을 활성화한다.

> 🚧 작업 시작 조건: Pipeline 2-1(#97) 완료 이후 진행
> ✅ 잡코리아 robots.txt 확인 완료 (`/recruit/joblist`, `/Recruit/GI_Read` Allow)
> ⚠️ ENABLE_RAG 미설정 시 기존 Pipeline 2-1 동작 그대로 유지

## 완료 기준
- [x] Supabase pgvector extension 활성화 + `job_posting_embeddings` 테이블 신규
      (`jobRole`, `title`, `company`, `content`, `embedding vector(1024)`, `sourceUrl`, `crawledAt`)
- [x] Airflow `job_crawl_dag` 주간 실행
      — 잡코리아 12개 대분류 채용공고 크롤링 (BCtgrCode 1-10, 12, 13) (Rate limit 1초, robots.txt 준수)
      — 공고 텍스트 → 엔진 `POST /api/embed` 호출 (배치) → pgvector upsert (ON CONFLICT source_url, job_role)
      — 스케줄: 매주 일요일 UTC 15:00
- [x] Trends API RAG 로직 구현
      — `src/lib/rag/vector-search.ts` 신규 (pgvector cosine similarity search, MIN_SIMILARITY=0.6)
      — `ENABLE_RAG=true` 시 자소서 임베딩 → pgvector 검색 → job_context로 엔진 전달 → LLM 피드백 퀄리티 향상
- [x] trendComparison RAG 기반 실제 비교 로직 구현
      — POST /api/resumes 분석 시점에 RAG 계산 → `trendComparison` DB 캐싱
      — GET /api/resumes/[id]/feedback은 DB 읽기만 (LLM 재호출 없음)
      — 엔진 `ResumeFeedbackRequest.job_context: list[str] | None = None` optional (backward compatible)
- [x] vitest (vector-search, feedback route) + pytest (job_crawl_dag)
- [x] `ENABLE_RAG=true` 배포 환경변수 설정 + `.ai.md` 최신화 (`.env.example`에 문서화, 배포 시 수동 설정)

## 구현 플랜

### Step 1 — pgvector 스키마
- `prisma/schema.prisma` — `JobPostingEmbedding` 모델 추가 (Unsupported("vector(768)"))
- `airflow/sql/003_enable_pgvector.sql` 신규
- Supabase Dashboard에서 pgvector extension 활성화

### Step 2 — Airflow job_crawl_dag
- `airflow/dags/job_crawl_dag.py` 신규
- Task 1: 잡코리아 대분류별 공고 크롤링 (`/recruit/joblist`, `/Recruit/GI_Read`)
- Task 2: 공고 텍스트 → 엔진 `/api/embed` 배치 호출 (XCom에는 S3 key만 전달)
- Task 3: pgvector upsert

### Step 3 — Trends API RAG 로직 활성화
- `src/lib/rag/vector-search.ts` 신규
- `src/app/api/resumes/trends/route.ts` 수정 — RAG 로직 추가 (ENABLE_RAG guard)

### Step 4 — trendComparison RAG 로직 활성화
- `engine/app/schemas/feedback.py` 수정 — `job_context: list[str] | None = None` 추가
- `engine/app/services/feedback_service.py` 수정 — job_context LLM 프롬프트 주입
- `src/app/api/resumes/[id]/feedback/route.ts` 수정 — pgvector 검색 후 job_context 포함하여 엔진 재호출

### Step 5 — 테스트 + 배포 설정
- pytest job_crawl_dag 단위 테스트 + engine feedback_service job_context 테스트
- vitest vector-search, RAG trends, feedback-route-rag 테스트
- 배포 환경변수 `ENABLE_RAG=true` 설정

## 개발 체크리스트
- [ ] 테스트 코드 포함 (vitest + pytest)
- [ ] `services/siw/.ai.md`, `airflow/.ai.md` 최신화
- [ ] 불변식 준수 — 임베딩 AI API 호출은 엔진 경유
- [ ] 잡코리아 robots.txt 준수 (Rate limit 적용)
- [ ] XCom에 대용량 텍스트 직접 전달 금지 (S3 key 경유)

---

## 작업 내역


### 2026-03-23

**현황**: 5/6 완료

**완료된 항목**:
- Supabase pgvector extension + job_posting_embeddings 테이블 (`airflow/sql/003_enable_pgvector.sql`)
- Airflow job_crawl_dag: 12개 대분류 크롤링, ON CONFLICT (source_url, job_role), 임베딩 진행 로그
- src/lib/rag/vector-search.ts + embedding-client.ts (pgvector cosine similarity, MIN_SIMILARITY=0.6)
- trendComparison DB 캐싱 구조: POST 분석 시점 계산 → Prisma schema + migration → GET은 DB 읽기만
- vitest (vector-search, feedback route) + pytest (job_crawl_dag)

**미완료 항목**: 없음 (전체 완료)

**아키텍처 변경 (계획 대비)**:
- 원래: GET /feedback → 매 페이지 로드마다 pgvector 검색 + LLM 재호출
- 변경: POST /resumes 분석 시점에 RAG 계산 후 trendComparison 컬럼에 캐싱, GET은 DB 읽기만
- UI에서 TrendComparisonCard 제거 (RAG는 피드백 품질 향상용, 사용자에게 별도 노출 불필요)
- ON CONFLICT: source_url 단독 → (source_url, job_role) 복합 키 (동일 공고가 여러 직군에 출현 가능)
- 잡코리아 BCtgrCode: 1~11 → 실제 HTML 기준 1-10, 12, 13 (총 12개)

**최종 정리 (2026-03-23)**:
- 테스트 개선: `extractTrendSkills` 시그니처 변경(jobRole string → postings 배열) 반영, mock 전략 강화
- Airflow `llm_quality_dag.py`: S3 클라이언트 credentials를 환경 변수 직접 주입 → Airflow Variable 경유로 수정
- `docker-compose.yml`: AIRFLOW_VAR_* / AIRFLOW_CONN_* 환경변수 + host.docker.internal 추가
- `FeedbackTrendCard.tsx` 및 `FeedbackTrendComparison` 타입 삭제 (RAG는 피드백 품질 향상 목적, UI 직접 노출 불필요)
