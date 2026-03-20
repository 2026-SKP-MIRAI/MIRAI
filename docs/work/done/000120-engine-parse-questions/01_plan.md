# [#120] feat: [kwan] 이중 파싱 제거 — engine /parse + /questions 병렬 전환 — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [x] `POST /api/resume/questions` 흐름: engine `/api/resume/parse` → `Promise.all([DB 저장, engine /api/resume/questions({ resumeText })])`
- [x] `route.ts` 내부 `extractTextFromPdf()` 함수 삭제
- [x] `engine-client.ts`의 `callEngineQuestions` 변경: `(file: File)` multipart → `(resumeText: string)` JSON `{ resumeText }`
- [x] `engine-client.ts`에 `callEngineParse(file: File)` 추가
- [x] `pdf-parse` 패키지 제거 (미사용 확인 후)
- [x] 기존 응답 형식 유지
- [x] `services/kwan/.ai.md` 최신화
- [x] 테스트 2개 이상
- [x] `services/kwan/` 내 파일만 변경 (engine 코드 수정 금지)

---

## Context
현재 `POST /api/resume/questions`는 `callEngineQuestions(file)` (multipart) + `extractTextFromPdf(arrayBuffer)` (pdf-parse)를 병렬 수행하는 이중 파싱 구조. engine `/api/resume/parse` 도입 후 단일 파싱으로 전환.

이슈 #121 (seung)이 동일 작업을 완료했으므로 그 패턴을 따름. 검증 결과 반영 완료.

---

## 변경 파일 (9개, services/kwan/ 내부만)

### 1. `src/lib/engine-client.ts`
- `callEngineParse(file: File)` 추가 → `ENGINE_BASE_URL/api/resume/parse` multipart
- `callEngineQuestions` 시그니처: `(file: File)` multipart → `(resumeText: string)` JSON `{ resumeText }`
- `ENGINE_BASE_URL` fallback(`?? 'http://localhost:8000'`) 유지 (kwan 기존 패턴, callEngineStart/Answer와 동일)
- 나머지 함수(`callEngineStart`, `callEngineAnswer`) 변경 없음

```typescript
// 추가
export async function callEngineParse(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}

// 변경
export async function callEngineQuestions(resumeText: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText }),
    signal: AbortSignal.timeout(30_000),
  })
}
```

### 2. `src/app/api/resume/questions/route.ts`
**흐름 변경:**
```
Before: PDF → Promise.all([callEngineQuestions(file), extractTextFromPdf(buf)]) → DB 저장 → 응답
After:  PDF → callEngineParse(file) → resumeText
             → Promise.all([callEngineQuestions(resumeText), prisma.create({resumeText, questions:[]})]) → 응답
```

**구체적 변경:**
- `import { PDFParse } from 'pdf-parse'` 삭제
- `import { callEngineParse, callEngineQuestions }` 로 변경
- `extractTextFromPdf()` 함수 전체 삭제
- `export const runtime = 'nodejs'` 유지
- `maxDuration` 35 → 70 (parse 30s + questions 30s 직렬)
- `arrayBuffer`, `engineFile` 생성 코드 삭제 (callEngineParse가 File 직접 받음)

