# 테스트 결과 보고서 — kwan Phase 3

> 작성일: 2026-03-21
> 브랜치: feat/000168-kwan-phase-3
> 실행 명령: `cd services/kwan && npm test`

---

## 실행 결과 요약

| 항목 | 값 |
|------|-----|
| 테스트 파일 | 14개 |
| 전체 테스트 케이스 | 107개 |
| PASS | **107개** |
| FAIL | **0개** |
| 실행 시간 | 3.41s |

---

## 파일별 결과

| 파일 | 테스트 수 | 결과 |
|------|----------|------|
| `tests/api/interview-session.test.ts` | 4 | ✅ PASS |
| `tests/api/interview-start.test.ts` | 7 | ✅ PASS |
| `tests/api/interview-answer.test.ts` | 9 | ✅ PASS |
| `tests/api/resume-questions.test.ts` | 18 | ✅ PASS |
| `tests/api/resume-feedback.test.ts` | 9 | ✅ PASS |
| `tests/api/resume-diagnosis.test.ts` | 4 | ✅ PASS |
| `tests/api/practice-feedback.test.ts` | 8 | ✅ PASS |
| `tests/api/report-generate.test.ts` | 10 | ✅ PASS |
| `tests/api/report-get.test.ts` | 3 | ✅ PASS |
| `tests/components/UploadForm.test.tsx` | 5 | ✅ PASS |
| `tests/components/QuestionList.test.tsx` | 5 | ✅ PASS |
| `tests/components/InterviewChat.test.tsx` | 8 | ✅ PASS |
| `tests/components/DiagnosisPage.test.tsx` | 9 | ✅ PASS |
| `tests/components/ReportPage.test.tsx` | 8 | ✅ PASS |

---

## Phase 3 신규 테스트 케이스 목록

### POST /api/resume/questions (analyze 전환)
- 파일 없음 → 400
- 파일 형식 오류 → 400
- /analyze 네트워크 오류 → 500
- /analyze JSON 파싱 실패 → 500
- /analyze 성공이지만 resumeText 누락 → 500
- /analyze 성공이지만 resumeText 공백 → 500
- /questions 네트워크 오류 → 500
- /questions 타임아웃(AbortError) → 500 + 타임아웃 메시지
- /analyze 타임아웃(TimeoutError) → 500 + 타임아웃 메시지
- DB 저장 실패 → 200 + resumeId: null
- /questions JSON 파싱 실패 → 500
- PDF 저장 실패해도 요청 성공 → 200
- PDF 저장 성공 시 storageKey DB 업데이트
- 정상 흐름 → 200 + resumeId + questions

### POST /api/resume/feedback (기능 02)
- resumeId 누락 → 400
- resume 없음 → 404
- 정상 흐름(targetRole 제공) → 200
- targetRole 미제공 + inferredTargetRole → inferredTargetRole 사용
- targetRole 미제공 + inferredTargetRole 없음 → '미지정 직무' 사용
- 엔진 오류 → 500
- 타임아웃 → 500 + 타임아웃 메시지
- DB update 실패 → 200 (결과는 반환)
- Zod 검증 실패 → 500

### GET /api/resume/diagnosis (기능 02)
- resumeId 누락 → 400
- resume 없음 → 404
- diagnosisResult 없음 → 404
- 정상 흐름 → 200

### POST /api/practice/feedback (기능 05)
- question 누락 → 400
- answer 누락 → 400
- answer 공백 → 400
- answer 타입 오류(null, number) → 400
- 정상 흐름(previousAnswer 없음) → 200
- 정상 흐름(previousAnswer 있음) → 200 + comparisonDelta
- 엔진 오류 → 500
- 타임아웃 → 500

### POST /api/report/generate (기능 07)
- sessionId 누락 → 400
- session 없음 → 404
- session 미완료 → 400
- history가 배열이 아님 → 500
- history < 5 → 422
- 정상 흐름 → 201 + reportId
- 기존 리포트 존재(멱등) → 200 + 기존 reportId
- P2002 동시 요청 → 200 fallback
- engine timeout → 500
- engine 422 → 422 전달

