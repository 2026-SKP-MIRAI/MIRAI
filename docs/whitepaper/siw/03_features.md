# 03. 기능 구현 — 7가지 핵심 기능

> **독자:** 기술 면접관, 팀원, 신규 기여자
> **목적:** MirAI SIW 서비스의 7가지 핵심 기능 각각의 기획 의도·구현 방식·의사결정 근거를 기록한다.
> **소스:** `docs/whitepaper/MirAI_proposal.md`, `services/siw/.ai.md`, `engine/.ai.md`

---

## 기능 전체 요약표

| # | 기능명 | 상태 | 핵심 컴포넌트 | 엔진 API |
|---|--------|------|--------------|---------|
| 01 | PDF 구조화 및 자소서 기반 맞춤 질문 생성 ⭐ | 완료 (MVP) | `UploadForm.tsx`, `POST /api/resumes` | `/api/resume/parse`, `/api/resume/questions` |
| 02 | 이력서·자소서 피드백 및 서류 강점·약점 분석 | 완료 | `services/siw/src/app/api/resumes/[id]/feedback` | `/api/resume/feedback` |
| 03 | 3인 1조 페르소나 패널 면접 시스템 | 완료 | `InterviewChat.tsx`, `interview-service.ts` | `/api/interview/start`, `/api/interview/answer` |
| 04 | 실시간 꼬리질문 엔진 (Clarify·Challenge·Explore) | 완료 | `POST /api/interview/followup` | `/api/interview/followup` |
| 05 | 연습 모드 및 즉각 피드백 시스템 | 완료 | 연습 모드 피드백 카드 | `/api/practice/feedback` |
| 06 | 실시간 AI 아바타 및 TTS 기반 몰입형 면접 | 미구현 (Phase 4 예정) | — | — |
| 07 | 8축 역량 평가 및 실행형 리포트 | 완료 | `ReportResult.tsx`, `POST /api/report/generate` | `/api/report/generate` |

---

## 기능 01 — PDF 구조화 및 자소서 기반 맞춤 질문 생성 ⭐ MVP

**기획 의도:**
구직자의 가장 큰 면접 불안 중 하나는 "무엇을 물어볼지 모른다"는 불확실성이다. 범용 예상 질문 100개를 외우는 방식은 개인 서류와 무관하게 일반화된 연습에 그치며, 실전 면접관이 자소서에서 파생하는 맞춤 질문에 대비하지 못한다. 기능 01은 사용자가 자신의 자소서를 업로드하는 순간 "내 서류에서 이런 질문이 나올 수 있구나"라는 아하! 모먼트를 제공하여, 의지적 연습의 첫 조건인 "명확한 목표"를 즉시 설정해 준다. 이 기능이 이후 모든 시뮬레이션의 기반이 되는 개인화된 면접 엔진이다.

**구현 방식:**

