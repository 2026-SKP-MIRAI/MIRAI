# Fint 서비스 개발 스펙

> 최종 업데이트: 2026-03-16
> MVP 및 Phase 1 기준 작성. Phase 2+3은 개발 레퍼런스용.

---

## 서비스 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | Next.js 14+ (App Router), TypeScript |
| UI | Shadcn UI, Tailwind CSS v4 |
| 모바일 | 모바일 웹 우선 (375px 기준), PWA 고려 |
| 백엔드 | 별도 서비스 — 상세 스펙은 `engine/.ai.md` 참조 |

**인프라 & 호스팅**

- **프론트엔드 호스팅**: Vercel
  - `maxDuration` 설정으로 서버리스 함수 타임아웃 제어 (현재 110s)
  - 환경변수는 Vercel 대시보드에서 관리
- **BaaS**: Supabase
  - Auth: Supabase Auth (`@supabase/ssr`)
  - DB: Supabase PostgreSQL
  - Storage: Supabase Storage (버킷명은 `SUPABASE_STORAGE_BUCKET` 환경변수)
  - `SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 — `NEXT_PUBLIC_` 절대 금지

**아키텍처 불변식**

- 인증은 서비스(Next.js)에서만 — 엔진은 인증 로직 없이 내부 호출만 수신
- 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM을 호출하지 않는다

---

## MVP 기능 스펙

> MVP 핵심 플로우: 직군 선택 → 채팅 면접(5문항) → 결과 리포트 → 가입 유도
> 인증 없음 — 선 체험 후 가입 방식 (로그인은 Phase 1)

### 1.1 채팅형 모의면접

**AC:**
- [ ] AI 면접관이 질문을 채팅 버블로 표시
- [ ] 유저 텍스트 입력 → AI 꼬리질문 생성
- [ ] 면접 중 중단 가능 (이어하기 지원)
- [ ] 질문 5~10개 완료 시 자동 종료
- [ ] 30초 답변 없을 때 "천천히 해도 괜찮아요" 힌트 표시

**API:**
```
POST /api/interview/start
→ { sessionId, firstQuestion, questionsQueue }

POST /api/interview/answer
→ { sessionId, answer }
→ { nextQuestion | null, updatedQueue, isComplete }

