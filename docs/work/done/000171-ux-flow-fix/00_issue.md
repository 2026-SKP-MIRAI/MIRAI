# feat: [seung] UX 흐름 개선 — 면접 진행성·리다이렉트·접근성 수정

## 사용자 관점 목표
면접 진행 상황을 파악할 수 있고, 오류 상황에서 올바른 페이지로 안내받으며,
원하는 시점에 리포트를 생성하고 이전 기록에 자유롭게 접근할 수 있다.

## 배경
작업 범위: services/seung (Next.js)

핵심 기능 구현 후 실사용 시 발견된 UX 흐름 문제 8가지:
- 면접 중 이탈 수단 없음 (헤더 나가기 버튼 부재)
- 10개 답변 완료(sessionComplete) 전 리포트 생성 불가 — 엔진은 5개 이상이면 허용
- 면접 진행률 미표시 (몇 번째 질문인지 알 수 없음)
- 오류·파라미터 누락 시 /resume 리다이렉트 — interview·report·diagnosis 3개 파일
- report 페이지 growthCurve 플레이스홀더 노출
- 대시보드에서 진행 중 세션 복귀 불가 ("이어하기" 없음)
- 답변 입력 중 이탈 경고 없음 (beforeunload 미등록)
- 대시보드에서 리포트 1개만 접근 가능 (세션별 리포트 목록 미노출)

## 완료 기준
- [x] 면접 헤더에 "나가기" 버튼 추가 → /dashboard 이동
- [x] 리포트 생성 조건 완화: report/generate/route.ts sessionComplete 게이트 제거, InterviewChat 리포트 버튼을 답변 5개 이상 시 노출 (엔진이 history < 5 시 422)
- [x] 면접 진행률 표시 — 답변 완료 수 / 총 질문 수 (세션 API 응답에 totalQuestions 추가)
- [x] 에러·파라미터 누락 리다이렉트 수정: interview/page.tsx · report/page.tsx · diagnosis/page.tsx /resume → /dashboard
- [x] report 페이지 growthCurve 플레이스홀더 숨김
- [x] 대시보드 진행 중 세션 "이어하기": /api/dashboard에서 sessionComplete=false 세션 포함, ResumeCard에 이어하기 버튼 추가
- [x] AnswerInput beforeunload 이탈 경고 (textarea 내용 있을 때만)
- [x] 대시보드 리포트 복수 접근: /api/dashboard 응답에 reports 배열 추가, ResumeCard에 세션별 리포트 링크 목록 표시

## 구현 플랜
1. 단순 수정 — interview·report·diagnosis 리다이렉트, growthCurve 숨김, 헤더 나가기 버튼
2. 리포트 조건 완화 — report/generate/route.ts sessionComplete 제거 + InterviewChat 버튼 노출 조건 변경 + report-generate.test.ts 업데이트
3. 진행률 표시 — /api/interview/session 응답에 totalQuestions 추가 + interview/page.tsx에서 추적 + InterviewChat props 확장
4. beforeunload — AnswerInput useEffect로 window 이벤트 등록
5. 이어하기 + 복수 리포트 — /api/dashboard 스키마 확장 + DashboardResumeItem 타입 변경 + ResumeCard UI

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음


---

## 작업 내역

### 변경 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/interview/page.tsx` | 리다이렉트 3곳 `/resume`→`/dashboard`, 헤더 나가기 버튼 추가, `totalQuestions` state 추가 및 InterviewChat prop 전달 |
| `src/app/report/page.tsx` | 리다이렉트 3곳 수정, growthCurve 플레이스홀더 섹션 삭제 |
| `src/app/diagnosis/page.tsx` | 리다이렉트 3곳 수정 |
| `src/app/api/report/generate/route.ts` | `sessionComplete` 게이트 블록 제거 |
| `src/app/api/interview/session/route.ts` | `questionsQueue` select 추가, `totalQuestions` 계산·반환 |
| `src/app/api/dashboard/route.ts` | 타입 가드 filter, `reports[]` 반환, `inProgressSessionId` 반환 (`s.report === null` 조건 제거 — 코드리뷰 반영) |
| `src/components/InterviewChat.tsx` | `totalQuestions` prop, 진행률 표시, `answerCount >= 5` 리포트 버튼 |
| `src/components/AnswerInput.tsx` | controlled textarea 전환, `beforeunload` useEffect 등록 |
| `src/lib/types.ts` | `DashboardResumeItem`에 `inProgressSessionId`, `reports[]` 추가 |
| `src/app/dashboard/page.tsx` | 이어하기 버튼, `reports.map()` 기반 리포트 목록 |

### 핵심 결정 사항

1. **`answerCount` props 제거** — 초안에서는 API 응답에 `answerCount`를 포함하려 했으나, `InterviewChat`이 이미 `messages` 배열을 갖고 있으므로 내부에서 `messages.filter(m => m.type === 'answer').length`로 계산. 외부에서 받을 필요 없음.

2. **Prisma 타입 가드** — `filter((s) => s.report !== null)` 후에도 TypeScript가 `s.report`를 nullable로 추론하는 문제를 `(s): s is typeof s & { report: NonNullable<typeof s.report> }` 타입 가드로 해결. `!` non-null assertion 미사용.

3. **`inProgressSessionId` 조건 수정 (코드리뷰 반영)** — 초안의 `!s.sessionComplete && s.report === null`에서 `s.report === null`을 제거. 조기 리포트 생성이 가능해진 이번 이슈에서, 리포트가 있지만 `sessionComplete=false`인 세션도 이어하기 대상이어야 함.

### 테스트

- Vitest 138개 전체 통과 (15파일)
- 신규: `tests/components/AnswerInput.test.tsx` (8개)
- 추가: `tests/api/dashboard.test.ts` — `sessionComplete=false` + 리포트 있는 케이스 (코드리뷰 반영)