- **프론트엔드:** `UploadForm.tsx`가 6단계 상태 머신(`idle → ready → uploading → confirming → submitting → done/error`)으로 업로드 UX를 관리한다. 직무 확인·수정을 위한 `confirming` 단계(Issue #162)에서 사용자가 `targetRole`을 확정한 뒤 `submitting`으로 진행한다. `QuestionList.tsx`가 카테고리별(직무역량/경험구체성/성과근거/기술역량) 질문 목록을 렌더링한다.
- **API 라우트:**
  - `POST /api/resumes/analyze` → engine `/api/resume/analyze` (35s timeout, LLM targetRole 추론)
  - `POST /api/resumes` → `Promise.all(storage upload, engine /api/resume/questions JSON, engine /api/resume/feedback)` → DB 저장 (`Resume` 모델: `resumeText`, `questions`, `feedbackJson`, `inferredTargetRole`)
- **엔진 연동:**
  - `engine /api/resume/parse` (multipart): PyMuPDF 텍스트 추출 + Tesseract OCR fallback (이미지 PDF 대응)
  - `engine /api/resume/questions` (JSON): `{ resumeText, targetRole? }` → `{ questions: QuestionItem[], meta }`
  - 이중 파싱 제거(Issue #119): 로컬 `pdf-parse` 삭제, 엔진에 전적으로 위임

**의사결정 근거:**
PDF 파싱을 엔진에 집중시킨 것은 아키텍처 불변식("PDF 파싱은 반드시 engine/parsers/ 에서만")을 준수하고, OCR·문자 인코딩 처리 복잡도를 서비스 레이어로부터 완전히 분리하기 위해서다. `Promise.all`로 질문 생성과 피드백을 병렬 호출하여 사용자 대기 시간을 단축했다. `confirming` 단계를 별도 스텝으로 분리한 것은 LLM이 추론한 직무가 사용자 의도와 다를 수 있으므로, 오류를 조기에 수정하여 이후 질문의 품질을 보장하기 위함이다.

**관련 이슈:** Issue #119 (이중 파싱 제거), Issue #162 (직무 확인·수정 UI)

---

## 기능 02 — 이력서·자소서 피드백 및 서류 강점·약점 분석

**기획 의도:**
면접 준비는 질문에 대한 답변 훈련에만 머물러서는 안 된다. 서류 자체의 완성도가 면접관이 어떤 각도로 질문을 던질지를 결정한다. 기능 02는 구체성·성과 수치 명확성·논리 구조·직무 정렬도·차별성 5개 항목으로 서류를 종합 진단하여, 사용자가 "면접관이 내 서류의 어느 부분을 약점으로 볼지"를 미리 파악하게 한다. 이는 단순 교정 도구가 아니라 면접 전략 수립을 위한 서류 인텔리전스다.

**구현 방식:**

- **프론트엔드:** 이력서 상세 페이지(`/resumes/[id]`)에서 피드백 점수와 강점·약점·수정 제안을 렌더링. `TrendComparisonCard.tsx`가 RAG 기반 트렌드 스킬 커버리지 비교를 함께 표시.
- **API 라우트:**
  - `POST /api/resumes` 처리 시 `Promise.all` 내에서 engine `/api/resume/feedback` 병렬 호출 → `feedbackJson` DB 저장
  - `GET /api/resumes/[id]/feedback` → `{ feedback, trendComparison }` 반환 (`ENABLE_RAG` 가드로 RAG 트렌드 비교 조건부 제공)
- **엔진 연동:**
  - `engine /api/resume/feedback` (POST, JSON): `{ resumeText, targetRole?, job_context?, resume_context? }` → `{ scores: { specificity, achievementClarity, logicStructure, roleAlignment, differentiation }, strengths, weaknesses, suggestions }`
  - RAG 활성화 시: `searchSimilarPostings()`로 채용공고 컨텍스트, `searchSimilarPostings()`로 합격 자소서 예시를 `job_context`/`resume_context`로 전달하여 LLM 피드백 품질 향상

**의사결정 근거:**
피드백을 업로드 시점에 미리 생성(`Promise.all`)하고 DB에 저장하는 방식을 택한 것은, 사용자가 피드백 탭을 열 때마다 LLM을 재호출하는 비용과 지연을 없애기 위해서다. scores 엄격 검증(5개 키 누락 또는 null 시 `ResumeFeedbackParseError` 즉시 throw, silent fallback 없음)은 부정확한 피드백이 사용자에게 전달되는 것을 방지한다.

**관련 이슈:** Issue #140 (이력서 피드백 구현)

---

## 기능 03 — 3인 1조 페르소나 패널 면접 시스템

**기획 의도:**
실제 기업 채용 면접은 단일 면접관이 아닌 복수의 면접관이 서로 다른 관점에서 평가하는 패널 면접으로 진행되는 경우가 많다. HR 담당자는 조직 적합성을, 기술팀장은 직무 역량의 깊이를, 경영진은 성장 가능성과 비즈니스 임팩트를 본다. 기능 03은 이 세 관점을 동시에 경험하게 하여, 어느 유형의 면접관 앞에서도 일관성 있는 답변을 구사할 수 있는 훈련을 가능하게 한다.

**구현 방식:**

- **프론트엔드:** `InterviewChat.tsx`가 페르소나별 말풍선 스타일(HR=blue, tech_lead=green, executive=purple)로 대화 히스토리를 렌더링. 면접 시작 페이지(`/interview/new`)에서 이력서 선택 → 모드 선택 → 시작 흐름을 구성.
- **API 라우트:**
  - `POST /api/interview/start` → engine `/api/interview/start` → `{ firstQuestion, questionsQueue }` → `InterviewSession` DB 생성
  - `POST /api/interview/answer` → engine `/api/interview/answer?stream=true` → SSE 드레인 패턴으로 스트리밍 응답 전달 + DB 업데이트
  - `PATCH /api/interview/[sessionId]/complete` → `sessionComplete=true` (멱등성 보장)
- **엔진 연동:**
  - `engine /api/interview/start`: `{ resumeText, personas: ["hr","tech_lead","executive"], mode: "panel" }` → 첫 질문 + 질문 큐 반환
  - `engine /api/interview/answer?stream=true`: SSE 스트리밍, 3개 분기(Path A: 세션 종료 / Path B: 꼬리질문 / Path C: 다음 질문 생성)
  - `interview-service.ts`가 `engineResultCache` write-ahead 캐싱으로 재시도 시 중복 LLM 호출 방지

**의사결정 근거:**
SSE 드레인 패턴(Issue #215)을 도입한 것은 클라이언트 연결이 도중에 끊겨도 `done` 이벤트까지 엔진 응답을 완주하여 DB 저장을 보장하기 위해서다. `tee()`로 스트림을 분기하여 drain task와 client stream을 동시에 처리한다. 세션 상태(`questionsQueue`, `history`, `currentPersona`)를 DB(Prisma)에서 관리하고 엔진은 stateless로 유지한 것은 엔진 재시작·스케일아웃 시 세션 일관성을 서비스 책임으로 명확히 분리하기 위함이다.

**관련 이슈:** Phase 1 완료 (패널 면접 세션 + 꼬리질문), Issue #85 (interview 신뢰성 개선), Issue #215 (SSE 드레인 패턴)

---

## 기능 04 — 실시간 꼬리질문 엔진 (Clarify · Challenge · Explore)

**기획 의도:**
단순 질문 나열 방식의 면접 연습 앱은 사용자가 준비한 답변을 일방적으로 발화하는 데 그친다. 실전 면접에서 면접관은 지원자의 답변에 즉각 반응하여 불명확한 부분을 재확인하거나, 논리적 근거를 검증하거나, 경험의 심층을 탐색한다. 기능 04는 이 동적 상호작용을 재현하여 잡코리아 AI 면접이 꼬리질문 없이 B2C 수익화에 실패한 지점을 기술적으로 돌파하는 MirAI의 핵심 차별점이다.

**구현 방식:**

- **프론트엔드:** 면접 세션 중 답변 제출 시 `POST /api/interview/answer`가 SSE 스트림으로 `nextQuestion` 또는 꼬리질문을 반환. 클라이언트는 `parseSSEStream(res.body)`으로 `done` 이벤트에서 결과를 추출.
- **API 라우트:**
  - `POST /api/interview/followup` → engine `/api/interview/followup` → `{ followupType, followupQuestion, reasoning }`
- **엔진 연동:**
  - `engine /api/interview/followup`: `{ question, answer, persona, resumeText }` → followupType은 **규칙 기반** (`pressure_controller.py`)으로 결정론적 분류:
    - `star_score < 0.4` 또는 `agency_verb_count == 0` → **CLARIFY**
    - `vague_ratio > 0.03` 또는 원인·대안 분석 없음 → **CHALLENGE**
    - 이외 → **EXPLORE**
  - followupQuestion·reasoning은 LLM 생성. `followup_validator.py`가 코사인 유사도(OVERLAP_THRESHOLD=0.4)로 중복 꼬리질문 자동 재생성(최대 2회)

**의사결정 근거:**
followupType 결정을 LLM이 아닌 규칙 기반(`analyzers/`)으로 처리한 것은 결정론적 일관성을 확보하기 위해서다. LLM은 동일 입력에도 분류가 달라질 수 있으나, TextSignals 기반 규칙은 항상 같은 입력에 같은 꼬리질문 유형을 배정한다. overlap 검증은 꼬리질문이 이미 나온 질문과 사실상 동일한 내용을 반복하는 것을 방지하여 면접 경험의 품질을 유지한다.

**관련 이슈:** Phase 1 완료 (꼬리질문 엔진)

---

## 기능 05 — 연습 모드 및 즉각 피드백 시스템

**기획 의도:**
심리학의 의지적 연습(Deliberate Practice) 이론(Ericsson 외, 1993)은 "짧은 과제 → 즉각 피드백 → 성찰 → 교정"의 순환이 있어야 전문성이 발달한다고 제시한다. 기능 05는 이 순환 구조를 면접 답변 훈련에 적용한다. 사용자는 개별 질문에 대해 답변하고, 즉시 점수와 구체적인 개선 방향을 받으며, 재답변 시 이전 답변과의 비교 분석으로 스스로 성장을 체감한다.

**구현 방식:**

- **프론트엔드:** 질문별 피드백 카드가 점수(0-100), 잘한 점/개선점, 핵심 키워드, 개선된 답변 가이드를 렌더링. 재답변 시 `comparisonDelta`(점수 변화, 개선 항목)를 추가 표시.
- **API 라우트:**
  - `POST /api/practice/feedback` → engine `/api/practice/feedback` → `{ score, feedback: {good, improve}, keywords, improvedAnswerGuide, comparisonDelta? }`
- **엔진 연동:**
  - `engine /api/practice/feedback`: `{ question, answer, previousAnswer?, previousScore? }` 수신
  - `scoreDelta` 계산: `previousScore` 전달 시 서버에서 `new_score - previousScore` 직접 계산 (LLM 추정값 오버라이드)
  - `previousAnswer` 없으면 `comparisonDelta=null`, 있으면 비교 분석 포함

**의사결정 근거:**
scoreDelta를 서버에서 계산하고 LLM 추정값을 오버라이드하는 방식은 LLM이 이전 점수를 정확히 기억하지 못하는 한계를 보완하여 점수 변화의 신뢰성을 확보하기 위함이다. `previousAnswer`를 선택 입력으로 처리하여 첫 번째 시도와 재시도를 동일 엔드포인트에서 처리함으로써 API 단순성을 유지했다.

**관련 이슈:** Issue #86 (연습 모드 피드백)

---

## 기능 06 — 실시간 AI 아바타 및 TTS 기반 몰입형 면접 (Phase 4 예정)

**기획 의도:**
실전 면접의 핵심 난이도는 언어적 내용만이 아니라 비언어적 압박감에서 온다. 면접관의 시선, 목소리 톤, 침묵의 무게가 지원자를 압박한다. 기능 06은 AI 아바타와 TTS 음성 인터랙션으로 이 비언어적 긴장감을 재현하여, 시선 처리·말하는 속도·침묵 대처 등 기능 01~05가 다루지 못하는 비언어적 역량 훈련으로 서비스를 확장한다.

**현재 상태:** 미구현. Phase 4에서 TTS 기술 확정 후 착수 예정.

**선행 조건:** 기능 03~05 안정화 및 사용자 피드백 수집 완료 후 진행. TTS 제공사(ElevenLabs, Typecast 등) 및 아바타 렌더링 방식 기술 검토 필요.

---

## 기능 07 — 8축 역량 평가 및 실행형 리포트

**기획 의도:**
면접 연습의 효과는 "잘했다/못했다"의 주관적 자기평가로는 측정되지 않는다. 기능 07은 면접 세션 전체를 8개 역량 축에 걸쳐 정량적으로 평가하고 실행 가능한 개선 가이드를 제시한다. 세션이 누적될수록 역량 성장 곡선이 가시화되어, 사용자가 자신의 발전을 데이터로 직면(Mirroring)하는 경험을 제공한다.

**구현 방식:**

- **프론트엔드:** `ReportResult.tsx`가 Chart.js Radar 차트(8축), 탭 전환(총평/개선점), 축별 점수 바를 렌더링. `/interview/[sessionId]/report` 페이지가 loading → success/error 상태 머신으로 리포트를 표시.
- **API 라우트:**
  - `POST /api/report/generate` → engine `/api/report/generate` (AbortSignal.timeout 90,000ms, maxDuration=120) → `{ scores, totalScore, summary, axisFeedbacks, growthCurve }` → DB 저장(`reportScores`, `reportTotalScore`)
- **엔진 연동:**
  - `engine /api/report/generate`: `{ resumeText, history: HistoryItem[] }` (history 최소 5개)
  - **채점 전략 v2**: `TextSignals` 신호를 8축 루브릭으로 변환하여 결정론적 점수 산출 → LLM은 피드백 텍스트(`summary`, `axisFeedbacks[].feedback`)만 생성
  - 8축: `communication`, `problemSolving`, `logicalThinking`, `jobExpertise`, `cultureFit`, `leadership`, `creativity`, `sincerity`
  - `not_evaluated`: `has_content=False`인 답변만 있는 축 → `score=null`, `type="not_evaluated"`

**의사결정 근거:**
점수를 LLM에 맡기지 않고 규칙 기반으로 산출한 것(v2 전략)은 LLM 점수의 비결정성을 제거하여 동일 면접 기록에 대해 항상 같은 점수가 나오도록 보장하기 위해서다. LLM은 피드백 텍스트 생성에만 집중하므로 프롬프트 복잡도도 낮아진다. fetch timeout을 90s로 설정한 것은 엔진 내부 LLM timeout(60s)과 예상 응답시간(12-18s)을 고려하여 기본값(30s)으로 인한 서비스 측 선제 타임아웃을 방지하기 위함이다. `saveWithRetry` await 누락 수정(Issue #126)으로 멱등성과 DB 저장 신뢰성을 확보했다.

**관련 이슈:** Issue #82 (8축 역량 평가 리포트), Issue #126 (report/generate 멱등성 수정)

---

## 부가 기능

| 기능 | 구현 내역 | 관련 이슈 |
|------|----------|----------|
| **회원가입 약관 동의** | `signupSchema`에 `agreeToTerms`+`agreeToPrivacy` 추가, `/terms`·`/privacy` 정적 약관 페이지, 미동의 시 가입 차단, `terms_agreed_at` DB 저장, `DELETE /api/auth/delete` 회원탈퇴 API | Issue #245 |
| **직무 확인·수정 UI** | `UploadForm.tsx` `confirming` 단계: engine `/api/resume/analyze` 연동, `targetRole` 2-step 흐름(uploading→confirming→submitting), `POST /api/resumes/analyze` 신규 라우트 | Issue #162 |
| **RAG 파이프라인** | `ENABLE_RAG` 가드, `embedText()`+`searchSimilarPostings()` → `job_context`로 LLM 품질 향상, `rag-prisma.ts`(RAG 전용 PrismaClient, `RAG_DATABASE_URL`), Airflow DAG(`job_crawl_dag.py`) 잡코리아 크롤링→embed→pgvector upsert | Issue #163 |
| **LLM 옵저버빌리티 대시보드** | `GET /api/dashboard/observability`(관리자 전용, 401/403/200), `/dashboard/observability` 페이지(stat 카드·Bar/Line 차트·기간 필터), `event-logger.ts`+9개 API call site 계측, S3 JSONL 적재, Airflow DAG, `analytics.llm_events_daily` | Issue #95, #98 |
| **데모 모드** | 도메인 중립 질문·평가축 동적화·모바일 반응형 지원, 로그인 없이 서비스 핵심 경험 체험 가능 | Issue #302 |
