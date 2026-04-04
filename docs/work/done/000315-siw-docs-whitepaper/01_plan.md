# [#315] chore: [siw] docs/whitepaper/siw 발표 자료 초안 작성 — 구현 계획

> 작성: 2026-03-28

---

## 완료 기준

- [ ] `docs/whitepaper/siw/` 폴더 생성 및 `.ai.md` 작성
- [ ] 기획 단계 문서 — 타겟 선정·시장조사·서비스 기획 배경
- [ ] 협업 구조 문서 — 하네스 엔지니어링·엔진 협업 방식·서비스 역할 분담
- [ ] siw 기능별 구현 문서 — 각 기능을 어떤 기준으로 구현했는지 의사결정 근거 포함
- [ ] 파이프라인·인프라 문서 — 아키텍처 선택 이유 (EC2·Lambda·Airflow·S3·pgvector 등)
- [ ] 기술 스택 정리 — 선택 근거 포함
- [ ] `docs/whitepaper/siw/.ai.md` 생성

---

## 구현 계획

### 캐노니컬 기능 목록 (7개 — `MirAI_proposal.md` §2-2 기준, `services/siw/.ai.md` 검증 완료)

| # | 기능명 | Step | 구현 상태 | siw 구현 근거 |
|---|--------|------|----------|--------------|
| 01 | PDF 구조화 및 자소서 기반 맞춤 질문 생성 | Step 1 — 서류 분석 | MVP 완료 | `UploadForm.tsx`, `POST /api/resumes`, engine `/parse`+`/questions` |
| 02 | 이력서·자소서 피드백 및 서류 강점·약점 분석 | Step 1 — 서류 분석 | Issue #140 완료 | `POST /api/resumes` (engine `/feedback` 병렬 호출), `GET /api/resumes/[id]/feedback` |
| 03 | 3인 1조 페르소나 패널 면접 시스템 | Step 2 — 실전 시뮬레이션 | Phase 1 완료 | `InterviewChat.tsx` (HR/기술팀장/경영진 3종 버블), `interview-service.ts` |
| 04 | 실시간 꼬리질문 엔진 (Clarify·Challenge·Explore) | Step 2 — 실전 시뮬레이션 | Phase 1 완료 | `POST /api/interview/followup`, engine `pressure_controller.py` |
| 05 | 연습 모드 및 즉각 피드백 시스템 | Step 3 — 몰입형 환경 | Issue #86 완료 | `POST /api/practice/feedback`, `InterviewChat.tsx` 연습 모드 피드백 카드 |
| 06 | 실시간 AI 아바타 및 TTS 기반 몰입형 면접 | Step 3 — 몰입형 환경 | Phase 4 (미구현) | 기획서에만 존재, siw 미구현 |
| 07 | 8축 역량 평가 및 실행형 리포트 | Step 4 — 심층 피드백 | Issue #82 완료 | `ReportResult.tsx` (Radar+탭+점수바), `POST /api/report/generate` |

> 기능 06은 siw에서 미구현 상태이므로 `03_features.md`에서는 기획 의도만 기술하고, 구현 섹션은 "Phase 4 예정"으로 표기한다.

---

### 사전 작업: 읽어야 할 소스 파일 목록

작성 전 반드시 참조해야 하는 파일 (deliverable별 출처는 아래 매핑 테이블 참조):

| 분류 | 파일 | 용도 |
|------|------|------|
| 기획 | `docs/whitepaper/MirAI_proposal.md` | 서비스 컨셉, 7가지 기능, 시장 분석, UX 설계, 비즈니스 모델 |
| 기획 | `docs/whitepaper/mirai_project_plan.md` | 레포 구조, 엔진 vs 서비스, 4주 커리큘럼, 역할 분리 |
| 기획 | `docs/whitepaper/growth_strategy_fullstack_builder.md` | 하네스 엔지니어링, 풀스택 빌더 성장 전략 |
| 배경 | `docs/background/harness_engineering_analysis.md` | 하네스 엔지니어링 원론 |
| 배경 | `docs/background/competitor_analysis_2026.md` | 경쟁사 분석 |
| 명세 | `docs/specs/mirai/dev_spec.md` | 전체 기능 범위, 기술 스택, 인프라, 통신 구조 |
| 명세 | `docs/specs/mirai/ux_flow.md` | UX 흐름도 |
| 서비스 | `services/siw/.ai.md` | siw 전체 구조·기능 목록·기술 스택·진행 상태 |
| 서비스 | `services/siw/src/lib/types.ts` | 도메인 타입 정의 |
| 엔진 | `engine/.ai.md` | 엔진 구조·불변식·API 계약 |
| 인프라 | `.github/workflows/deploy-siw.yml` | CI/CD 파이프라인 |
| 인프라 | `services/siw/Dockerfile` | Docker 빌드 구성 |
| 인프라 | `services/siw/infra/deploy.sh` | Lambda + EventBridge 배포 |
| 인프라 | `services/siw/airflow/dags/llm_quality_dag.py` | Airflow DAG 구성 |

