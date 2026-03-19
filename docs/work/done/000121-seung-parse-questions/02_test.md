# [#121] feat: [seung] 이중 파싱 제거 — engine /parse + /questions 병렬 전환 — 테스트 결과

> 작성: 2026-03-19

---

## 최종 테스트 결과

### Vitest 단위·컴포넌트 테스트

```
Test Files  11 passed (11)
Tests       93 passed (93)
Duration    2.96s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 |
|------|-----------|------|
| `tests/api/questions.test.ts` | 14 | ✅ 전체 통과 (전면 수정) |
| `tests/api/resume-feedback.test.ts` | 11 | ✅ 전체 통과 |
| `tests/api/resume-diagnosis.test.ts` | 5 | ✅ 전체 통과 |
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

### `tests/api/questions.test.ts` (14개, 전면 수정)

기존 mock 구조(`mockExtractPdfText`, `vi.mock('@/lib/pdf-utils', ...)`)를 제거하고
`vi.mock('@/lib/engine-client', ...)` 방식으로 전환. `/parse` 에러 케이스 6개 신규 추가.

| # | 케이스 | 상태 |
|---|--------|------|
| 1 | 파일 없으면 400 반환 | ✅ |
| 2 | ENGINE_BASE_URL 없으면 500 반환 | ✅ |
| 3 | /parse 네트워크 오류 → 500 | ✅ (신규) |
| 4 | /parse 400 에러 그대로 전달 | ✅ (신규) |
| 5 | /parse 422 에러 그대로 전달 | ✅ (신규) |
| 6 | /parse 성공이지만 resumeText 누락 시 500 반환 | ✅ (신규) |
| 7 | /questions 400 에러 그대로 전달 | ✅ |
| 8 | /questions 422 에러 그대로 전달 | ✅ |
| 9 | /questions 500 에러 그대로 전달 | ✅ |
| 10 | 성공 시 questions 반환 | ✅ |
| 11 | 성공 시 resumeId 반환 | ✅ |
| 12 | Prisma에 resumeText와 questions:[]로 저장 | ✅ (수정) |
| 13 | DB 실패 시에도 엔진 결과 반환 (resumeId=null) | ✅ |
| 14 | /questions 응답에 questions 배열 없으면 502 | ✅ |

**삭제된 테스트 (3개 → 통합/제거):**
- `'빈 resumeText이면 DB 저장 건너뛰고 resumeId=null 반환'` — engine `/parse`가 빈 PDF를 422로 막으므로 dead code, 제거
- `'fetch 자체 실패 시 500 반환'` — `/parse 네트워크 오류 → 500`으로 대체
- `'엔진 성공 응답(200) 그대로 전달'` — `'성공 시 questions 반환'`으로 대체

---

## TDD 사이클 기록

| 단계 | 내용 |
|------|------|
| 🔴 RED | `questions.test.ts` 전면 수정 → 9개 실패, 4개 통과 확인 |
| 🟢 GREEN | `engine-client.ts` 신규 생성 + `route.ts` 수정 → 13개 전체 통과 |
| ✅ DONE | `pdf-utils.ts` 삭제, `pdf-parse` 패키지 제거, `next.config.ts` 잔여 설정 제거, `.ai.md` 최신화 |
| 🔴 RED | `/parse ok but resumeText 누락` 테스트 추가 → 1개 실패 확인 |
| 🟢 GREEN | `route.ts`에 `resumeText` 타입 검증 방어 코드 추가 → 14개 전체 통과 (총 93개) |

---

## 트러블슈팅 기록

#### `next.config.ts` — `serverExternalPackages: ['pdf-parse']` 잔여

- **현상**: `pdf-parse` 패키지 제거 후 `next.config.ts`에 `serverExternalPackages: ['pdf-parse']`가 남아 있음
- **원인**: 패키지 제거 시 관련 설정 파일까지 함께 정리하지 않은 누락
- **해결**: `serverExternalPackages` 항목 제거
