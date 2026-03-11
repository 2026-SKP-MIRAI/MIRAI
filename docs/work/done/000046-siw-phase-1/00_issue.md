# feat: [siw] Phase 1 — 패널 면접 + 꼬리질문 서비스 연동 (engine #40 e2e)

## 사용자 관점 목표
siw 서비스에서 자소서 업로드 후 3인 패널 면접 세션을 진행하고, 답변 품질에 따라 꼬리질문을 받을 수 있다.

## 배경
engine #40(기능 03·04 — 패널 면접 세션 + 꼬리질문)이 완료되면 siw Next.js 서비스가 이를 연동해야 한다. MVP 01(자소서 → 질문 생성)은 완료 상태이며, 이번 이슈는 Phase 1 기능(면접 세션·꼬리질문) e2e 동작을 위한 서비스 레이어 확장이다.

엔진은 **완전 stateless** — 세션 상태(history, questionsQueue, resumeText)는 siw가 Supabase에서 관리하고, 엔진 호출 시 풀 컨텍스트를 전달한다.

## 완료 기준
- [ ] `POST /resume/[resumeId]/interview/start` — engine `/api/interview/start` 호출 → firstQuestion + questionsQueue Supabase 저장
- [ ] `POST /resume/[resumeId]/interview/answer` — Supabase에서 history·queue 조회 → engine `/api/interview/answer` 호출 → 결과 저장 후 nextQuestion 반환
- [ ] 면접 세션 UI (`/interview` 페이지) — 질문 표시, 답변 입력, 꼬리질문 흐름 표시
- [ ] Supabase 테이블: `interview_sessions` (resumeText, questionsQueue, history, sessionComplete)
- [ ] Playwright e2e 테스트: 자소서 업로드 → 면접 세션 시작 → 답변 → 꼬리질문 수신 전 과정

## 구현 플랜
1. **Supabase 스키마**: `interview_sessions` 테이블 설계 + RLS 설정
2. **API 라우트**:
   - `app/api/interview/start/route.ts` — engine 프록시 + Supabase 저장
   - `app/api/interview/answer/route.ts` — Supabase 조회 → engine 프록시 → 저장
3. **UI 컴포넌트**:
   - `InterviewChat.tsx` — 페르소나 레이블 + 질문·답변 버블
   - `AnswerInput.tsx` — 텍스트 입력 + 제출
4. **페이지**: `app/interview/page.tsx`
5. **Playwright e2e**: 기존 `tests/e2e/resume-upload.spec.ts` 패턴 확장

## 개발 체크리스트
- [ ] 테스트 코드 포함 (Vitest unit + Playwright e2e)
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 직접 호출 금지 — 엔진 경유만)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 (`NEXT_PUBLIC_` 금지)
- [ ] engine #40 완료 후 시작 (의존성)

---

## 작업 내역

### 아키텍처 결정
- engine은 완전 stateless 유지 — siw가 Prisma(Supabase PostgreSQL)로 세션 상태 전담 관리
- resumeText는 클라이언트를 경유하지 않고 siw 서버에서 pdf-parse로 직접 추출 후 DB 저장, 클라이언트에는 `resumeId`만 반환 (보안 이슈 #15 해결)
- DDD 레이어 구조 적용: API Route(얇은 진입점) → Service(비즈니스 로직) → Repository(Prisma CRUD)

### 주요 변경 파일

**`services/siw/prisma/schema.prisma`** (신규)
- `ResumeSession` 모델: PDF 텍스트 저장 + UUID 발급
- `InterviewSession` 모델: `currentQuestion` / `currentPersona` / `currentQuestionType` 컬럼 추가 — answer 라우트에서 Prisma를 통해 이전 질문 컨텍스트 복원 (이슈 #1 해결)

**`src/lib/pdf-parser.ts`** (신규)
- pdf-parse v2 `PDFParse` 클래스 래핑 — vitest에서 `vi.mock("@/lib/pdf-parser")`로 mock 가능하게 추상화 (이슈 #6, #7 해결)

**`src/app/api/resume/questions/route.ts`** (확장)
- `parsePdf()` 호출로 resumeText 추출 → `resumeRepository.create()`로 DB 저장 → 응답에 `resumeId` 포함
- next.config.ts에 `serverExternalPackages: ["pdf-parse"]` 추가 (webpack 번들링 충돌 이슈 #8 해결)

**`src/lib/resume-repository.ts`** (신규)
- `ResumeSession` Prisma CRUD: `create(resumeText) → id`, `findById(id) → resumeText`
- Prisma v7 `PrismaPg` 어댑터 패턴 적용 (이슈 #9 해결)

**`src/lib/interview/interview-service.ts`** (신규)
- `start()`: DB에서 resumeText 조회 → engine `/api/interview/start` 호출(3회 재시도) → `interview_sessions` INSERT
- `answer()`: Prisma에서 풀 컨텍스트 복원(resumeText, history, questionsQueue, currentQuestion, currentPersona) → engine 6필드 전달 → history append + DB 갱신
  - engine에 전달하는 history에서 `type` 필드 제거 (Pydantic extra field 오류 이슈 #16 해결)
  - 3회 재시도 로직 추가 (LLM 2회 호출 간헐적 실패 이슈 #17 해결)
- `followup()`: Prisma에서 resumeText 조회 → engine `/api/interview/followup` 호출

**`src/app/api/interview/answer/route.ts`** (신규)
- 세션 미존재 시 `Prisma.PrismaClientKnownRequestError` + code `P2025` 체크로 404 반환 (코드리뷰 #18 수정)

**`src/components/QuestionList.tsx`** (확장)
- "면접 시작하기" 버튼 추가 — `resumeId`를 `/api/interview/start`에 전달, `sessionId` 수신 후 `/interview/[sessionId]`로 이동
- firstQuestion을 `sessionStorage`에 저장해 `/interview/[sessionId]` 페이지 초기 렌더링에 활용

**`src/app/interview/[sessionId]/page.tsx`** (신규)
- `sessionStorage`에서 첫 질문 복원 → `InterviewChat` + textarea + "답변 제출" 버튼
- `sessionComplete=true` 시 "다시 하기" → `/resume`

### 테스트
- Vitest 유닛/API/UI 테스트 32건 추가 (mock 기반)
- Playwright e2e 2건: 업로드 → 질문 → 면접 시작 → 답변 → 완료 전 과정 (180초 타임아웃)