**Step 0: formData 파싱** (seung #121 패턴)
```typescript
let formData: FormData
try { formData = await req.formData() } catch { return Response.json({ error: '...' }, { status: 400 }) }
```

**Step 1: /parse 호출**
```typescript
const parseRes = await callEngineParse(file)  // try-catch로 네트워크 에러 처리
const parseData = await parseRes.json()       // try-catch로 JSON 파싱 에러 처리
if (!parseRes.ok) return Response.json(parseData, { status: parseRes.status })  // 400/422 전파
const resumeText = (parseData as { resumeText?: unknown }).resumeText
if (typeof resumeText !== 'string' || !resumeText.trim()) return 500  // 누락/공백 처리
```

**Step 2: questions + DB 병렬**
```typescript
const [engineRes, resume] = await Promise.all([
  callEngineQuestions(resumeText),
  prisma.resume.create({ data: { resumeText, questions: [] } }).catch((err) => {
    console.error('[resume/questions] DB save failed', { err })
    return null
  }),
  // questions: [] — DB save와 /questions 병렬이므로 실제 질문은 아직 없음
  // resume.questions는 downstream(interview/start)에서 읽지 않음 (resumeText만 사용)
])
resumeId = resume?.id ?? null
```

**Step 3: /questions 응답 처리**
- `EngineQuestionsResponseSchema` Zod 검증 유지 (seung보다 엄격, kwan 기존 패턴)
- `!engineRes.ok` → status 전파
- 최종: `Response.json({ ...data, resumeId })`

### 3. `src/domain/interview/types.ts`
- `GenerateResult.resumeId` 타입: `string` → `string | null`
  - DB 실패 시 `null` 반환하는 패턴과 타입 일치시킴
  - 기존 코드에도 `resumeId: null` 분기가 있었으나 타입이 맞지 않았음

### 3-1. `src/components/QuestionList.tsx` (검증 Round 2에서 발견)
- Props `resumeId: string` → `resumeId: string | null`
- `resumeId`가 null일 때 "면접 시작" 버튼 비활성화 (disabled) 또는 숨김 처리
- `handleInterviewStart` 내부에서 `if (!resumeId) return` guard 추가

### 3-2. `src/app/page.tsx` (검증 Round 2에서 발견)
- `result.resumeId`가 `string | null`이므로 QuestionList에 전달 시 타입 호환 확인
- 기존 `as GenerateResult` 캐스팅은 유지 (타입이 이미 `string | null`로 변경됨)

### 4. `tests/api/resume-questions.test.ts`
**전면 재작성** — pdf-parse mock 제거, callEngineParse/callEngineQuestions mock으로 전환

테스트 케이스 (12개):
1. 파일 없음 → 400
2. /parse 네트워크 오류 → 500
3. /parse JSON 파싱 실패 → 500
4. /parse 400 에러 전달
5. /parse 422 에러 전달
6. /parse 성공이지만 resumeText 누락 → 500
7. /parse 성공이지만 resumeText 공백 → 500
8. 정상 흐름 → 200 + questions + resumeId
9. /questions 에러 → 에러 전달
10. /questions 네트워크 오류 → 500
11. DB 저장 실패 → 200 + resumeId: null
12. Zod 검증 실패 (questions 형식 불일치) → 500

### 5. `package.json`
- `"pdf-parse"` 제거
- `"@types/pdf-parse"` 제거
- `"pdfjs-dist"` 제거 (src에서 미사용 확인됨)

### 6. `next.config.ts`
- `serverExternalPackages: ['pdf-parse']` 제거
- 빈 config로 남김: `const nextConfig: NextConfig = {}`

### 7. `.ai.md`
- 기술 스택에서 `pdf-parse` 제거
- API 라우트 설명: `/parse → /questions` 흐름으로 업데이트
- 구조 트리에서 pdf-parse 참조 제거
- `next.config.ts` 설명 업데이트

---

## 구현 순서
1. `engine-client.ts` 수정 (callEngineParse 추가, callEngineQuestions 변경)
2. `route.ts` 재작성 (새 흐름, formData try-catch 포함)
3. `types.ts` — `GenerateResult.resumeId: string | null`
4. `QuestionList.tsx` — Props 타입 수정 + null guard
5. 테스트 재작성 (12개)
6. `npm test` 통과 확인
7. `package.json`에서 pdf-parse, @types/pdf-parse, pdfjs-dist 제거
8. `next.config.ts` — serverExternalPackages 제거
9. `npm install` → lockfile 갱신
10. `npm run build` 통과 확인
11. `.ai.md` 최신화

## Verification
```bash
cd services/kwan
npm test                    # 12개 테스트 통과
npm run build               # TypeScript 컴파일 에러 없음
```
추가 확인:
- `grep -r "pdf-parse\|pdfjs-dist\|extractTextFromPdf\|PDFParse" services/kwan/src/` → 결과 없음
- `callEngineQuestions` 시그니처가 `(resumeText: string)`인지 확인
- `GenerateResult.resumeId`가 `string | null`인지 확인

## 검증 결과 요약 (Round 2 반영)
- AC 9개 항목: 전부 PASS
- 아키텍처 불변식 5개: 전부 PASS
- dev_spec.md 응답/에러/통신 패턴: 전부 PASS
- #121 구현 대조: MATCH (허용된 divergence만 존재)
- Round 2 발견 3건 해소:
  - `QuestionList.tsx` + `page.tsx` 변경 목록 추가 (빌드 실패 방지)
  - `formData()` try-catch 추가 (#121 패턴)
  - `.catch()` 내 `console.error` 추가 (관측성)
- 머지 가능 여부: YES (CRITICAL 0개)
