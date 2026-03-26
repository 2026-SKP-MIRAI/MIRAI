# [#247] feat: [siw] 비로그인 데모 면접 체험 — 아하 모먼트 → 가입 전환 — 구현 계획

> 작성: 2026-03-25
> 간소화: 데모 결과 저장 기능 제거 (1문 체험이므로 불필요, 복잡도 감소)

---

## 완료 기준

- [x] 비로그인 사용자가 `/demo`에서 직무 선택 → 질문 1개 답변 → 피드백 + 8축 분석 결과 확인 가능
- [x] 결과 화면에서 "전체 면접 시작하기" → `/signup` CTA
- [x] IP 기반 rate limit 적용 (하루 3회)
- [x] 미들웨어 변경 없음 (기존 인증 플로우 영향 없음)
- [x] 랜딩 Hero 버튼: 비로그인 시 "데모로 체험하기(`/demo`)", 로그인 시 "대시보드 보기(`/dashboard`)"

---

## UX 플로우

```
랜딩 (비로그인)
  └─ "데모로 체험하기" 클릭
      └─ /demo
          ├─ [Step 1] 직무 선택
          ├─ [Step 2] 질문 표시 + 답변 textarea
          ├─ [Step 3] 로딩 (피드백 + 8축 분석 병렬)
          └─ [Step 4] 결과 화면
              ├─ [primary]   "전체 면접 시작하기" → /signup
              └─ [secondary] "로그인" → /login

랜딩 (로그인)
  └─ "대시보드 보기" 클릭 → /dashboard

/demo 직접 접근 (rate limit 초과)
  └─ 직무 선택 시 429
      └─ "오늘 무료 체험 3회를 모두 사용했습니다. 가입하면 무제한으로 이용할 수 있어요."
          └─ "가입하러 가기" → /signup
```

---

## 구현 계획

### Step 1: Prisma 스키마 — `DemoUsage` 모델 추가

**파일:** `services/siw/prisma/schema.prisma`

```prisma
model DemoUsage {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  ipHash    String
  date      String   // YYYY-MM-DD UTC
  count     Int      @default(1)

  @@unique([ipHash, date])
  @@map("demo_usage")
}
```

**구현 세부사항:**
- `ipHash`: `crypto.createHash("sha256").update(ip + process.env.DEMO_RATE_LIMIT_SALT).digest("hex")`
  - IP 추출: `request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"`
- `date`: `new Date().toISOString().slice(0, 10)` (UTC 기준 YYYY-MM-DD)
- 마이그레이션: `npx prisma migrate dev --name add_demo_usage`

**AC:**
- [ ] `npx prisma migrate dev` 성공
- [ ] `prisma.demoUsage.upsert()` 정상 동작

---

### Step 2: API 라우트 3개

#### 2-1. `/api/demo/question/route.ts` — 질문 생성 + rate limit

**파일:** `services/siw/src/app/api/demo/question/route.ts`

```
export const runtime = "nodejs"
export const maxDuration = 30
```

**Request:**
```typescript
// POST /api/demo/question
{ targetRole: string }  // e.g. "프론트엔드 개발자"
```

**Response 200:**
```typescript
{ question: string; persona: string; remainingToday: number }
```

**Response 429:**
```typescript
{ message: string; resetAt: string }  // 다음 날 00:00 UTC
```

**로직:**
1. IP 추출 → SHA-256 해싱
2. `prisma.demoUsage.upsert({ where: { ipHash_date }, create: {..., count:1}, update: { count: { increment: 1 } } })`
3. upsert 결과 count > 3 → 429 반환
4. 엔진 호출: `POST ENGINE_BASE_URL/api/interview/start`
   - body: `{ resumeText: "지원 직무: {targetRole}", personas: ["hr"], mode: "panel" }`
5. 첫 번째 질문 + persona 반환

**AC:**
- [ ] 하루 1~3번째 요청: 200 + question 반환
- [ ] 하루 4번째 요청: 429 + resetAt 반환
- [ ] targetRole 미입력: 400

#### 2-2. `/api/demo/feedback/route.ts` — 답변 피드백

**파일:** `services/siw/src/app/api/demo/feedback/route.ts`

```
export const runtime = "nodejs"
export const maxDuration = 60
```

**Request:**
```typescript
{ question: string; answer: string }
```

**Response 200:** 엔진 응답 passthrough (score, feedback, keywords, improvedAnswerGuide)

**로직:**
1. 인증 불필요
2. 입력 검증: question/answer 필수, answer 공백 체크
3. `POST ENGINE_BASE_URL/api/practice/feedback` 호출
4. 엔진 응답 그대로 반환

**AC:**
- [ ] 비로그인 상태 호출 가능
- [ ] answer 공백만 입력 시 400
- [ ] 엔진 실패 시 502

#### 2-3. `/api/demo/evaluate/route.ts` — 8축 평가

**파일:** `services/siw/src/app/api/demo/evaluate/route.ts`

```
export const runtime = "nodejs"
export const maxDuration = 90
```

**Request:**
```typescript
{ targetRole: string; question: string; answer: string; persona: string }
```

**Response 200:** 엔진 응답 passthrough (scores, totalScore, summary, axisFeedbacks)

**로직:**
1. 인증 불필요
2. history 구성: `[{ persona, personaLabel, question, answer }]`
3. `POST ENGINE_BASE_URL/api/report/generate`
   - body: `{ resumeText: "지원 직무: {targetRole}", history }`