---

### Step 1: 폴더 및 `.ai.md` 생성

**생성 파일:** `docs/whitepaper/siw/.ai.md`

**역할:** 단순 메타데이터가 아닌 **"목차 겸 서사 가이드"** — 독자가 이 파일을 읽으면 siw 폴더의 전체 맥락과 읽기 순서를 파악할 수 있어야 한다.

**섹션 구조:**

```markdown
# docs/whitepaper/siw/

## 목적
siw(성시우) 서비스의 기획·개발·운영 과정을 기록한 발표 자료 모음.

## 읽기 순서 가이드
| 순서 | 파일 | 한 줄 요약 |
|------|------|-----------|
| 1 | 01_planning.md | 왜 이 서비스를 만들었는가 — 타겟·시장·기획 배경 |
| 2 | 02_engineering.md | 어떤 구조로 만들었는가 — 하네스·엔진·협업 방식 |
| 3 | 03_features.md | 무엇을 만들었는가 — 7가지 기능의 구현 근거와 의사결정 |
| 4 | 04_infrastructure.md | 어디에서 돌아가는가 — AWS·Docker·CI/CD·Airflow |
| 5 | 05_tech_stack.md | 무엇으로 만들었는가 — 기술 선택과 그 이유 |

## 구조
(파일 트리)

## 교차 참조
- 서비스 코드: `services/siw/.ai.md`
- 엔진 계약: `engine/.ai.md`
- 기능 명세: `docs/specs/mirai/dev_spec.md`
- 서비스 기획서: `docs/whitepaper/MirAI_proposal.md`

## 규칙 변경 시 컨펌 필요
```

**AC:**
- 파일이 존재하고, 읽기 순서 테이블이 5개 문서를 올바르게 안내한다
- 교차 참조 링크가 실제 파일 경로와 일치한다

---

### Step 2: `01_planning.md` 작성

**섹션 구조 (5개 헤딩):**

```markdown
## 1. 프로젝트 배경 — 왜 AI 면접 코칭인가
  (면접 중요성, 준비 부족, 불안-성과 괴리, 비용 장벽, 연습 효과)

## 2. 타겟 사용자 정의
  (신입 취준생 21만 명, 이직 준비 경력직, 대학 일자리센터)

## 3. 시장 분석 요약
  (TAM/SAM/SOM, 경쟁사 4개 비교표, Why Now 3가지)

## 4. 서비스 컨셉과 핵심 가치 제안
  (Mirroring × Equivalence, "자소서를 올리면 나만의 면접관", 7가지 기능 4-Step 구조 요약)

## 5. 비즈니스 모델
  (Lean Canvas 요약표, 수익 구조, B2U 전략)
```

**출처 파일:**
- `docs/whitepaper/MirAI_proposal.md` §1~§4 (주 출처)
- `docs/background/competitor_analysis_2026.md` (경쟁사 분석)
- `docs/background/dev_job_market_2026.md` (채용 시장 데이터)

**내용 기준:**
- 통계·수치는 반드시 출처 명시 (기획서 원문의 출처를 그대로 인용)
- 경쟁사 분석은 표 형식으로 요약 (기업명·서비스 형태·한계·MirAI 기회)
- 기획서 원문을 요약하되, 발표 자료 톤으로 재구성 (서술체 → 핵심 포인트 중심)

**AC:**
- §1~§5 모두 작성됨
- 통계 수치가 원문과 일치
- 경쟁사 비교표 포함

---

### Step 3: `02_engineering.md` 작성

**섹션 구조 (4개 헤딩):**

```markdown
## 1. 하네스 엔지니어링 — "Humans steer. Agents execute."
  (하네스 개념, 4가지 핵심 실천, MirAI = 하네스 실습장)

## 2. 엔진-서비스 아키텍처
  (엔진 vs 서비스 역할표, 통신 구조 다이어그램, 아키텍처 불변식 5개)

## 3. 개발 프로세스
  (DDD + TDD, AC = 첫 번째 테스트, Red-Green-Refactor)
  (이슈 기반 워크플로우: GitHub Issue → worktree → PR → CI → merge)

## 4. 역할 분담과 협업 구조
  (멘토 주도 영역 vs 멘티 영역, 풀스택 빌더 vs 하네스 엔지니어, "1명이 서비스 1개를 전부")
```

