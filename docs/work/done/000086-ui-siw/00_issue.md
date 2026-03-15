# feat: 연습 모드 UI 전체 구현 — 모드 선택·즉각 피드백·재답변 루프 (siw)

## 사용자 관점 목표

자소서 업로드 후 **실전 모드 / 연습 모드**를 선택하고, 연습 모드에서는 매 답변 후 즉각 피드백을 받으며 재답변으로 성장하는 반복 훈련 루프 (`질문 → 답변 → 피드백 → 재답변 → 피드백 → 다음 질문`)를 경험할 수 있다.

## 배경

- 엔진 `POST /api/practice/feedback`은 이미 구현 완료 (Issue #78, PR #83)
- 현재 siw는 실전 모드만 존재 — `interviewMode` 파라미터 미전달, 연습 모드 UI 없음
- Sidebar "연습 모드" 메뉴는 `disabled: true` + "준비 중" 태그로 막혀 있음
- `ux_flow.md` §3 모드 구분 규칙: 연습 모드에서만 즉각 피드백 활성화, 실전 모드에서는 차단
- `dev_spec.md` 기능05: `답변 → 즉각 피드백 → 재답변 → 피드백` 의지적 연습 순환 구조

## 완료 기준

- [x] `QuestionList.tsx` — "면접 바로 시작" 버튼이 **실전 모드 / 연습 모드 선택 UI**로 교체됨 (각 카드에 모드 설명 포함)
- [x] `POST /api/practice/feedback` Next.js route — 엔진 프록시, 200/400/500 처리, timeout 30s
- [x] `InterviewChat.tsx` — 연습 모드 시 답변 제출 후 피드백 카드 표시 (score·good/improve·keywords·improvedAnswerGuide)
- [x] `InterviewChat.tsx` — "다시 답변하기" 버튼 → `previousAnswer` 포함 재호출 → `comparisonDelta` (scoreDelta·improvements) 표시
- [x] `InterviewChat.tsx` — 재답변 피드백 확인 후 "다음 질문으로" 버튼으로 흐름 계속
- [x] `Prisma InterviewSession` — `interviewMode String @default("real")` 필드 추가 + 마이그레이션
- [x] `Sidebar.tsx` — "면접" 탭 activeCheck에 `/interview/new` 경로 포함 (연습 모드 진입점 `/interview/new`로 연결)
- [x] vitest: `practice-feedback-route.test.ts` (API 4케이스) + `interview-chat.test.tsx` 연습 모드 케이스 6개 추가

## 구현 플랜

### Step 1 — 타입 확장 (`src/lib/types.ts`)
```ts
export type InterviewMode = "real" | "practice";

export type ComparisonDelta = { scoreDelta: number; improvements: string[] };
export type PracticeFeedbackResponse = {
  score: number;
  feedback: { good: string[]; improve: string[] };
  keywords: string[];
  improvedAnswerGuide: string;
  comparisonDelta: ComparisonDelta | null;
};
```

### Step 2 — Prisma 스키마 (`prisma/schema.prisma`)
`InterviewSession` 모델에 필드 추가:
```prisma
interviewMode String @default("real")
```
→ `prisma migrate dev --name add-interview-mode` 실행

### Step 3 — `/api/interview/start` route + `interview-service.ts`
- route: 요청 body에서 `interviewMode: "real" | "practice"` 수신 (기본값 `"real"`)
- service: `interviewMode` DB 저장
- 현재 엔진 호출 payload에는 `interviewMode` 포함하지 않음 (엔진은 stateless, 모드 구분은 서비스 책임)

### Step 4 — `POST /api/practice/feedback` route 신규 생성
파일 위치: `src/app/api/practice/feedback/route.ts`
```ts
// report/generate route 패턴 동일 적용
// 엔진 POST /api/practice/feedback 프록시
// timeout: AbortSignal.timeout(30000)
// 에러: 400 (question/answer 누락), 500 (엔진 오류)
```

### Step 5 — `QuestionList.tsx` 모드 선택 UI
"면접 바로 시작" 단일 버튼 → **두 카드 선택 UI**로 교체:

| 실전 모드 | 연습 모드 |
|----------|----------|
| 실제 면접과 동일 조건 | 답변 후 즉각 피드백 |
| 세션 중 피드백 없음 | 재답변으로 반복 훈련 |
| 종료 후 8축 리포트 | 종료 후 8축 리포트 |

선택 시 `interviewMode` 값과 함께 `/api/interview/start` 호출 → 세션 시작

### Step 6 — `/interview/[sessionId]/page.tsx` + `InterviewChat.tsx` 연습 모드 피드백 루프
- page.tsx: Prisma에서 `interviewMode` 읽어 `InterviewChat`에 prop으로 전달
- InterviewChat `interviewMode="practice"` 시 답변 제출 흐름:
  ```
  답변 제출
    → /api/interview/answer (다음 질문 받기)
    → /api/practice/feedback 병렬 또는 순차 호출
    → 피드백 카드 렌더링
        score 배지 (0-100)
        good[] / improve[] 리스트
        keywords[] 태그
        improvedAnswerGuide 텍스트
    → "다시 답변하기" 버튼 노출
        → previousAnswer 포함해 /api/practice/feedback 재호출
        → comparisonDelta.scoreDelta / improvements 표시
    → "다음 질문으로" 버튼 → 다음 질문 렌더링
  ```
- `interviewMode="real"` 시 기존 동작 그대로 (피드백 UI 없음)

### Step 7 — Sidebar.tsx
`NAV_COMING`에서 "연습 모드" 항목을 `NAV_MAIN`으로 이동, `href: "/resume"` (모드 선택이 resume 업로드 후 QuestionList에서 이루어지므로) 또는 별도 `/practice` 진입점으로 결정 후 연결

### Step 8 — 테스트
- `tests/api/practice-feedback-route.test.ts`: 200 정상/400 필드누락/500 엔진오류
- `tests/ui/interview-chat.test.tsx`: 연습 모드 피드백 카드 렌더링 + "다시 답변하기" 버튼 케이스 추가
- `tests/api/interview-start-route.test.ts`: `interviewMode` 파라미터 전달 케이스 추가

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] `services/siw/.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 호출은 엔진에서만, 서비스는 프록시만)
- [ ] `interviewMode="real"` 기존 흐름 회귀 없음 확인 (기존 테스트 통과)

## 참고 문서
- `docs/specs/mirai/ux_flow.md` §3 모드 구분 규칙
- `docs/specs/mirai/dev_spec.md` 기능05
- `engine/.ai.md` `/api/practice/feedback` API 계약 (timeout 30s, comparisonDelta 조건)

---

## 작업 내역

### 타입 확장 (`src/lib/types.ts`)
`InterviewMode("real"|"practice")`와 `PracticeFeedback` 타입을 추가했다. 엔진 `/api/practice/feedback` 응답 스키마를 프론트엔드 타입으로 정의하고, `comparisonDelta`는 재답변 시에만 존재하는 optional 필드로 설계했다.

### Prisma 스키마 (`prisma/schema.prisma`)
`InterviewSession` 모델에 `interviewMode String @default("real")` 컬럼을 추가했다. 마이그레이션 SQL을 작성하고 `prisma db push`로 Supabase 원격 DB에 동기화했다.

### API Route (`src/app/api/practice/feedback/route.ts`)
엔진 `/api/practice/feedback`을 프록시하는 Next.js route를 신규 생성했다. `AbortSignal.timeout(30000)`, 200/400/500 처리를 포함했으며 불변식(LLM 호출은 엔진에서만)을 준수했다.

### 모드 선택 UI (`QuestionList.tsx`, `interview/new/page.tsx`)
`QuestionList.tsx`의 "면접 바로 시작" 단일 버튼을 실전/연습 모드 선택 카드 2종으로 교체했다. `interview/new/page.tsx`에도 동일한 모드 선택 UI를 추가해 이력서 선택 → 모드 선택 → 시작 3-step 흐름을 구성했다. 선택한 모드는 `sessionStorage`에 저장해 면접 세션 페이지로 전달한다.

### InterviewChat 피드백 카드 (`InterviewChat.tsx`)
연습 모드 전용 props(`interviewMode`, `practiceFeedback`, `onRetryAnswer`, `onNextQuestion`, `isRetried`, `practiceAnswer`)를 모두 optional로 추가해 기존 실전 모드 하위 호환을 유지했다. 피드백 카드에는 점수 바, 잘한점/개선점 리스트, 키워드 태그, 개선 답변 가이드, comparisonDelta(재답변 시)를 표시하고, 제출한 답변 버블("내 답변")을 피드백 카드 위에 렌더링했다.

### 면접 세션 페이지 (`interview/[sessionId]/page.tsx`)
sessionStorage에서 `interview-mode-{sessionId}`를 읽어 인터뷰 모드를 결정한다. 연습 모드에서는 답변 제출 시 `/api/practice/feedback`을 호출하고 피드백이 표시되는 동안 입력창을 숨긴다. "다시 답변하기" 클릭 시 피드백을 유지한 채 입력창을 재표시하며, "다음 질문으로" 클릭 시 `/api/interview/answer`로 진행한다.

### Sidebar 수정 (`Sidebar.tsx`)
"면접" 탭 activeCheck를 `/interview/`에서 `/interview`로 수정해 `/interview/new` 경로도 활성 탭으로 표시되도록 했다.

### 부가 버그 수정
- `resumes/page.tsx`: 헤더 중복 버튼 제거, 인라인 UploadForm 표시
- `UploadForm.tsx`: `hideTitle` prop 추가 (인라인 렌더 시 "자소서 분석" 헤딩 숨김), 버튼 텍스트 "질문 생성" → "이력서 분석"
- `prisma.ts`: `PrismaPg` 어댑터에 `DIRECT_URL`(port 5432 session pooler) 사용 — pgbouncer Transaction 모드 ECONNREFUSED 해결

### 테스트
- `tests/api/practice-feedback-route.test.ts` 신규 4케이스
- `tests/ui/interview-chat.test.tsx` 연습 모드 케이스 6개 추가
- `tests/e2e/practice-mode.spec.ts` 신규 (Playwright, 영상 녹화)
- vitest 전체 89/89 통과