POST /api/interview/end
→ { sessionId }
→ { reportId }
```

> **엔진 Stateless 패턴**: 엔진은 상태를 저장하지 않는다. 서비스(Next.js)가 DB에 `history`와 `questionsQueue`를 보관하고, 매 엔진 호출 시 전체를 전달해야 한다.
> - `/api/interview/start` 엔진 호출: `{ resumeText, personas, mode }` → 엔진이 `firstQuestion + questionsQueue` 반환
> - `/api/interview/answer` 엔진 호출: `{ resumeText, history, questionsQueue, currentAnswer }` → 엔진이 `nextQuestion + updatedQueue` 반환
> - 서비스는 매 답변 후 DB의 `history`와 `questionsQueue`를 갱신해 다음 요청에 사용

### 엔진 신규 개발 필요 엔드포인트 (Phase별)

> 아래 엔드포인트는 현재 엔진에 없음. Phase 진입 전 설계·구현 필요.
> 기존 구현 완료 엔드포인트: `/api/resume/questions`, `/api/interview/start`, `/api/interview/answer`, `/api/interview/followup`, `/api/report/generate`

#### [Phase 1 후반]

**`POST /api/interview/readiness`** — 합격 예언 오브
- 입력: `{ history: HistoryItem[], totalSessions: number, jobCategory: string }`
- 출력: `{ readinessScore: number(0-100), weakAxes: string[], strongAxes: string[], recommendation: string }`
- 설명: 누적 면접 세션 데이터 분석 → 현재 준비도 점수 + 집중 보완 영역 진단

#### [Phase 2+3]

**`POST /api/profile/mbti-card`** — 직무 MBTI 카드
- 입력: `{ history: HistoryItem[], jobCategory: string }`
- 출력: `{ mbtiType: string, traits: string[], matchedCompanyTypes: string[], shareImageUrl: string }`
- 설명: 면접 이력 기반 성향 4축 분류 + SNS 공유 카드 생성

**`POST /api/entertainment/fortune`** — 오늘의 면접 운세
- 입력: `{ jobCategory: string, date: string }`
- 출력: `{ fortuneText: string, luckyKeyword: string, advice: string }`
- 설명: 직군별 AI 타로·포춘쿠키 (LLM 단순 호출)

**`POST /api/persona/generate-post`** — AI 커뮤니티 페르소나 피드 생성
- 입력: `{ personaType: "job_seeker" | "employee", jobCategory: string, topic: string }`
- 출력: `{ postContent: string, tags: string[] }`
- 설명: AI가 취준생/현직자 역할로 커뮤니티 피드 글 자율 생성 (🤖 배지 기본 공개)

**`POST /api/content/aha-point-assist`** — 아차 포인트 AI 작성 보조
- 입력: `{ rawInput: string, interviewerRole: string, jobCategory: string }`
- 출력: `{ structuredContent: string, suggestedTitle: string, keywords: string[] }`
- 설명: 현직자 면접관 경험 입력 → AI가 구조화된 "아차 포인트" 콘텐츠로 정리

**`POST /api/profile/career-timing`** — 이직 타이밍 분석 (현직자 전용)
- 입력: `{ currentRole: string, yearsOfExperience: number, industry: string, signals: string[] }`
- 출력: `{ timingScore: number(0-100), marketTrend: string, recommendation: string, bestMoveWindow: string }`
- 설명: 현직자 프로필 + 시장 신호 기반 이직 적기 분석

---

### 1.2 결과 리포트

**AC:**
- [ ] 면접 완료 후 자동으로 리포트 화면 이동
- [ ] 종합 점수 (0~100) 표시
- [ ] 항목별 점수: 8축 평가 (communication, problemSolving, logicalThinking, jobExpertise, cultureFit, leadership, creativity, sincerity)
- [ ] 실행형 피드백: "잘한 점 2개 + 개선점 2개" 형태
- [ ] 리포트 저장 및 히스토리에서 다시 열람 가능
- [ ] 리포트 생성은 비동기 처리 — `status` 필드로 진행 상태 확인

**API:**
```
GET /api/interview/report?id={reportId}
→ { status: 'processing' | 'completed' | 'failed', totalScore, subScores[], feedback{ pros[], improvements[] } }
```

> **타임아웃**: 엔진 `/api/report/generate` 호출 시 fetch timeout을 **95초**로 설정. 리포트 생성은 90초 이상 소요될 수 있음. 기본값(30s)으로 호출하면 LLM 응답 전에 서비스 측이 먼저 타임아웃 발생.

> **MVP Non-streaming**: MVP는 스트리밍 없이 단순 Request/Response 패턴 사용. SSE/스트리밍은 Phase 1에서 도입 예정.

---

---

## Phase 1 기능 스펙

### 2.1 인증 (Phase 1)

**AC:**
- [ ] 카카오·구글 소셜 로그인 지원
- [ ] 이메일·비밀번호 가입 및 로그인 지원
- [ ] 로그인 완료 후 이전 면접 결과 저장 및 히스토리 접근
- [ ] 신규 유저: 직군 선택 → 홈 이동
- [ ] 기존 유저: 홈으로 바로 이동
- [ ] 미로그인 상태 결과 리포트 → "저장하려면 로그인" CTA 표시

**API:**

#### 소셜 로그인
```
POST /api/auth/kakao
POST /api/auth/google
GET  /api/auth/session
DELETE /api/auth/logout
```

#### 이메일 가입 (Phase 1)
```
POST /api/auth/signup           → { email, password } → 인증 메일 발송
POST /api/auth/login            → { email, password } → { session }
POST /api/auth/verify-email     → Supabase 이메일 인증 콜백 처리
POST /api/auth/resend-verify    → 인증 메일 재발송
POST /api/auth/forgot-password  → 비밀번호 재설정 메일 발송
POST /api/auth/reset-password   → { token, newPassword } → 비밀번호 변경
```

> **이메일 인증 플로우**: 가입 → Supabase가 인증 메일 발송 → 유저가 링크 클릭 → `/api/auth/verify-email` 콜백 → 인증 완료 → 자동 로그인
> **미인증 계정 제한**: 이메일 인증 전까지 면접 결과 저장·크레딧 획득 불가. MVP 익명 세션과 동일 취급.

---

### 2.2 자소서 업로드 및 분석

**AC:**
- [ ] PDF, HWP, DOC 파일 업로드 지원 (최대 10MB)
  - **HWP 파싱 주의**: 오픈소스 파서가 제한적 — hwp.js 또는 서버사이드 LibreOffice 변환 방식 검토 필요 (MVP 일정 리스크)
- [ ] 업로드 완료 후 AI 엔진이 맞춤 질문 생성 (5~10개)
- [ ] 업로드 없이도 면접 시작 가능 (기본 질문 세트 사용)
- [ ] 업로드 실패 시 에러 메시지 표시

**API:**
```
POST /api/interview/upload-resume
→ { fileUrl, interviewId, questions[] }