**출처 파일:**
- `docs/whitepaper/growth_strategy_fullstack_builder.md` (하네스·역할 분담)
- `docs/whitepaper/mirai_project_plan.md` §1~§2 (레포 구조·엔진 vs 서비스)
- `docs/background/harness_engineering_analysis.md` (하네스 원론)
- `engine/.ai.md` (엔진 불변식·구조)
- `services/siw/.ai.md` (siw 역할·아키텍처 불변식)

**내용 기준:**
- 아키텍처 불변식은 번호 매겨 정확히 인용
- 통신 구조는 ASCII 다이어그램 또는 코드 블록으로 표현
- 하네스 엔지니어링은 OpenAI 원문 인용 포함 ("Humans steer. Agents execute.")

**AC:**
- 아키텍처 불변식 5개가 정확히 기술됨
- 엔진-서비스 통신 다이어그램 포함
- 하네스 엔지니어링 설명과 MirAI 적용 사례 포함

---

### Step 4: `03_features.md` 작성

**섹션 구조 (캐노니컬 기능 목록 기반):**

```markdown
## 기능 전체 요약표
  (7기능 × [기능명, Step, 구현 상태, 핵심 컴포넌트] 표)

## 기능 01 — PDF 구조화 및 자소서 기반 맞춤 질문 생성 ⭐ MVP
## 기능 02 — 이력서·자소서 피드백 및 서류 강점·약점 분석
## 기능 03 — 3인 1조 페르소나 패널 면접 시스템
## 기능 04 — 실시간 꼬리질문 엔진 (Clarify·Challenge·Explore)
## 기능 05 — 연습 모드 및 즉각 피드백 시스템
## 기능 06 — 실시간 AI 아바타 및 TTS 기반 몰입형 면접 (Phase 4 예정)
## 기능 07 — 8축 역량 평가 및 실행형 리포트

## 부가 기능
  (회원가입 약관 동의, 직무 확인·수정 UI, RAG 파이프라인, LLM 옵저버빌리티 대시보드, 데모 모드)
```

**각 기능당 작성 형식 (기능 01~05, 07):**

```markdown
### 기능 0N — {기능명}

**기획 의도:** 왜 이 기능이 필요한가 (MirAI_proposal.md 기반, 2~3문장)

**구현 방식:**
- 프론트엔드: 어떤 컴포넌트가 어떤 UX를 담당하는지
- API 라우트: 엔드포인트 목록 + 엔진 호출 흐름
- 엔진 연동: engine API 어떤 것을 호출하는지

**의사결정 근거:** 왜 이렇게 만들었는가 (대안 대비 선택 이유, 기술적 트레이드오프)

**관련 이슈:** GitHub Issue 번호 + 한 줄 요약
```

**기능 06 작성 형식 (미구현):**

```markdown
### 기능 06 — 실시간 AI 아바타 및 TTS (Phase 4 예정)

**기획 의도:** (MirAI_proposal.md 기반)
**현재 상태:** 미구현. Phase 4에서 TTS 기술 확정 후 착수 예정.
**선행 조건:** 기능 03~05 안정화 후 진행
```

**출처 파일:**
- `docs/whitepaper/MirAI_proposal.md` §2-2 (7가지 기능 정의)
- `docs/specs/mirai/dev_spec.md` §1 (기능 범위·구현 순위)
- `services/siw/.ai.md` (진행 상태·컴포넌트·API 라우트 전체)
- `services/siw/src/lib/types.ts` (도메인 타입)
- `engine/.ai.md` (엔진 API 계약)

**AC:**
- 7개 기능 모두 섹션 존재
- 구현된 6개 기능은 기획 의도 + 구현 방식 + 의사결정 근거 포함
- 부가 기능 섹션에 5개 이상 항목 기술

---

### Step 5: `04_infrastructure.md` 작성

**섹션 구조 (5개 헤딩):**