### GET /api/report (기능 07)
- reportId 누락 → 400
- report 없음 → 404
- 정상 흐름 → 200

### /diagnosis 페이지 컴포넌트
- 로딩 상태 렌더링
- 5축 점수 바 렌더링 (구체성/성과 명확성/논리 구조/직무 정합성/차별성)
- 강점 목록 렌더링
- 약점 목록 렌더링
- 개선 제안 카드 렌더링
- 면접 시작 버튼 렌더링
- 면접 시작 버튼 클릭 → POST /api/interview/start → /interview?sessionId= 이동
- 에러 상태 렌더링
- fetch 실패 → 에러 메시지

### /report 페이지 컴포넌트 (기능 07)
- 로딩 상태 렌더링
- 총점 렌더링
- 8축 점수 바 렌더링 (의사소통/문제해결/논리적 사고/직무 전문성/조직 적합성/리더십/창의성/성실성)
- 종합 평가(summary) 렌더링
- 강점 피드백 카드 렌더링
- 개선 피드백 카드 렌더링
- 에러 상태 렌더링
- fetch 실패 → 에러 메시지

---

## 주요 이슈 및 수정 내역

### 1. axisFeedbacks Zod 스키마 min/max 누락
- **문제**: `ReportGenerateResponseSchema`에서 `axisFeedbacks`에 `.min(8).max(8)` 미적용
- **수정**: `src/domain/interview/schemas.ts` Line 115 — `.min(8).max(8)` 추가
- **관련 테스트**: `tests/api/report-generate.test.ts` — DEFAULT_REPORT.axisFeedbacks 8개로 수정

### 2. DiagnosisPage.test.tsx — 면접 시작 버튼 클릭 테스트 실패
- **원인**: `useRouter: () => ({ push, replace })` 가 렌더링마다 새 객체 생성 → useEffect 재실행 → fetch mock 소진 → 에러 상태 전환 → 버튼 소멸
- **수정**: `vi.hoisted()`로 stableRouter 생성, mock factory에서 동일 참조 반환

### 3. ReportPage.test.tsx 누락
- **문제**: `/report/page.tsx` 구현됐으나 테스트 파일 없음
- **수정**: `tests/components/ReportPage.test.tsx` 신규 작성 (8개 TC)
  - 총점/8축/summary/강점·개선 피드백/에러 상태 커버
  - 동일 레이블이 점수 바·피드백 카드 양쪽에 나타나는 문제 → `getAllByText` 사용

---

## E2E 테스트 (Playwright)

| 파일 | 테스트 | 결과 |
|------|--------|------|
| `e2e/phase3-full-flow.spec.ts` | PDF 업로드 → 질문 생성 → 자소서 진단 → 면접 → 리포트 | ✅ PASS |

- 모든 API를 `page.route()`로 모킹 — 엔진 LLM 호출 없음
- 영상: `e2e/test-results/.../video.webm`

### E2E 수정 이슈
- **`getByText(/반도체 소프트웨어/i)` 실패** — input 필드 value는 `getByText` 미지원 → `locator('input[type="text"]').toHaveValue()` 전환
- **strict mode violation (2건)** — `면접이 완료되었습니다|리포트 생성`, `8축 역량 리포트|종합 점수` 각각 2개 요소 매칭 → `.first()` 추가

---

## 참고

- stderr 출력(에러 로그)은 의도된 동작 — 에러 케이스 테스트 시 라우트 내부의 `console.error` 호출
- `InterviewChat.test.tsx`의 `act(...)` 경고는 기존 테스트의 pre-existing 이슈, FAIL 아님
- 모든 단위·컴포넌트 테스트는 mock DB / mock engine-client 기반 (실제 DB·엔진 호출 없음)