4. 엔진 응답 그대로 반환

**AC:**
- [ ] 비로그인 상태 호출 가능
- [ ] 8축 scores + totalScore 반환
- [ ] 엔진 실패 시 502

---

### Step 3: 데모 체험 페이지

**파일:** `services/siw/src/app/(landing)/demo/page.tsx`

**UI 스텝 (클라이언트 컴포넌트):**

| Step | 화면 | API 호출 |
|------|------|----------|
| 1 | 직무 선택 버튼 (개발/기획/마케팅/디자인) | `POST /api/demo/question` |
| 2 | 질문 표시 + 답변 textarea | — |
| 3 | 로딩 | `POST /api/demo/feedback` + `POST /api/demo/evaluate` (병렬) |
| 4 | 결과: 피드백 + 8축 레이더 차트 + CTA | — |

**Step 4 결과 화면 CTA:**
- [primary] "전체 면접 시작하기" → `/signup`
- [secondary] "로그인" → `/login`

**rate limit 초과 처리:**
- Step 1에서 429 수신 시 → 인라인 메시지 + "가입하러 가기 → `/signup`" 버튼 표시

**UI 스타일:** 기존 `(landing)/page.tsx` 디자인 시스템 따름 (violet gradient, glass-card)

**AC:**
- [ ] 비로그인 상태에서 전체 플로우 완료 가능
- [ ] 로딩 상태 표시 (피드백/평가 각각)
- [ ] 429 시 사용자 친화적 메시지 + 가입 유도
- [ ] 모바일 반응형

---

### Step 4: 랜딩 페이지 Hero 버튼 교체

**파일:** `services/siw/src/app/(landing)/page.tsx`

**변경 대상:** Hero 섹션 두 번째 버튼 (현재 "대시보드 보기")

```typescript
// 기존 StartButton (로그인 → /dashboard, 비로그인 → /login)
<StartButton className="btn-outline ...">대시보드 보기</StartButton>

// 변경 후: isLoggedIn 상태 활용 (이미 useEffect로 관리 중)
{isLoggedIn ? (
  <StartButton className="btn-outline ...">대시보드 보기</StartButton>
) : (
  <Link href="/demo" className="btn-outline ...">데모로 체험하기</Link>
)}
```

**AC:**
- [ ] 비로그인 시 "데모로 체험하기" → `/demo` 이동
- [ ] 로그인 시 "대시보드 보기" → `/dashboard` 이동
- [ ] 첫 번째 버튼("무료로 시작하기") 동작 유지

---

### Step 5: 테스트 + .ai.md

| 파일 | 검증 대상 |
|------|----------|
| `src/app/api/demo/__tests__/question.test.ts` | rate limit 6개 시나리오, targetRole 필수 |
| `src/app/api/demo/__tests__/feedback.test.ts` | 비로그인 허용, 공백 답변 400, 엔진 프록시 |
| `src/app/api/demo/__tests__/evaluate.test.ts` | 비로그인 허용, 8축 응답 구조 |
| `src/app/(landing)/demo/.ai.md` | 페이지 목적, 스텝 구조, rate limit 정책 |
| `src/app/api/demo/.ai.md` | API 엔드포인트 명세 |

**rate limit 테스트 시나리오:**
```
1. 같은 IP, 같은 날 1회 → 200 (remaining=2)
2. 같은 IP, 같은 날 2회 → 200 (remaining=1)
3. 같은 IP, 같은 날 3회 → 200 (remaining=0)
4. 같은 IP, 같은 날 4회 → 429
5. 다른 IP, 같은 날    → 200 (remaining=2)
6. 같은 IP, 다른 날    → 200 (remaining=2, 일별 리셋)
```

---

## 파일 변경 요약

| # | 파일 | 유형 |
|---|------|------|
| 1 | `services/siw/prisma/schema.prisma` | 수정 — DemoUsage 모델 추가 |
| 2 | `services/siw/src/app/api/demo/question/route.ts` | 신규 — 질문 생성 + rate limit |
| 3 | `services/siw/src/app/api/demo/feedback/route.ts` | 신규 — 피드백 프록시 |
| 4 | `services/siw/src/app/api/demo/evaluate/route.ts` | 신규 — 8축 평가 프록시 |
| 5 | `services/siw/src/app/(landing)/demo/page.tsx` | 신규 — 데모 체험 페이지 |
| 6 | `services/siw/src/app/(landing)/page.tsx` | 수정 — Hero 버튼 조건부 렌더링 |
| 7 | `services/siw/src/app/api/demo/__tests__/question.test.ts` | 신규 |
| 8 | `services/siw/src/app/api/demo/__tests__/feedback.test.ts` | 신규 |
| 9 | `services/siw/src/app/api/demo/__tests__/evaluate.test.ts` | 신규 |
| 10 | `services/siw/src/app/(landing)/demo/.ai.md` | 신규 |
| 11 | `services/siw/src/app/api/demo/.ai.md` | 신규 |

> 제거된 항목: `/api/demo/save`, `/demo/save` 페이지, sessionStorage 로직,
> `signup/page.tsx` 수정, `auth/callback` 수정 (전부 데모 결과 저장 관련)

---

## 구현 순서

1. Prisma 스키마 + 마이그레이션 (DemoUsage)
2. API 라우트 3개 (question → feedback → evaluate)
3. 랜딩 Hero 버튼 교체
4. 데모 체험 페이지 (`/demo`)
5. 테스트 + .ai.md
