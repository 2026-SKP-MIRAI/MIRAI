# [#119] 테스트 명세

> 테스트 러너: vitest (`npm test` = `vitest run`)
> 위치: `services/siw/tests/api/`

---

## 테스트 파일 목록

| 파일 | 대상 route | 케이스 수 |
|------|-----------|---------|
| `resumes-route.test.ts` | `POST /api/resumes`, `GET /api/resumes`, `GET /api/resumes/[id]` | 8개 |
| `resume-questions-route.test.ts` | `POST /api/resume/questions` | 6개 |

---

## `resumes-route.test.ts`

### POST /api/resumes — 핵심 동작 검증 (신규, #119)

| # | 테스트명 | 검증 내용 |
|---|---------|---------|
| 1 | engine /api/resume/parse 를 fetch로 호출한다 | `mockFetch`가 `/api/resume/parse`로 POST 호출됨 |
| 2 | resumeText 획득 후 upload + /api/resume/questions JSON을 Promise.all로 병렬 호출한다 | `/questions` 호출이 `Content-Type: application/json` + `{ resumeText }` body로 이루어짐; `uploadResumePdf`도 호출됨 |
| 3 | engine /parse 422 응답 시 422를 반환한다 | engine `/parse`가 422 반환 시 siw도 422 전파 |
| 4 | 응답에 { questions, resumeId } 포함 | 성공 시 200, 응답 body에 `questions`, `resumeId` 포함 |

### POST /api/resumes — 기존 검증

| # | 테스트명 | 검증 내용 |
|---|---------|---------|
| 5 | 401: 미인증 | 비인증 요청 시 401 |
| 6 | 400: PDF 아닌 파일 | `text/plain` 파일 업로드 시 400 |

### GET /api/resumes

| # | 테스트명 | 검증 내용 |
|---|---------|---------|
| 7 | 200: 이력서 목록 반환 | `id`, `fileName`, `uploadedAt`, `questionCount` 포함 |
| 8 | 401: 미인증 | 비인증 요청 시 401 |

### GET /api/resumes/[id]

| # | 테스트명 | 검증 내용 |
|---|---------|---------|
| 9 | 200: 단건 조회 | `resumeText`, `questions`, `uploadedAt` 포함, `findDetailById(id, userId)` 호출 확인 |
| 10 | 401: 미인증 | 비인증 요청 시 401 |
| 11 | 404: 없는 ID | repository 에러 시 404 |

---

## `resume-questions-route.test.ts`

### POST /api/resume/questions (전체 신규, #119)

| # | 테스트명 | 검증 내용 |
|---|---------|---------|
| 1 | engine /api/resume/parse 를 fetch로 호출한다 | `mockFetch`가 `/api/resume/parse`로 POST 호출됨 |
| 2 | resumeText를 JSON body로 /api/resume/questions 에 전송한다 | `/questions` 호출이 `Content-Type: application/json` + `{ resumeText }` body |
| 3 | engine /parse 에러 시 상태 코드 전파 | engine `/parse` 422 → 응답 422 |
| 4 | engine /questions 에러 시 상태 코드 전파 | engine `/questions` 500 → 응답 500 |
| 5 | 파일 없음 시 400 반환 | FormData에 file 없음 → 400 |
| 6 | 성공 시 200 반환 | parse + questions 모두 성공 → 200 |

---

## 실행 방법

```bash
cd services/siw
npm test
```

### 검증 결과

```
Test Files: 24 passed (24)
Tests:      117 passed (117)
TypeScript: 에러 없음 (npx tsc --noEmit)
```
