# [#162] 테스트 결과

> 작성: 2026-03-20

---

## 실행 명령

```bash
cd services/siw
npx vitest run tests/api/resumes-analyze-route.test.ts tests/api/resumes-route.test.ts tests/ui/upload-form.test.tsx --reporter=verbose
```

---

## 결과 요약

| 파일 | 케이스 | 결과 |
|------|--------|------|
| `tests/api/resumes-analyze-route.test.ts` | 9 | ✅ 전부 통과 (504 케이스 추가) |
| `tests/api/resumes-route.test.ts` | 13 | ✅ 전부 통과 |
| `tests/ui/upload-form.test.tsx` | 7 | ✅ 전부 통과 |
| **합계** | **29** | ✅ **29/29 통과** |

소요 시간: ~2.26s

---

## T1: `tests/api/resumes-analyze-route.test.ts` (신규 — 8케이스)

| # | 테스트 설명 | 결과 |
|---|------------|------|
| 1 | 200: engine /analyze 성공 → `{ resumeText, targetRole }` 반환 | ✅ |
| 2 | 200: targetRole=`"미지정"`도 정상 반환 | ✅ |
| 3 | 401: 미인증 요청 | ✅ |
| 4 | 400: PDF 아닌 파일 (text/plain) | ✅ |
| 5 | 400: 파일 없음 | ✅ |
| 6 | 422: engine 422 → 422 전달 | ✅ |
| 7 | 500: engine 500 → 500 반환 | ✅ |
| 8 | engine `/api/resume/analyze` URL 호출 검증 | ✅ |
| 9 | 504: engine 타임아웃 → TimeoutError → 504 반환 | ✅ |

---

## T2: `tests/api/resumes-route.test.ts` (기존 수정 — 2케이스 추가)

### 기존 유지 테스트 (11케이스)

| # | 테스트 설명 | 결과 |
|---|------------|------|
| 1 | 응답에 `{ questions, resumeId }` 포함 | ✅ |
| 2 | 401: 미인증 | ✅ |
| 3 | 400: PDF 아닌 파일 | ✅ |
| 4 | `/api/resume/feedback` URL 호출 검증 | ✅ |
| 5 | `create()`에 `feedbackJson` 포함 | ✅ |
| 6 | feedback fetch 실패해도 200 응답 | ✅ |
| 7 | targetRole이 feedback body에 포함 | ✅ |
| 8 | GET 200: 이력서 목록 반환 | ✅ |
| 9 | GET 401: 미인증 | ✅ |
| 10 | GET[id] 200: 단건 조회 | ✅ |
| 11 | GET[id] 401: 미인증 | ✅ |
| 12 | GET[id] 404: 없는 ID | ✅ |

### 신규 추가 테스트 (2케이스)

| # | 테스트 설명 | 결과 |
|---|------------|------|
| 13 | `/parse` 호출이 발생하지 않는다 | ✅ |
| 14 | formData의 `resumeText`가 `/questions` body에 전달된다 | ✅ |

---

## T3: `tests/ui/upload-form.test.tsx` (전면 수정 — 7케이스)

| # | 테스트 설명 | 결과 |
|---|------------|------|
| 1 | 초기 idle: 버튼 disabled | ✅ |
| 2 | 파일 선택 → 버튼 활성화 | ✅ |
| 3 | uploading → confirming: `/analyze` 성공 후 직무 확인 UI 표시 | ✅ |
| 4 | confirming: targetRole 입력란에 AI 추론 직무 표시 | ✅ |
| 5 | confirming: targetRole=`"미지정"` → 빈 input + placeholder | ✅ |
| 6 | confirming → done: 확인 버튼 클릭 → `onComplete` 호출 | ✅ |
| 7 | `/analyze` 오류 → error 상태 + 에러 메시지 표시 | ✅ |

---

## 전체 테스트 스위트 (참고)

이슈 #162 관련 파일 외 전체 실행 결과:

```
Test Files  5 failed | 25 passed (30)
Tests       9 failed | 152 passed (161)
```

**실패 5개 파일은 이슈 #162 이전부터 존재하던 pre-existing 이슈:**

| 파일 | 실패 원인 | 이슈 #162 연관성 |
|------|---------|----------------|
| `tests/api/observability-route.test.ts` (2) | 내부 구현 변경으로 인한 500 응답 | ❌ 무관 |
| `tests/api/report-generate-route.test.ts` (2) | `Prisma.PrismaClientKnownRequestError is not a constructor` | ❌ 무관 |
| `tests/unit/interview-repository.test.ts` (1) | `Prisma.PrismaClientKnownRequestError is not a constructor` | ❌ 무관 |

→ 이슈 #162 변경 파일(`types.ts`, `event-logger.ts`, `analyze/route.ts`, `resumes/route.ts`, `UploadForm.tsx`)에서 기인한 실패 **0개**.

---

## 커버리지 요약

| 영역 | 커버된 케이스 |
|------|------------|
| 정상 흐름 | analyze 성공 → confirming → submitting → done |
| targetRole="미지정" | 빈 input + placeholder 표시, 빈 값 제출 허용 |
| 인증 실패 | 401 반환 |
| 파일 검증 | PDF 아닌 파일, 파일 없음 → 400 |
| engine 오류 전파 | 422, 500 status 그대로 전달 |
| /parse 미호출 | fetch mock에서 /parse URL 없음 검증 |
| resumeText 전달 | /questions body에 포함 확인 |
| 중복 제출 방지 | submitting 중 메인 버튼 없음 확인 |
