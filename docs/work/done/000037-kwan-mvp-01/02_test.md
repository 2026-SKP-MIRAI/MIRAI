# [#37] kwan MVP 01 — 테스트 현황

> 작성: 2026-03-10 | 총 15개 | 플랜: `01_plan.md`

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| kwan API 단위 (vitest/node) | 6 | 6 | 0 | 0 |
| kwan UI 단위 (vitest/jsdom) | 9 | 9 | 0 | 0 |
| **합계** | **15** | **15** | **0** | **0** |

---

## kwan Vitest

### `tests/api/resume-questions.test.ts` — 6개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 1 | `파일 없음 → 400 한국어 에러` | 🟢 GREEN | file 없을 때 400 + `'PDF 파일을 선택해주세요.'` |
| 2 | `정상 PDF → 200 + fixture questions 반환` | 🟢 GREEN | mockEngineResponse 8개 질문, meta.extractedLength=3538 |
| 3 | `엔진 400 (파일 크기 초과) → 400 + 한국어 메시지 전달` | 🟢 GREEN | detail → error 필드 변환 검증 |
| 4 | `엔진 422 (이미지 전용 PDF) → 422 + 한국어 메시지 전달` | 🟢 GREEN | status 422 패스스루 + error 필드 |
| 5 | `엔진 500 (LLM 오류) → 500 + 한국어 메시지 전달` | 🟢 GREEN | detail → error 필드 변환 검증 |
| 6 | `네트워크 오류(타임아웃·엔진 다운) → 500 한국어 메시지` | 🟢 GREEN | `'서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'` |

### `tests/components/UploadForm.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 7 | `idle 상태: 파일 input + "질문 생성" 버튼 렌더` | 🟢 GREEN | aria-label="PDF 파일 선택" 존재 확인 |
| 8 | `PDF 아닌 파일 선택 → 인라인 에러 표시` | 🟢 GREEN | type 검사, "PDF 파일만" 메시지 |
| 9 | `로딩 중: 버튼 비활성화 + 로딩 텍스트` | 🟢 GREEN | isLoading=true → disabled, "분석 중..." |
| 10 | `PDF 선택 후 제출 → onSubmit(file) 호출` | 🟢 GREEN | onSubmit mock 호출 검증 |
| 11 | `파일 미선택 상태에서 제출 → onSubmit 미호출` | 🟢 GREEN | guard 조건 검증 |

### `tests/components/QuestionList.test.tsx` — 4개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 12 | `questions 배열 → 카테고리별 그룹 렌더` | 🟢 GREEN | 3개 카테고리 h2 표시, 질문 텍스트 확인 |
| 13 | `각 카테고리 내 질문 수 정확히 표시` | 🟢 GREEN | 직무 역량 2개 질문 검증 |
| 14 | `"다시 하기" 버튼 클릭 → onReset 호출` | 🟢 GREEN | onReset mock 1회 호출 확인 |
| 15 | `빈 질문 배열 → 결과 없음 메시지` | 🟢 GREEN | `'질문이 없습니다.'` 렌더 확인 |

---

## 작업 로그

| 시각 | 작업자 | 내용 |
|------|--------|------|
| 2026-03-09 | kwan | 02_test.md 초기 작성, 15개 항목 등록 |
| 2026-03-09 | kwan | npm test 15/15 🟢 GREEN — 전체 통과 확인 |
| 2026-03-10 | kwan | PR 리뷰 블로커 수정 후 재검증: 15/15 🟢 GREEN |
| 2026-03-10 | kwan | /kwan-review 3관점 검증 완료 — CRITICAL 0, IMPORTANT 0, MINOR 0 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