GET  /api/interview/questions?id={interviewId}
```

---

### 2.3 크레딧 시스템

**AC:**
- [ ] 유저별 크레딧 잔액 DB 관리
- [ ] 획득 이벤트: 면접 완료 (+N [미확정]), 프로필 완성 (+N [미확정]), 연속 N일 (+N [미확정])
- [ ] 일일 획득 상한 설정 (N크레딧/일, 어뷰징 방지)
- [ ] AI 페르소나 계정의 크레딧 집계 제외
- [ ] 크레딧 내역 조회 API

**API:**
```
GET  /api/coins/balance
GET  /api/coins/history
POST /api/coins/earn  → { event: 'interview_complete' | 'profile_complete' | ... }
```

> **보안 주의**: `/api/coins/earn`은 클라이언트가 직접 호출하면 어뷰징 가능. **크레딧 지급은 서버 이벤트(면접 완료, 리포트 조회)에서만 서버 사이드로 처리**해야 하며, 클라이언트에서 직접 호출하는 흐름은 금지.

**Phase 1 후반 크레딧 소비처 (별도 기능 명세):**
- [ ] 합격 예언 오브: 결과 리포트 화면에서 크레딧 소비 후 잠금 해제 (크레딧 수량 미확정)
- [ ] 고득점 Q&A 잠금 해제: 동일 질문 고득점 답변 열람 (크레딧 수량 미확정)

---

### 2.4 운영 인프라 (법적 의무)

**신고·제재 시스템:**
- [ ] 부적절 콘텐츠 신고 기능 (신고 후 즉시 비공개)
- [ ] 크레딧 어뷰징 탐지 (일일 상한 초과 시 자동 차단)
- [ ] 운영자 관리 대시보드 (신고 목록, 제재 이력)

**개인정보 처리:**
- [ ] 자소서 업로드 = 민감 개인정보 → 암호화 저장
- [ ] 재직 인증 데이터 별도 관리
- [ ] 탈퇴 시 데이터 삭제 정책 (30일 이내 삭제)

**CS 체계:**
- [ ] 크레딧 분쟁 신청 폼
- [ ] 결제 취소 처리 API (미사용 크레딧 7일 청약철회 [검토 중])

---

## Phase 2 추가 기능 스펙 (개발 레퍼런스용)

### 2.1 페르소나 마켓

**AC:**
- [ ] 현직자가 페르소나 등록 (회사·직군·질문 세트·소개)
- [ ] 취준생이 크레딧으로 페르소나 면접 구매
- [ ] 크레딧 배분: 현직자 70%, 플랫폼 30% (자동 계산)
- [ ] 페르소나 평점 시스템 (5점 만점)
- [ ] 인기순·직군별 필터링
- [ ] 현직자 프로필 완성 시 크레딧 지급 (연봉·직군·연차 입력 완료, 수량 미확정)
  - `coins/earn` 이벤트: `professional_profile_complete`

**API:**
```
POST /api/persona/create
GET  /api/persona/list?category=&sort=
POST /api/persona/purchase  → { personaId } → { sessionId, coins_deducted }
GET  /api/persona/my        (현직자용 — 통계, 평점, 소비 횟수)
```

---

### 2.2 쪽지 시스템

**AC:**
- [ ] 취준생 → 현직자 쪽지 발송 (N크레딧 소비)
- [ ] 쪽지 본문 최대 300자 제한
- [ ] 현직자 응답 (무료)
- [ ] 48시간 응답률 트래킹 (Phase 2+3 진입 조건 지표)
- [ ] 쪽지함 UI (카카오 채팅 스타일)
- [ ] 크레딧 부족 시 발송 불가 안내

**API:**
```
POST /api/message/send    → { toUserId, content } → { messageId, coins_deducted }
GET  /api/message/inbox
POST /api/message/reply   → { messageId, content }
GET  /api/message/response-rate  (운영자용)
```

---

### 2.3 AI·사람 혼재 커뮤니티

**AC:**
- [ ] 피드 게시물 작성 (익명 / 실명 선택)
- [ ] AI 페르소나 계정 활동 지원
- [ ] AI 게시물·댓글에 🤖 배지 자동 표시 (디폴트 오픈)
- [ ] 이용약관에 "AI와 사람이 함께 활동하는 플랫폼" 명시

**API:**
```
POST /api/feed/post
GET  /api/feed/list  → { posts[{ ...post, isAI: boolean }] }
```

---

### 2.4 Phase 2 게이미피케이션 기능 (개발 레퍼런스용)

**AC:**
- [ ] 익명 응원 폭탄: 취준생이 크레딧 소비 → 랜덤 취준생에게 익명 응원 발송
- [ ] 직무 MBTI 카드: 면접 기록 기반 성향 분석 결과 카드 생성 (공유 가능)
- [ ] 연봉 통계: 현직자 익명 연봉 데이터 기반 직군별 연봉 분포 열람 (크레딧 소비)
- [ ] 아차 포인트: 면접 중 놓친 핵심 키워드 분석 제공 (크레딧 소비)
- [ ] 고득점 Q&A: 동일 질문 고득점 답변 사례 열람 (크레딧 소비, Phase 1 후반 일부 오픈)

**API:**
```
POST /api/community/cheer-bomb   → { coins_deducted, targetUserId }
GET  /api/stats/mbti-card        → { mbtiType, traits[], shareUrl }
GET  /api/stats/salary?category= → { distribution[], median } (크레딧 소비)
GET  /api/interview/aha-points?sessionId= → { missedKeywords[] } (크레딧 소비)
```

### 2.5 운영 모니터링 대시보드

**지표:**
- 크레딧 순환 현황 (총 발행량 vs 소비량)
- 어뷰징 탐지 알림
- Phase 전환 조건 진행률 (MAU, 세션 수, D7 리텐션, 응답률)
- AI 페르소나 활동 vs 실제 유저 비율

---

## 데이터 모델 (핵심 엔티티)

```typescript
User {
  id: string
  type: 'jobseeker' | 'professional' | 'ai_persona'
  coins: number
  streak: number
  lastActiveAt: Date
  onboardingCompleted: boolean
  verificationStatus: 'none' | 'email_verified' | 'document_pending' | 'document_verified'
  verifiedAt?: Date
}

