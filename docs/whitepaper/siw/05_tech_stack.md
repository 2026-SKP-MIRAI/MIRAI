# 05. 기술 스택 — 선택 근거 및 아키텍처 원칙

> **독자:** 기술 면접관, 팀원, 신규 기여자
> **목적:** MirAI SIW 서비스의 기술 스택 전체와 각 선택의 의사결정 근거를 기록한다.
> **소스:** `services/siw/.ai.md`, `services/siw/package.json`, `docs/specs/mirai/dev_spec.md §2`, `engine/.ai.md`

---

## 1. 기술 스택 전체 요약표

| 계층 | 기술 | 버전 | 선택 근거 |
|------|------|------|----------|
| **프론트엔드 프레임워크** | Next.js (App Router) | ^15.0.0 | RSC + Server Actions + API Routes 일원화, Pages Router 대비 레이아웃 중첩·스트리밍 SSR 지원 |
| **UI 라이브러리** | React | ^19.0.0 | Next.js 15 동반 업그레이드, Concurrent Features 활용 |
| **언어** | TypeScript (strict) | ^5.0.0 | 컴파일 타임 타입 검증, Prisma/Zod 스키마와 타입 연동 |
| **스타일링** | Tailwind CSS | latest (v4) | CSS 변수 기반 `@theme inline` 방식으로 디자인 토큰 관리, JIT 빌드 |
| **애니메이션** | framer-motion | latest | stagger enter 애니메이션(`staggerChildren: 0.065`, opacity 0→1, translateY 18→0) |
| **아이콘** | lucide-react | latest | tree-shakeable SVG 아이콘, 번들 크기 최소화 |
| **차트** | chart.js + react-chartjs-2 | ^4.4.0 / ^5.2.0 | Radar(8축), Line(성장 추이), Bar(축별 비교) 세 종류 차트 단일 라이브러리로 처리 |
| **백엔드 API** | Next.js API Routes | ^15.0.0 | 별도 서버 불필요, 서비스 레이어 내 인증·DB 접근 일원화 |
| **ORM** | Prisma | ^5.22.0 | 타입 안전 쿼리, 마이그레이션 관리, `@prisma/adapter-pg` 드라이버 어댑터 |
| **스키마 검증** | Zod | ^4.3.6 | API 요청·응답·엔진 응답 런타임 검증, Prisma 타입과 연동 |
| **인증** | Supabase Auth (`@supabase/ssr`) | ^0.9.0 | SSR 환경 쿠키 기반 세션, Better Auth 대비 Supabase DB 통합 용이 |
| **데이터베이스** | Supabase PostgreSQL | — | RLS 정책, pgvector 확장으로 RAG 벡터 검색 일원화 |
| **벡터 검색** | pgvector | — | PostgreSQL 확장으로 별도 벡터 DB 없이 cosine similarity 검색 |
| **파일 저장** | Supabase Storage | — | S3 호환 API, WAF 보호 유지하며 서버 경유 업로드 |
| **엔진 서버** | FastAPI (Python 3.12+) | — | 비동기 I/O, Pydantic v2 타입 시스템, OpenAI SDK 호환 |
| **PDF 파싱** | PyMuPDF (`fitz`) + Tesseract OCR | — | 텍스트 레이어 추출 + 이미지 PDF OCR fallback (dpi=300, eng+kor) |
| **LLM 게이트웨이** | OpenRouter (Gemini 2.5 Flash) | — | 단일 API 키로 다중 LLM 모델 전환, 직접 API 대비 비용·모델 유연성 |
| **임베딩** | OpenRouter baai/bge-m3 | — | 1024차원 벡터, pgvector cosine similarity RAG 파이프라인 |
| **컨테이너** | Docker + ECR | — | 멀티스테이지 빌드(node:20-alpine), non-root 실행, HEALTHCHECK |
| **컴퓨트** | EC2 + ALB | — | 엔진·서비스 독립 배포, ALB로 트래픽 분산 |
| **CI/CD** | GitHub Actions | — | `engine/**` 변경 push → ECR 빌드·푸시 → EC2 SSH 자동 배포 |
| **스케줄 자동화** | Lambda + EventBridge | — | EC2 on/off cron, 개발 비용 절감 |
| **데이터 파이프라인** | Apache Airflow | 2.9.0 | LLM 이벤트 일별 집계 DAG, 잡코리아 크롤링→embed→pgvector upsert DAG |
| **단위 테스트** | Vitest | ^2.0.0 | Vite 기반 Jest 호환, Next.js 환경 설정 없이 빠른 실행 |
| **E2E 테스트** | Playwright | ^1.58.2 | 실제 브라우저 기반 면접 흐름 통합 테스트 |

---

## 2. 핵심 기술 선택 근거

### Next.js 15 App Router vs Pages Router

**선택:** App Router