```markdown
## 1. 인프라 아키텍처 개요
  (EC2 + ALB + Route53 + WAF + HTTPS + CloudFront 구성도)

## 2. Docker 컨테이너화
  (멀티스테이지 빌드, node:20-alpine, non-root, Prisma 포함, HEALTHCHECK)
  (entrypoint.sh: env guard → prisma migrate deploy → node server.js)

## 3. CI/CD 파이프라인
  (GitHub Actions: test → ECR build+push → EC2 deploy 흐름)
  (deploy-siw.yml 구조 요약)

## 4. EC2 스케줄 자동화
  (Lambda ec2_start/ec2_stop + EventBridge cron + deploy.sh 멱등 배포)

## 5. 데이터 파이프라인
  (Airflow: llm_quality_dag.py — extract→aggregate→load→alert)
  (잡코리아 크롤링 DAG: job_crawl_dag.py — 크롤링→embed→pgvector upsert)
  (S3 JSONL 적재 + analytics.llm_events_daily)
```

**출처 파일:**
- `services/siw/Dockerfile` + `services/siw/entrypoint.sh`
- `.github/workflows/deploy-siw.yml`
- `services/siw/infra/` (Lambda, deploy.sh, iam-policy.json)
- `services/siw/airflow/` (dags, Dockerfile, docker-compose.yml)
- `docs/specs/mirai/dev_spec.md` §2 인프라 테이블

**내용 기준:**
- 인프라 구성은 표 형식 (서비스명·AWS 리소스·용도·도입 시점)
- CI/CD는 단계별 흐름도 (ASCII 또는 코드 블록)
- 비용 최적화 결정 (EC2 스케줄 on/off) 근거 포함

**AC:**
- 인프라 구성 테이블 포함
- CI/CD 흐름 (test → build → deploy) 설명 포함
- Airflow DAG 2개 설명 포함

---

### Step 6: `05_tech_stack.md` 작성

**섹션 구조 (4개 헤딩):**

```markdown
## 1. 기술 스택 전체 요약표
  (계층별: 프론트엔드 / 백엔드 / 엔진 / DB·인증 / 인프라 / 테스트 / 데이터)

## 2. 핵심 기술 선택 근거
  (Next.js App Router 선택 이유, Supabase Auth vs Better Auth, Prisma v7 드라이버 어댑터,
   Chart.js vs 다른 차트 라이브러리, FastAPI + OpenRouter, Tailwind v4 + Glassmorphism)

## 3. 엔진-서비스 기술 분리 원칙
  (Python(엔진) vs TypeScript(서비스) 이원 구조 이유, 불변식과의 관계)

## 4. 데이터 계층
  (Supabase PostgreSQL + Prisma ORM, pgvector RAG, Supabase Storage,
   RAG_DATABASE_URL 분리 이유, RLS 정책)
```

**표 형식 (§1):**

```markdown
| 계층 | 기술 | 버전 | 선택 근거 |
|------|------|------|----------|
| 프론트엔드 | Next.js (App Router) | 15 | SSR + RSC + API Routes 통합 |
| 프론트엔드 | React | 19 | Server Components 지원 |
| 프론트엔드 | TypeScript | strict | 타입 안전성 |
| 프론트엔드 | Tailwind CSS | v4 | 유틸리티 퍼스트 + @theme inline |
| 프론트엔드 | framer-motion | — | stagger 애니메이션 |
| 프론트엔드 | chart.js + react-chartjs-2 | ^4 / ^5 | Radar·Line·Bar 차트 |
| 백엔드 | Next.js API Routes | — | 풀스택 단일 배포 |
| 백엔드 | Prisma | 7 | ORM + 마이그레이션 + @prisma/adapter-pg |
| 백엔드 | Zod | — | 런타임 스키마 검증 |
| 인증·DB | Supabase Auth | — | OAuth + 이메일/비밀번호 |
| 인증·DB | Supabase PostgreSQL | — | DB + RLS + Storage 통합 |
| 인증·DB | pgvector | — | RAG 벡터 검색 |
| 엔진 | FastAPI | — | Python REST API |
| 엔진 | PyMuPDF + Tesseract OCR | — | PDF 파싱 + OCR fallback |
| 엔진 | OpenRouter (Gemini 2.5 Flash) | — | LLM 호출 |
| 인프라 | Docker + ECR | — | 컨테이너 빌드·레지스트리 |
| 인프라 | EC2 + ALB | — | 호스팅 + 로드밸런싱 |
| 인프라 | GitHub Actions | — | CI/CD |
| 인프라 | Lambda + EventBridge | — | EC2 스케줄 자동화 |
| 데이터 | Airflow | 2.9.0 | DAG 기반 배치 파이프라인 |
| 테스트 | Vitest | 2 | 단위 테스트 |
| 테스트 | Playwright | — | E2E 테스트 |
```

**출처 파일:**
- `services/siw/.ai.md` §기술 스택
- `docs/specs/mirai/dev_spec.md` §2 (기술 스택 표)
- `services/siw/package.json` (의존성 버전)
- `engine/.ai.md` + `engine/pyproject.toml`

