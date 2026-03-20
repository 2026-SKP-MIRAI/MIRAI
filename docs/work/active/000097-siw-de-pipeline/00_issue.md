# Pipeline 2 — 자소서 S3 적재·임베딩 API·trendComparison·잡코리아 RAG 파이프라인

> 이 브랜치에서 #97 (Pipeline 2-1)과 #163 (Pipeline 2-2)을 순차적으로 구현한다.

## 이슈 구조

| 이슈 | 제목 | 범위 |
|------|------|------|
| **#97 Pipeline 2-1** | feat: [siw][DE] Pipeline 2-1 — 자소서 S3 적재·inferredTargetRole·엔진 임베딩 API·trendComparison 피드백 | Steps 1-5 |
| **#163 Pipeline 2-2** | feat: [siw][DE] Pipeline 2-2 — 잡코리아 크롤링·pgvector·RAG Trends API 활성화 | Steps 6-10 |

---

## 사용자 관점 목표

자소서 업로드 데이터를 S3에 raw 적재하고, 엔진에 임베딩 API를 추가한다.
이후 잡코리아 채용공고를 주기적으로 크롤링해 pgvector에 적재하고,
기능 02(이력서 피드백)에 "지금 채용공고에서 요구하는데 내 자소서엔 없는 역량" 섹션을 활성화한다.

## 배경

기능 02는 현재 LLM이 자소서를 단독으로 분석해 강점/약점을 판단한다.
채용 시장 데이터와 비교하는 기준이 없어 실제 시장 요구 역량 대비 내 자소서 피드백이 불가능하다.

Pipeline 2-1에서 인프라 기반(S3 적재, 임베딩 API, trendComparison 뼈대)을 구축하고,
Pipeline 2-2에서 잡코리아 크롤링 + pgvector 적재로 실제 데이터를 채운다.

> ⚠️ ENABLE_RAG 미설정 시 trendComparison: null, trends: [] — 기존 흐름 완전 영향 없음
> ⚠️ 엔진 POST /api/embed는 신규 라우터 추가만 — 기존 엔드포인트 변경 없음, 다른 팀원 서비스 무관

---

## #97 Pipeline 2-1 완료 기준 (Steps 1-5)

- [ ] **AC #1**: 자소서 업로드 시 `inferredTargetRole` DB 저장 (한글 직무명 → 정규화 포함)
- [ ] **AC #2**: 엔진 `POST /api/embed` 신규
      — Gemini Embedding API (`{ texts: string[] }` → `{ embeddings: number[][] }`)
      — 기존 엔드포인트 변경 없음
- [ ] **AC #3**: `GET /api/resumes/trends?role={직무}` 엔드포인트 신규
      — `ENABLE_RAG` 미설정 시 `{ trends: [], totalJobs: 0 }` 반환
- [ ] **AC #4**: 기능 02 피드백에 `trendComparison` 섹션 추가
      — `ENABLE_RAG` 미설정 시 `trendComparison: null`
      — 응답 형태 변경: `ResumeFeedback | null` → `{ feedback, trendComparison }`
- [ ] **AC #5**: vitest (trends API, resume-data-logger, trendComparison) + pytest (embed route)
- [ ] **AC #6**: `services/siw/.ai.md`, `engine/.ai.md` 최신화

---

## #163 Pipeline 2-2 완료 기준 (Steps 6-10)

- [ ] **AC #1**: Supabase pgvector extension 활성화 + `job_posting_embeddings` 테이블 신규 (vector(768))
- [ ] **AC #2**: Airflow `job_crawl_dag` 주간 실행
      — 잡코리아 전 직무 대분류 크롤링 → 엔진 `/api/embed` → pgvector upsert
      — robots.txt 준수 + 1초 rate limit
- [ ] **AC #3**: Trends API RAG 로직 구현
      — `vector-search.ts` 신규, `ENABLE_RAG=true` 시 pgvector similarity search
- [ ] **AC #4**: trendComparison RAG 기반 실제 비교 로직
      — 자소서 임베딩 ↔ 채용공고 pgvector
- [ ] **AC #5**: vitest (vector-search, RAG trends, trend-comparison) + pytest (job_crawl_dag)
- [ ] **AC #6**: `ENABLE_RAG=true` 배포 환경변수 설정 + `.ai.md` 최신화

---

## 기술 스택 추가

| 기술 | 용도 | 도입 단계 |
|------|------|----------|
| **Gemini text-embedding-004** | 텍스트 임베딩 768차원 (엔진 경유) | Pipeline 2-1 |
| **Supabase pgvector** | 채용공고 임베딩 벡터 저장 + 유사도 검색 | Pipeline 2-2 |
| **잡코리아 크롤링** | 주간 채용공고 수집 (requests + BeautifulSoup) | Pipeline 2-2 |
| **Airflow job_crawl_dag** | 크롤링 → 임베딩 → pgvector upsert 파이프라인 | Pipeline 2-2 |

## 불변식

- 외부 AI API(임베딩 포함) 호출은 엔진에서만
- ENABLE_RAG 미설정 시 기존 흐름 완전 영향 없음
- 다른 팀원 서비스 무관 (엔진 신규 라우터 추가만, 기존 변경 없음)
- 잡코리아 robots.txt 준수 (Rate limit 1초)
- XCom에 대용량 텍스트 직접 전달 금지 (S3 key 경유)
- S3/Supabase Storage 기존 저장 구조 변경 없음

---

## 작업 내역

### 2026-03-20

**현황**: 0/13 완료 (문서 작업 완료)

**완료된 항목**:
- 이슈 구조 확정 (#97 Pipeline 2-1 / #163 Pipeline 2-2)
- RALPLAN-DR 통합 구현 계획 작성 (`01_plan.md`)
- 잡코리아 robots.txt 확인 (`/recruit/joblist`, `/Recruit/GI_Read` Allow)

**미완료 항목 (#97)**:
- AC #1: 자소서 S3 raw 저장 + inferredTargetRole DB 저장
- AC #2: 엔진 POST /api/embed 신규
- AC #3: GET /api/resumes/trends 뼈대 (ENABLE_RAG guard)
- AC #4: trendComparison 피드백 뼈대 (ENABLE_RAG guard)
- AC #5: vitest + pytest 테스트
- AC #6: .ai.md 최신화

**미완료 항목 (#163)**:
- AC #1: pgvector 스키마 + Supabase extension
- AC #2: Airflow job_crawl_dag (잡코리아 크롤링)
- AC #3: Trends API RAG 로직 (vector-search.ts)
- AC #4: trendComparison RAG 기반 비교 로직
- AC #5: vitest + pytest 테스트
- AC #6: ENABLE_RAG=true 배포 설정 + .ai.md

**변경 파일**: 0개 (문서 작업 중)

**비고**: 통합 구현 계획 확정. Steps 1-5(#97) 완료 후 Steps 6-10(#163) 진행.
ENABLE_RAG 미설정 시 기존 흐름 100% 보존. 다른 팀원 서비스 무관.
