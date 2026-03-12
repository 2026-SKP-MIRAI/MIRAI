# [#63] siw Pretendard + Glassmorphism 디자인 시스템 — 테스트 현황

> 작성: 2026-03-12 | 총 32개 | 플랜: `01_plan.md`

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| API 단위 (vitest/node) | 16 | 16 | 0 | 0 |
| UI 단위 (vitest/jsdom) | 12 | 12 | 0 | 0 |
| 유닛 (vitest/node) | 4 | 4 | 0 | 0 |
| E2E (Playwright) | — | — | — | 미실행 (엔진 연동 필요) |
| **합계** | **32** | **32** | **0** | **0** |

---

## Vitest — 단위 테스트

### `tests/api/error-messages.test.ts` — 7개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 1 | 파일 필요 에러를 noFile로 매핑한다 | 🟢 GREEN | |
| 2 | 파일 크기 에러를 tooLarge로 매핑한다 | 🟢 GREEN | |
| 3 | 페이지 수 에러를 tooManyPages로 매핑한다 | 🟢 GREEN | |
| 4 | 손상된 PDF 에러를 corruptedPdf로 매핑한다 | 🟢 GREEN | |
| 5 | 이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다 | 🟢 GREEN | |
| 6 | 텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다 | 🟢 GREEN | |
| 7 | 알 수 없는 에러를 llmError로 매핑한다 | 🟢 GREEN | |

### `tests/api/resume-questions-route.test.ts` — 6개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 8 | 성공 시 200 반환 | 🟢 GREEN | |
| 9 | 파일 없음 시 400 반환 | 🟢 GREEN | |
| 10 | 엔진 400 에러 패스스루 | 🟢 GREEN | |
| 11 | 엔진 422 에러 패스스루 | 🟢 GREEN | |
| 12 | 엔진 500 에러 패스스루 | 🟢 GREEN | |
| 13 | 타임아웃 시 500 반환 | 🟢 GREEN | |

### `tests/api/interview-start-route.test.ts` — 3개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 14 | 200: sessionId와 firstQuestion 반환 | 🟢 GREEN | |
| 15 | 400: resumeText 없을 때 | 🟢 GREEN | |
| 16 | 500: service throws 시 | 🟢 GREEN | |

### `tests/api/interview-answer-route.test.ts` — 3개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 17 | 200: nextQuestion 반환 | 🟢 GREEN | |
| 18 | 400: sessionId 없을 때 | 🟢 GREEN | |
| 19 | 500: service throws 시 | 🟢 GREEN | |

### `tests/unit/interview-service.test.ts` — 4개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 20 | start: engine 호출 후 session 생성 | 🟢 GREEN | |
| 21 | answer: DB에서 context 복원 후 engine에 6필드 전달 | 🟢 GREEN | |
| 22 | answer: history의 type 필드를 engine에 전달하지 않음 | 🟢 GREEN | |
| 23 | answer: engine 첫 번째 실패 후 재시도하여 성공 | 🟢 GREEN | 1007ms, 재시도 로직 |

---

## Vitest — UI 테스트

### `tests/ui/upload-form.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 24 | idle_renders_upload_controls | 🟢 GREEN | |
| 25 | moves_to_ready_when_pdf_selected | 🟢 GREEN | |
| 26 | moves_to_uploading_when_submit_clicked | 🟢 GREEN | aria-label="질문 생성" 추가로 수정 |
| 27 | moves_to_done_when_api_returns_questions | 🟢 GREEN | |
| 28 | moves_to_error_when_api_fails_and_retry_restarts | 🟢 GREEN | |

### `tests/ui/question-results.test.tsx` — 2개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 29 | 카테고리별_그룹핑_렌더링 | 🟢 GREEN | |
| 30 | 다시하기_버튼_클릭_시_onReset_호출 | 🟢 GREEN | |

### `tests/ui/interview-chat.test.tsx` — 2개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 31 | 페르소나 레이블과 질문 버블 렌더링 | 🟢 GREEN | |
| 32 | sessionComplete=true 시 완료 메시지 | 🟢 GREEN | |

---

## Playwright — E2E 테스트

> 실 엔진·DB 연동 필요. 로컬 `npm run dev` + `.env.local` 설정 후 실행.

```bash
cd .worktree/000063-siw-pretendard-glassmorphism/services/siw
npx playwright test
```

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| — | interview-session.spec.ts | ⬜ 미실행 | 엔진 연동 필요 |

---

## TypeScript 검사

```bash
npx tsc --noEmit
# 결과: 에러 없음
```

---

## 버그 수정 내역

| 파일 | 내용 | 원인 |
|------|------|------|
| `UploadForm.tsx` | `"processing"` → `"uploading"` 통일, `aria-label="질문 생성"` 추가 | `UploadState` 타입에 없는 `"processing"` 비교로 TS2367 발생 + uploading 시 버튼 텍스트 변경으로 테스트에서 버튼 탐색 실패 |

---

## 아키텍처 불변식 검증

| 항목 | 상태 |
|------|------|
| data-testid 변경 없음 (answer-input, submit-answer, chat-message, persona-label, user-answer, session-complete, question-item, start-interview) | ✅ |
| API URL 변경 없음 (/api/resume/questions, /api/interview/start, /api/interview/answer) | ✅ |
| 상태 로직 변경 없음 (UploadState 전이, history, sessionComplete) | ✅ |
| className(스타일)만 추가·교체, 로직 불변 | ✅ |

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-11 | 이전 세션에서 Phase 1~12 대부분 구현 완료 (API 비용 소진으로 중단) |
| 2026-03-12 | 작업 현황 점검: 32/32 테스트 중 1개 실패, TS 에러 2개 확인 |
| 2026-03-12 | UploadForm.tsx 수정 — "processing" 타입 제거, aria-label 추가 |
| 2026-03-12 | TSC noEmit 에러 0개, Vitest 32/32 통과 확인 |
| 2026-03-12 | 01_plan.md 완료 기준 전체 체크, .ai.md 최신화 |
| 2026-03-12 | 디자인 세련도 5종 변경 후 Vitest 32/32 통과, TSC noEmit 에러 0개 재확인 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