**AC:**
- 기술 스택 표에 15개 이상 항목, 모두 선택 근거 포함
- 핵심 기술 선택 근거 최소 5개 기술에 대해 대안 비교 포함

---

### Step 7: 상위 `.ai.md` 업데이트

**대상:** `docs/whitepaper/.ai.md`

**변경 내용:**
- `## 구조` 섹션에 `siw/` 서브폴더 추가

```markdown
## 구조
whitepaper/
├── mirai_project_plan.md                 레포 구조·기능 목록·4주 커리큘럼
├── MVP_proposal.md                       서비스 기획서 원본 (v1 보존)
├── MirAI_proposal.md                     서비스 기획서 최신판 (v2, 1~5장, 팀 운영 기준)
├── growth_strategy_fullstack_builder.md  풀스택 빌더 + 하네스 엔지니어 성장 전략
└── siw/                                  siw(성시우) 서비스 발표 자료
    ├── .ai.md                            읽기 순서 가이드 겸 목차
    ├── 01_planning.md                    기획 배경·타겟·시장 분석
    ├── 02_engineering.md                 하네스·엔진·협업 구조
    ├── 03_features.md                    7가지 기능 구현 문서
    ├── 04_infrastructure.md              인프라·CI/CD·파이프라인
    └── 05_tech_stack.md                  기술 스택 및 선택 근거
```

**AC:**
- `docs/whitepaper/.ai.md`에 `siw/` 항목이 추가됨
- 기존 내용(mirai_project_plan.md 등)은 변경 없음

---

### 출처-Deliverable 매핑 테이블

| 출처 파일 | 01_planning | 02_engineering | 03_features | 04_infra | 05_tech | siw/.ai.md |
|-----------|:-----------:|:--------------:|:-----------:|:--------:|:-------:|:----------:|
| `MirAI_proposal.md` | **주** | | **주** | | | |
| `mirai_project_plan.md` | | **주** | | | | |
| `growth_strategy_fullstack_builder.md` | | **주** | | | | |
| `harness_engineering_analysis.md` | | **보조** | | | | |
| `competitor_analysis_2026.md` | **보조** | | | | | |
| `dev_job_market_2026.md` | **보조** | | | | | |
| `docs/specs/mirai/dev_spec.md` | | | **보조** | **보조** | **주** | |
| `docs/specs/mirai/ux_flow.md` | | | **보조** | | | |
| `services/siw/.ai.md` | | **보조** | **주** | **주** | **주** | **주** |
| `services/siw/src/lib/types.ts` | | | **보조** | | | |
| `engine/.ai.md` | | **보조** | **보조** | | **보조** | **보조** |
| `services/siw/Dockerfile` | | | | **주** | | |
| `.github/workflows/deploy-siw.yml` | | | | **주** | | |
| `services/siw/infra/*` | | | | **주** | | |
| `services/siw/airflow/*` | | | | **주** | | |

---

### 검증 체크리스트

작성 완료 후 아래 항목을 모두 확인한다:

**구조 검증:**
- [ ] `docs/whitepaper/siw/` 폴더에 6개 파일 존재 (`.ai.md` + 5개 문서)
- [ ] `docs/whitepaper/siw/.ai.md`의 읽기 순서 테이블이 5개 문서를 정확히 가리킴
- [ ] `docs/whitepaper/.ai.md`에 `siw/` 서브폴더가 추가됨
- [ ] 모든 교차 참조 경로가 실제 파일과 일치

**내용 검증:**
- [ ] 캐노니컬 기능 7개가 `03_features.md`에 모두 등장
- [ ] 구현된 6개 기능(01~05, 07)은 기획 의도 + 구현 방식 + 의사결정 근거 포함
- [ ] 기능 06은 "Phase 4 예정"으로 명시
- [ ] 아키텍처 불변식 5개가 `02_engineering.md`에 정확히 기술됨
- [ ] 기술 스택 표가 15개 이상 항목 포함, 선택 근거 명시
- [ ] 통계·수치에 출처가 표기됨

**품질 검증:**
- [ ] 각 문서가 독립적으로 읽혀도 맥락을 파악할 수 있음 (자기 완결적)
- [ ] 발표 자료 톤 — 서술체가 아닌 핵심 포인트 중심
- [ ] 중복 최소화 — 동일 내용이 여러 문서에 반복되지 않고 교차 참조로 연결
- [ ] `.ai.md` 읽기 순서 가이드를 따라 5개 문서를 순서대로 읽으면 전체 서사가 연결됨
