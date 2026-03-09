# [#39] SIW MVP 01 — 테스트 현황

> 작성: 2026-03-08 | 총 20개 | 플랜: `01_plan.md`

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| siw API 단위 (vitest/node) | 13 | 13 | 0 | 0 |
| siw UI 단위 (vitest/jsdom) | 7 | 7 | 0 | 0 |
| **합계** | **20** | **20** | **0** | **0** |

---

## siw Vitest

### `tests/api/error-messages.test.ts` — 7개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 1 | `파일 필요 에러를 noFile로 매핑한다` | 🟢 GREEN | `"파일"+"필요"` 키워드 |
| 2 | `파일 크기 에러를 tooLarge로 매핑한다` | 🟢 GREEN | `"크기"` or `"5MB"` |
| 3 | `페이지 수 에러를 tooManyPages로 매핑한다` | 🟢 GREEN | `"페이지"` 키워드 |
| 4 | `손상된 PDF 에러를 corruptedPdf로 매핑한다` | 🟢 GREEN | `"읽을 수 없"` 키워드 |
| 5 | `이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다` | 🟢 GREEN | `"이미지"` 검사 우선 (emptyPdf보다 먼저) |
| 6 | `텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다` | 🟢 GREEN | `"텍스트"` 키워드, 422 status |
| 7 | `알 수 없는 에러를 llmError로 매핑한다 (fallback)` | 🟢 GREEN | 기본값 fallback |

### `tests/api/resume-questions-route.test.ts` — 6개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 8 | `성공 시 200 반환` | 🟢 GREEN | vi.stubGlobal fetch mock |
| 9 | `파일 없음 시 400 반환` | 🟢 GREEN | file instanceof File 실패 |
| 10 | `엔진 400 에러 패스스루` | 🟢 GREEN | |
| 11 | `엔진 422 에러 패스스루` | 🟢 GREEN | |
| 12 | `엔진 500 에러 패스스루` | 🟢 GREEN | |
| 13 | `타임아웃 시 500 반환` | 🟢 GREEN | AbortSignal.timeout + DOMException |

### `tests/ui/upload-form.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 14 | `idle_renders_upload_controls` | 🟢 GREEN | idle 기본 렌더링 |
| 15 | `moves_to_ready_when_pdf_selected` | 🟢 GREEN | idle → ready |
| 16 | `moves_to_uploading_when_submit_clicked` | 🟢 GREEN | ready → uploading, 버튼 비활성 |
| 17 | `moves_to_done_when_api_returns_questions` | 🟢 GREEN | uploading → done, onComplete 호출 |
| 18 | `moves_to_error_when_api_fails_and_retry_restarts` | 🟢 GREEN | error → "다시 시도" 버튼 표시 |

### `tests/ui/question-results.test.tsx` — 2개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 19 | `카테고리별_그룹핑_렌더링` | 🟢 GREEN | 4개 카테고리 h2 표시 |
| 20 | `다시하기_버튼_클릭_시_onReset_호출` | 🟢 GREEN | onReset mock 호출 확인 |

---

## 작업 로그

| 시각 | 작업자 | 내용 |
|------|--------|------|
| 2026-03-08 | team-lead | 02_test.md 초기 작성, 20개 항목 등록 |
| 2026-03-08 | backend-worker | npm install (190 packages), API 테스트 13/13 🟢 GREEN (수정 불필요) |
| 2026-03-08 | frontend-worker | UI 테스트 7/7 🟢 GREEN (수정 불필요) |
| 2026-03-08 | arch-worker | 전체 20/20 최종 확인, 불변식 pass, .ai.md 최신화, .gitkeep 제거 |
| 2026-03-08 | architect | ARCHITECT APPROVED — 모든 AC 항목 통과 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