Pages Router는 `getServerSideProps`/`getStaticProps`의 페이지 단위 데이터 페칭으로 레이아웃 중첩과 스트리밍 SSR이 불가능하다. App Router는 React Server Components(RSC)로 서버에서 DB 조회·인증 처리를 컴포넌트 레벨에서 직접 수행하고, `layout.tsx` 중첩으로 Sidebar 같은 공통 레이아웃을 라우트 그룹별(`(app)/`, `(auth)/`, `(landing)/`)로 독립 관리한다. SSE 스트리밍(`POST /api/interview/answer`)도 App Router의 `ReadableStream` 반환 방식으로 구현했다. Pages Router로는 동일한 SSE 드레인 패턴 구현이 훨씬 복잡해진다.

### Supabase Auth vs Better Auth

**선택:** Supabase Auth (`@supabase/ssr`)

DB를 Supabase PostgreSQL로 사용하는 상황에서 Supabase Auth는 사용자 테이블·RLS 정책·Storage 버킷 접근 제어가 단일 프로젝트 내에서 자동 연동된다. Better Auth는 별도 adapter 설정과 세션 테이블 관리가 필요하며, Supabase Storage의 서비스 롤 통합도 추가 작업을 요한다. `middleware.ts`에서 `getUser()`로 세션을 갱신하고 보호 라우트를 리다이렉트하는 패턴이 `@supabase/ssr`의 `createServerClient`와 직접 연동된다.

### Prisma v5 드라이버 어댑터 (`@prisma/adapter-pg`)

**선택:** `@prisma/adapter-pg` 사용

Supabase PostgreSQL은 connection pooler(pgbouncer, port 6543)를 통해 연결한다. Prisma 기본 연결 방식은 pgbouncer와 호환되지 않는 prepared statement를 사용하여 런타임 오류가 발생한다. `@prisma/adapter-pg`는 Node.js `pg` 드라이버를 직접 사용하므로 pgbouncer 호환성을 확보한다. 마이그레이션은 direct URL(port 5432)로 실행하고, 런타임 쿼리는 pooler URL(`?pgbouncer=true`)로 분리하는 이중 URL 구조를 유지한다.

### Chart.js vs Recharts

**선택:** Chart.js (`chart.js ^4` + `react-chartjs-2 ^5`)

8축 역량 평가 리포트에는 Radar 차트가 필수이며, 성장 추이에는 Line 차트, 축별 비교에는 Bar 차트가 필요하다. Recharts는 Radar 차트 커스터마이징(축 레이블 위치, 격자 스타일)이 제한적이고 chart.js 대비 번들 크기가 크다. chart.js는 Canvas 기반으로 렌더링 성능이 우수하고, `react-chartjs-2`가 React 생명주기와 통합되며 세 종류 차트를 단일 패키지로 처리한다. `ReportResult.tsx`의 Radar 차트와 `growth/page.tsx`의 Line/Bar 차트가 동일 라이브러리를 공유한다.

### FastAPI + OpenRouter vs 직접 LLM API 호출

**선택:** FastAPI 엔진 + OpenRouter 게이트웨이

아키텍처 불변식("외부 AI API 호출은 엔진에서만")으로 LLM 호출을 엔진에 집중했다. FastAPI는 Python 생태계의 PyMuPDF·Tesseract·numpy(코사인 유사도) 를 직접 사용할 수 있어 PDF 파싱과 규칙 기반 TextSignals 분석을 동일 레이어에서 처리한다. TypeScript 서비스에서 직접 LLM을 호출하면 파싱 로직이 분산되고 엔진의 stateless 설계 원칙이 깨진다. OpenRouter는 `openai` Python SDK의 `base_url`을 `https://openrouter.ai/api/v1`로만 바꿔 Gemini 2.5 Flash를 사용할 수 있어, 향후 모델 교체 시 엔진 코드 변경 없이 환경변수만 수정한다.

### Tailwind CSS v4 (`@theme inline` 방식)

**선택:** Tailwind v4 + CSS 변수 기반 `@theme inline`

Tailwind v4는 `tailwind.config.js` 파일 없이 `globals.css` 내 `@theme inline { }` 블록에서 CSS 변수로 색상·간격 토큰을 선언한다. 이 방식으로 shadcn/ui 호환 CSS 변수(`:root { --background, --foreground, ... }`)와 Tailwind 유틸리티 클래스가 동일 변수를 참조한다. `glass-card`, `gradient-text`, `btn-primary` 같은 커스텀 유틸리티도 `@layer utilities`에 추가하여 Glassmorphism 디자인 시스템을 CSS 한 파일에서 관리한다.

---

## 3. 엔진-서비스 기술 분리 원칙

MirAI는 Python(엔진)과 TypeScript(서비스)의 이원 기술 구조를 의도적으로 채택했다.

```
[유저 브라우저]
      ↓ HTTPS
[Next.js 서비스 — TypeScript]
  - Supabase Auth 인증
  - Prisma + Supabase PostgreSQL (세션·리포트·이력서 상태)
  - API Routes: 인증 검증 → 엔진 프록시 → DB 저장
      ↓ HTTP REST (ENGINE_BASE_URL)
[FastAPI 엔진 — Python]
  - PyMuPDF + Tesseract: PDF 파싱
  - OpenRouter (Gemini 2.5 Flash): LLM 호출
  - 규칙 기반 analyzers/: TextSignals, 꼬리질문 분류, 점수 산출
  - stateless — 인증·DB 없음
```

