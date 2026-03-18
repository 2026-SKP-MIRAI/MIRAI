# [#123] feat: services/seung Phase 3 — 연습 모드 즉각 피드백 — 테스트 결과

> 작성: 2026-03-17

---

## 최종 테스트 결과

### Vitest 단위·컴포넌트 테스트

```
Test Files  9 passed (9)
Tests       73 passed (73)
Duration    2.54s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 (신규) |
| `tests/api/interview-start.test.ts` | 6 | ✅ 전체 통과 (신규 1개 추가) |
| `tests/api/interview-answer.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/report-generate.test.ts` | 9 | ✅ 전체 통과 |
| `tests/api/report-get.test.ts` | 3 | ✅ 전체 통과 |
| `tests/api/questions.test.ts` | 9 | ✅ 전체 통과 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 (신규 4개 추가) |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ 전체 통과 |
| `tests/components/UploadForm.test.tsx` | 7 | ✅ 전체 통과 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 신규 테스트 케이스 상세

### `tests/api/practice-feedback.test.ts` (8개)

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | 성공 (첫 답변): `{ question, answer }` → 200 + `{ score, feedback, keywords, improvedAnswerGuide, comparisonDelta: null }` | ✅ |
| 2 | 성공 (재답변): `{ question, answer, previousAnswer }` → 200 + `comparisonDelta` 포함 | ✅ |
| 3 | `question` 누락 → 400 | ✅ |
| 4 | `answer` 누락 → 400 | ✅ |
| 5 | `answer` 빈 문자열 → 400 | ✅ |
| 6 | `ENGINE_BASE_URL` 미설정 → 500 | ✅ |
| 7 | 엔진 400 → 서비스 400 그대로 반환 | ✅ |
| 8 | 엔진 500 → 서비스 500 그대로 반환 | ✅ |

### `tests/api/interview-start.test.ts` (신규 1개 추가)

| # | 케이스 | 상태 |
|---|--------|------|
| 6 | `interviewMode="practice"` 전달 시 `prisma.interviewSession.create` 호출에 반영 | ✅ |

### `tests/components/InterviewChat.test.tsx` (4개 추가)

| # | 케이스 | 상태 |
|---|--------|------|
| 8 | `interviewMode="practice"`, `practiceStep="feedback"` → 피드백 블록 표시 (score, good, improve, keywords) | ✅ |
| 9 | `practiceStep="feedback"` → "다시 답변하기" 버튼 표시 + `onRetry` 호출 | ✅ |
| 10 | `practiceStep="done"`, `comparisonDelta` 있음 → 향상도 표시 | ✅ |
| 11 | `interviewMode="real"` (기본값) → 피드백 블록 없음 | ✅ |

---

## Playwright E2E 테스트

> `tests/e2e/practice-flow.spec.ts` (test.setTimeout 120_000)

| # | 케이스 | 비고 |
|---|--------|------|
| 1 | 연습 모드 선택 → 면접 시작 → 첫 질문 표시 | API 모킹 |
| 2 | 답변 제출 → 피드백 블록 표시 (score, good, improve, keywords) | API 모킹 |
| 3 | "다시 답변하기" → 재답변 → `previousAnswer` 전달 확인 + comparisonDelta 표시 | API 모킹 |
| 4 | "다음 질문" → `/api/interview/answer` 호출 → 다음 질문 표시 | API 모킹 |

> E2E는 API 모킹 기반. 실제 엔진 연동 E2E는 별도 환경에서 진행 필요.

---

## 실제 엔진 연동 E2E (2026-03-17)

> `tests/e2e/real-practice-flow.spec.ts` (test.setTimeout 600_000)

| # | 케이스 | 비고 | 결과 |
|---|--------|------|------|
| 1 | 자소서 업로드 → 연습 모드 선택 → 피드백 → 재답변 → comparisonDelta → 다음 질문 전체 플로우 | 실제 엔진 + Supabase | ✅ 56.5s 소요 |

**사용 fixture**: `engine/tests/fixtures/input/sample_resume.pdf`

**검증 항목**:
- PDF 업로드 → 질문 생성 (LLM 호출)
- "면접 시작" → 모드 선택 UI 표시 → 연습 모드 선택 → "확인" 클릭
- `/interview?sessionId=...&interviewMode=practice` 이동 확인
- 첫 답변 제출 → 피드백 블록 (점수/잘한점/개선할점/개선가이드) 표시 확인
- "다시 답변하기" → 재답변 제출 → comparisonDelta (향상도) 표시 확인
- "다음 질문" → 다음 질문 수신 + 연습 모드 피드백 재표시 확인

**비디오 녹화**: `test-results/real-practice-flow-*/video.webm`

---

## DB 마이그레이션

| 항목 | 결과 |
|------|------|
| `prisma migrate dev --name add_interview_mode` | ✅ 완료 (`20260317041311_add_interview_mode`) |

---

## 코드 리뷰 후 수정 사항

| 심각도 | 파일 | 내용 | 조치 |
|--------|------|------|------|
| Important | `interview/page.tsx` | `isRetry` 판정 버그 — `practiceStep === 'feedback'`일 때 `AnswerInput`이 hidden이므로 함수가 호출 불가, `previousAnswer` 미전달 | `practiceStep === 'retry'`로 수정 |
| UX | `resume/page.tsx` | 모드 선택 즉시 면접 시작 → 잘못 누를 위험 | 선택 후 "확인" 버튼 방식으로 변경, 선택 전 버튼 비활성화 |
| Important | `api/practice/feedback/route.ts` | `!question` 체크는 숫자 등 비문자열 타입 미검증 — `.trim()` 호출 시 TypeError | `typeof question !== 'string'` 검사로 수정, 테스트 2개 추가 |
| Normal | `api/practice/feedback/route.ts` | 엔진 non-JSON 응답 시 json() 파싱 실패 catch에서 상태코드 500 하드코딩 | `engineResponse.status` 그대로 반환하도록 수정, 테스트 2개 추가 |

---

## 트러블슈팅 기록

#### `.env` vs `.env.local` Prisma 인식 문제

- **현상**: `prisma migrate dev` 실행 시 `DIRECT_URL` not found 에러
- **원인**: Prisma는 `.env`만 읽고 `.env.local`은 Next.js 전용
- **해결**: `.env.local` 내용을 `.env`로 복사 (`.gitignore`에 `.env` 패턴 적용 확인)
