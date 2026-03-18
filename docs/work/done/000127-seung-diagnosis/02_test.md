# [#127] feat: services/seung Phase 3 — 서류 강점·약점 진단 구현 — 테스트 결과

> 작성: 2026-03-17

---

## 최종 테스트 결과

### Vitest 단위·컴포넌트 테스트

```
Test Files  11 passed (11)
Tests       89 passed (89)
Duration    2.65s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/resume-feedback.test.ts` | 11 | ✅ 전체 통과 (신규) |
| `tests/api/resume-diagnosis.test.ts` | 5 | ✅ 전체 통과 (신규) |
| `tests/api/questions.test.ts` | 10 | ✅ 전체 통과 (mock 수정) |
| `tests/api/practice-feedback.test.ts` | 12 | ✅ 전체 통과 |
| `tests/api/interview-start.test.ts` | 6 | ✅ 전체 통과 |
| `tests/api/interview-answer.test.ts` | 10 | ✅ 전체 통과 |
| `tests/api/report-generate.test.ts` | 9 | ✅ 전체 통과 |
| `tests/api/report-get.test.ts` | 3 | ✅ 전체 통과 |
| `tests/components/InterviewChat.test.tsx` | 11 | ✅ 전체 통과 |
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

### `tests/api/resume-feedback.test.ts` (11개)

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | `resumeId` 없으면 400 | ✅ |
| 2 | `targetRole` 없으면 400 | ✅ |
| 3 | `targetRole` 빈 문자열이면 400 | ✅ |
| 4 | Resume DB에 없으면 404 | ✅ |
| 5 | 엔진 성공 시 200 + `ResumeFeedbackResponse` 반환 | ✅ |
| 6 | 성공 시 `prisma.resume.update`로 `diagnosisResult` 저장 | ✅ |
| 7 | 엔진에 `resumeText`와 `targetRole` 전달 확인 | ✅ |
| 8 | `AbortSignal.timeout(40000)`으로 엔진 호출 확인 | ✅ |
| 9 | 엔진 400 에러 그대로 전달 | ✅ |
| 10 | 엔진 500 에러 그대로 전달 | ✅ |
| 11 | fetch 자체 실패 시 500 반환 | ✅ |

### `tests/api/resume-diagnosis.test.ts` (5개)

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | `resumeId` 없으면 400 | ✅ |
| 2 | Resume 없으면 404 | ✅ |
| 3 | `diagnosisResult` null이면 404 | ✅ |
| 4 | `diagnosisResult` 있으면 200 + 결과 반환 | ✅ |
| 5 | DB 오류 시 500 반환 | ✅ |

### `tests/api/questions.test.ts` (mock 수정)

`mockPrisma.resume.create` 반환 객체에 `diagnosisResult: null` 추가 (3곳) — 기존 10개 테스트 회귀 없음 확인

---

## Playwright E2E 테스트

> 전체 23개 통과 (API 모킹 기반)

### `tests/e2e/diagnosis-flow.spec.ts` (8개, 신규)

| # | 케이스 | 결과 |
|---|--------|------|
| 1 | 업로드 완료 후 다음 단계 선택 카드가 표시된다 | ✅ |
| 2 | "서류 진단받기" 클릭 시 진단 세부 UI가 펼쳐진다 | ✅ |
| 3 | `targetRole` 미입력 시 "진단하기" 버튼이 비활성화된다 | ✅ |
| 4 | "진단하기" 클릭 시 `/diagnosis?resumeId=xxx` 페이지로 이동한다 | ✅ |
| 5 | `/diagnosis` 페이지에서 5개 점수·강점·약점·개선 방향이 표시된다 | ✅ |
| 6 | `/diagnosis`에서 "홈으로" 버튼 클릭 시 `/resume`로 이동한다 | ✅ |
| 7 | `resumeId` 없이 `/diagnosis` 진입 시 `/resume`로 redirect된다 | ✅ |
| 8 | `/diagnosis`에서 404 응답 시 `/resume`로 redirect된다 | ✅ |

### 기존 E2E 회귀 확인 + 실제 엔진 연동

> 총 28개 실행 — **28 passed**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/e2e/upload-flow.spec.ts` | 4 | ✅ 전체 통과 |
| `tests/e2e/report-flow.spec.ts` | 2 | ✅ 전체 통과 |
| `tests/e2e/interview-flow.spec.ts` | 5 | ✅ 전체 통과 (회귀 수정) |
| `tests/e2e/practice-flow.spec.ts` | 4 | ✅ 전체 통과 (회귀 수정) |
| `tests/e2e/real-interview-flow.spec.ts` | 1 | ✅ 통과 (실제 엔진 + Supabase) |
| `tests/e2e/real-report-flow.spec.ts` | 1 | ✅ 통과 (실제 엔진 + Supabase) |
| `tests/e2e/real-flow.spec.ts` | 1 | ✅ 통과 |
| `tests/e2e/real-practice-flow.spec.ts` | 1 | ✅ 통과 (실제 엔진 + Supabase) |
| `tests/e2e/real-diagnosis-flow.spec.ts` | 1 | ✅ 통과 (실제 엔진 + Supabase, 신규) |

---

## DB 마이그레이션

| 항목 | 결과 |
|------|------|
| `prisma migrate dev --name add_diagnosis_result` | ✅ 완료 (`20260317072242_add_diagnosis_result`) |
| `Resume.diagnosisResult Json?` 필드 추가 | ✅ |

---

## 트러블슈팅 기록

#### E2E strict mode violation — `논리 구조` 중복 매칭

- **현상**: `getByText('논리 구조')` 가 점수 레이블과 강점 텍스트(`논리 구조가 명확함`) 두 곳에 매칭되어 strict mode 위반
- **원인**: Playwright `getByText`는 기본적으로 부분 문자열 매칭
- **해결**: 점수 레이블 전체(`서술의 구체성`, `성과 수치 명확성`, `논리 구조`, `직무 적합성`, `차별성`, `강점`, `약점`, `개선 방향`)에 `{ exact: true }` 적용

#### E2E 회귀 — `/resume` 브랜칭 카드 UI 변경으로 인한 기존 테스트 셀렉터 불일치

- **현상**: `interview-flow.spec.ts` 1개, `practice-flow.spec.ts` 2개 실패 (실제로는 `real-interview-flow`, `real-report-flow`도 동일 영향)
- **원인**: `/resume` 페이지를 "즉시 면접 시작" → "카드 선택 → 모드 선택 → 확인" 3단계 브랜칭 구조로 변경함에 따라, 기존 테스트가 사용하던 `/면접 시작/` 버튼 클릭 한 번으로 `/interview` 페이지에 도달하는 흐름이 깨짐. 초기에 `git stash` 검증으로 "기존 회귀"로 오분류했으나, stash가 tracked 파일만 되돌려 untracked 신규 파일의 영향을 배제하지 못한 것이 원인
- **해결**:
  - `interview-flow.spec.ts`: 카드 클릭 → `실전 모드` 선택 → `확인` 클릭 3단계로 수정
  - `practice-flow.spec.ts`: 카드 클릭 후 `확인` 클릭 추가, `결론을 먼저 제시했습니다.` strict mode 위반은 `.first()` 적용
  - `real-interview-flow.spec.ts`, `real-report-flow.spec.ts`: 동일 패턴으로 수정