**이원 구조를 선택한 이유:**

1. **Python 생태계 필수성:** PyMuPDF, Tesseract, numpy 기반 코사인 유사도 계산은 Python 생태계에 의존한다. TypeScript로 동일 기능을 구현하면 성숙도가 낮은 포팅 라이브러리를 사용하거나 직접 구현해야 한다.
2. **LLM 호출 집중화:** 모든 LLM 호출을 엔진 한 곳에 모아 프롬프트 버전 관리(`engine/app/prompts/`), 옵저버빌리티 계측, 모델 교체를 서비스 레이어 변경 없이 처리한다.
3. **아키텍처 불변식 강제:** 엔진이 stateless(인증·DB 없음)이므로 서비스가 데이터 소유권을 명확히 가진다. 엔진 재시작·스케일아웃 시 세션 일관성은 서비스의 Prisma DB가 보장한다.
4. **독립 배포:** 엔진과 서비스는 각자 Docker 컨테이너로 빌드되어 ECR에 독립적으로 배포된다. `engine/**` 변경과 `services/siw/**` 변경이 서로 다른 GitHub Actions 워크플로우를 트리거한다.

**아키텍처 불변식 (위반 시 CI 차단):**

| # | 불변식 |
|---|--------|
| 1 | 인증은 서비스(Next.js)에서만 — 엔진은 인증 로직 없이 내부 호출만 수신 |
| 2 | 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM을 호출하지 않는다 |
| 3 | 서비스 간 직접 통신 금지 — 공유 로직은 엔진으로 |
| 4 | DB는 서비스가 소유 — 엔진은 stateless, 데이터 저장은 서비스 책임 |
| 5 | 테스트 없는 PR은 머지 금지 |

---

## 4. 데이터 계층

### Supabase PostgreSQL + Prisma ORM

서비스의 모든 영속 데이터는 Supabase PostgreSQL에 저장되며 Prisma ORM으로 접근한다.

| 구분 | 설정 | 용도 |
|------|------|------|
| `DATABASE_URL` | pooler URL, port 6543, `?pgbouncer=true` | 런타임 쿼리 (connection pooling) |
| `DIRECT_URL` | direct URL, port 5432 | `prisma migrate deploy` 마이그레이션 전용 |
| `RAG_DATABASE_URL` | direct URL (공용 Supabase) | RAG 전용 PrismaClient 싱글톤(`rag-prisma.ts`) |

**RAG_DATABASE_URL을 분리한 이유:** RAG 벡터 검색(`searchSimilarPostings`, `extractTrendSkills`)은 pgvector `<=>` 연산자를 사용하는 raw SQL 쿼리가 필요하며, pgbouncer pooler를 통한 연결에서는 prepared statement 방식이 제한된다. `ragPrisma`를 별도 싱글톤으로 분리하여 벡터 검색 쿼리는 항상 direct connection으로 실행하고, 일반 CRUD는 pooler로 처리하는 이중 구조를 유지한다.

### 주요 Prisma 모델

**Resume 모델:**
```
id (uuid), userId, fileName, storageKey, resumeText,
questions (Json), feedbackJson (Json?), inferredTargetRole (String?), createdAt
```

**InterviewSession 모델:**
```
id (uuid), resumeText, currentQuestion, currentPersona,
questionsQueue (Json), history (Json), sessionComplete,
engineResultCache (Json?),     -- write-ahead 캐시 (LLM 재호출 방지)
reportScores (Json?),          -- 8축 점수
reportTotalScore (Int?),       -- 총점
resumeId (uuid?, Resume FK),   -- 이력서 연결
createdAt, updatedAt
```

### pgvector RAG 파이프라인

```
[Airflow DAG: job_crawl_dag.py]
  잡코리아 크롤링 → engine /api/embed (baai/bge-m3, 1024차원)
  → pgvector upsert (accepted_resumes 테이블)

[업로드 시 RAG 활성화 (ENABLE_RAG=true)]
  POST /api/resumes
  → embedText(resumeText) → searchSimilarPostings() → job_context
  → engine /api/resume/feedback (job_context, resume_context 포함)
  → LLM 피드백 품질 향상
```

**ENABLE_RAG 가드:** `ENABLE_RAG=true` 환경변수로만 RAG 경로를 활성화한다. 미설정 시 기존 LLM 피드백 흐름이 100% 유지된다(backward compatible). 이는 RAG 파이프라인 장애가 핵심 면접 기능에 영향을 미치지 않도록 격리한다.

### RLS (Row Level Security) 정책

Prisma로 테이블을 생성해도 Supabase PostgreSQL의 RLS는 자동 활성화되지 않는다. `resumes`, `interview_sessions` 테이블에는 별도 SQL 마이그레이션(`20260315000001_rls_resumes/migration.sql`)으로 RLS를 활성화하고, `userId` 기반 행 수준 접근 제어를 적용한다. `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용이며 `NEXT_PUBLIC_` 접두사 사용이 절대 금지된다.