InterviewSession {
  id: string
  userId?: string        // nullable — MVP는 익명 사용자 지원
  anonymousId: string    // 비로그인 사용자 식별용 (로그인 시에도 보관)
  personaId?: string
  status: 'in_progress' | 'completed' | 'abandoned'
  questions: Question[]
  answers: Answer[]
  history: HistoryItem[]       // 엔진 stateless 패턴 — 매 엔진 호출 시 전달
  questionsQueue: QueueItem[]  // 엔진 stateless 패턴 — 매 엔진 호출 시 전달
  reportId?: string
}

// 8축 평가 점수 (엔진 /api/report/generate 출력 구조와 일치)
AxisScores {
  communication: number    // 의사소통 능력
  problemSolving: number   // 문제 해결력
  logicalThinking: number  // 논리적 사고력
  jobExpertise: number     // 직무 전문성
  cultureFit: number       // 조직 적합성
  leadership: number       // 리더십
  creativity: number       // 창의성
  sincerity: number        // 성실성·진정성
}

Report {
  id: string
  sessionId: string
  status: 'processing' | 'completed' | 'failed'  // 비동기 생성 상태
  totalScore: number
  subScores: AxisScores   // 8축 점수
  axisFeedbacks: { axis: string; type: 'strength' | 'improvement'; feedback: string }[]
  feedback: { pros: string[]; improvements: string[] }
}

// 리포트 인가 규칙:
// - 비로그인 사용자: 세션 내에서만 접근 가능 (sessionToken으로 검증, anonymousId 기반)
// - 로그인 사용자: 자신의 리포트(userId 일치)만 접근 가능

Persona {
  id: string
  creatorId: string
  company: string
  category: string
  title: string
  questionSet: Question[]
  rating: number
  usageCount: number
  coinsEarned: number
}

CoinTransaction {
  id: string
  userId: string
  amount: number  // 양수=획득, 음수=소비
  event: CoinEvent
  createdAt: Date
  expiresAt?: Date  // 마지막 활동 후 N개월 미사용 시 만료 (수량 미확정)
}

Message {
  id: string
  fromUserId: string
  toUserId: string
  content: string
  respondedAt?: Date
  coinsSpent: number
}
```

---

## DB 스키마 (Supabase PostgreSQL)

> Supabase 기준 SQL. RLS(Row Level Security) 정책 포함.

### [MVP] interview_sessions

```sql
create table interview_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,  -- nullable: MVP 익명 지원
  anonymous_id text not null,                                       -- 비로그인 식별자 (로그인 후에도 보관)
  job_category text not null,
  persona_id  uuid,
  status      text not null default 'in_progress'
                check (status in ('in_progress', 'completed', 'abandoned')),
  questions   jsonb not null default '[]',
  answers     jsonb not null default '[]',
  history     jsonb not null default '[]',       -- 엔진 stateless: 매 호출 시 전달
  questions_queue jsonb not null default '[]',   -- 엔진 stateless: 매 호출 시 전달
  report_id   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table interview_sessions enable row level security;

-- 비로그인: anonymous_id 일치 시 읽기 허용
create policy "anon read own session"
  on interview_sessions for select
  using (anonymous_id = current_setting('app.anonymous_id', true));

-- 로그인: 본인 세션만 읽기
create policy "auth read own session"
  on interview_sessions for select
  to authenticated
  using (user_id = auth.uid());
```

### [MVP] reports

```sql
create table reports (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references interview_sessions(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete set null,
  anonymous_id text not null,
  status       text not null default 'processing'
                 check (status in ('processing', 'completed', 'failed')),
  total_score  integer,
  axis_scores  jsonb,   -- AxisScores (8축)
  axis_feedbacks jsonb, -- AxisFeedback[]
  summary      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS
alter table reports enable row level security;

create policy "anon read own report"
  on reports for select
  using (anonymous_id = current_setting('app.anonymous_id', true));

create policy "auth read own report"
  on reports for select
  to authenticated
  using (user_id = auth.uid());
```

### [Phase 1] users (프로필 확장)

> Supabase Auth가 `auth.users`를 관리. 아래는 프로필 확장 테이블.

```sql
create table profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  name                text,
  avatar_url          text,
  type                text not null default 'jobseeker'
                        check (type in ('jobseeker', 'professional', 'ai_persona')),
  job_category        text,
  prep_stage          text,
  coins               integer not null default 0,
  streak              integer not null default 0,
  last_active_at      timestamptz,
  onboarding_completed boolean not null default false,
  verification_status text not null default 'none'
                        check (verification_status in (
                          'none', 'email_verified', 'document_pending', 'document_verified'
                        )),
  verified_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- RLS: 본인만 읽기/수정
alter table profiles enable row level security;

create policy "read own profile"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- auth.users 생성 시 자동으로 profiles 레코드 삽입
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
```

### [Phase 1] coin_transactions

```sql
create table coin_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     integer not null,  -- 양수: 획득, 음수: 소비
  event_type text not null,     -- 'interview_complete' | 'profile_complete' | 'persona_consumed' | ...
  ref_id     uuid,              -- 관련 엔티티 id (session_id, persona_id 등)
  created_at timestamptz not null default now()
);

-- RLS: 본인 내역만 조회
alter table coin_transactions enable row level security;

create policy "read own transactions"
  on coin_transactions for select
  to authenticated
  using (user_id = auth.uid());

-- 서버 사이드 전용 insert (클라이언트 직접 호출 금지)
```

> **주의**: `coin_transactions` insert는 서버 사이드 전용. 클라이언트에서 직접 호출 금지 (어뷰징 방지).

---

## 보안·컴플라이언스

- **자소서 파일:** S3 서버사이드 암호화 (AES-256)
- **개인정보 처리방침:** 개인정보보호법 준수
- **크레딧 이체 금지:** API 레벨에서 유저 간 크레딧 전송 엔드포인트 없음
- **AI 페르소나 식별:** DB 레벨 `type: 'ai_persona'` — 크레딧 집계·지표에서 항상 제외
- **법적 고지:** 이용약관에 크레딧 현금화 불가, AI 혼재 플랫폼 명시
- **크레딧 지급 서버 사이드 전용:** `/api/coins/earn`은 서버 이벤트에서만 호출. 클라이언트 직접 호출 금지.
- **리포트 인가:** 비로그인 사용자는 세션 내에서만 리포트 접근 가능 (sessionToken + anonymousId 검증). 로그인 사용자는 자신의 리포트(userId 일치)만 접근 가능.
