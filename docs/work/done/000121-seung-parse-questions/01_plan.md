# [#121] feat: [seung] 이중 파싱 제거 — engine /parse + /questions 병렬 전환 — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [ ] `POST /api/resume/questions` 흐름: engine `/api/resume/parse` → `Promise.all([DB 저장, engine /api/resume/questions({ resumeText })])`
- [ ] `services/seung/src/lib/pdf-utils.ts` 삭제 및 import 제거
- [ ] `lib/engine-client.ts` 신규 생성: `callEngineParse(file)`, `callEngineQuestions(resumeText)` 함수 포함
- [ ] `pdf-parse` 패키지 제거 (미사용 확인 후)
- [ ] 기존 응답 형식 유지
- [ ] `services/seung/.ai.md` 최신화
- [ ] 테스트 2개 이상
- [ ] `services/seung/` 내 파일만 변경 (engine 코드 수정 금지)

---

## 구현 계획

### 배경 및 변경 사유

이슈 #118에서 engine이 두 엔드포인트로 분리됐다:
- `POST /api/resume/parse` — multipart PDF 수신 → `{ resumeText, extractedLength }` 반환
- `POST /api/resume/questions` — **JSON** `{ resumeText }` 수신으로 변경 (multipart 제거)

현재 seung의 `route.ts`는 engine `/questions`에 multipart를 보내면서 동시에 `pdf-parse`로 직접 파싱하는 이중 구조다. engine 변경에 맞춰 seung도 단일 파싱으로 전환한다.

---

### Step 1 — `src/lib/engine-client.ts` 신규 생성

변경 파일: `services/seung/src/lib/engine-client.ts` (신규)

```typescript
const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL

export async function callEngineParse(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
}

export async function callEngineQuestions(resumeText: string): Promise<Response> {
  return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText }),
    signal: AbortSignal.timeout(30_000),
  })
}
```

---

### Step 2 — `route.ts` 수정

변경 파일: `services/seung/src/app/api/resume/questions/route.ts`

**주요 변경점:**
- `maxDuration`: 35 → 60 (parse + questions 직렬 타임아웃 여유)
- `extractPdfText`, `engineFormData` 제거
- `callEngineParse` → `callEngineQuestions` 순서로 호출
- `/parse` 에러(400/422/500) → 그대로 전파
- `/parse` 성공 → `{ resumeText }` 추출 → `Promise.all([callEngineQuestions(resumeText), prisma.resume.create(...)])`
- `resumeText.trim()` 빈값 분기 제거 (engine /parse가 422로 막으므로 dead code)

**새 흐름 의사코드:**

```
POST 수신 → formData 파싱 → file 검증 → ENGINE_BASE_URL 검증

1. callEngineParse(file) 호출
   - 실패(network) → 500
   - !ok → status/body 그대로 전파

2. parseRes.json() → { resumeText } 추출

3. Promise.all([
     callEngineQuestions(resumeText),
     prisma.resume.create({ data: { resumeText, questions: [] } })  ← questions는 step 4에서 채움
   ])
   → 실제로는: questions 결과를 알아야 DB에 저장 가능
   → 따라서: Promise.all([callEngineQuestions(resumeText), prisma.resume.create({ resumeText, questions: [] })])
      아니면 questions 먼저 받은 뒤 DB 저장?

   ** AC 정의 재확인: "Promise.all([DB 저장, engine /api/resume/questions({ resumeText })])"
   → questions 결과를 DB에 저장해야 하므로 questions 결과를 먼저 받은 뒤 DB 저장이 맞음.
   → 하지만 현재 코드도 questions 먼저 받고 DB 저장하는 구조.
   → AC의 의미: /parse 이후 DB저장과 /questions를 병렬로 처리하되,
      현재 구현은 questions 결과(배열)를 DB에 저장하므로 완전 병렬 불가.

   ** 현재 코드 재확인: DB에 `questions` 배열을 저장함. 즉 questions 응답이 있어야 DB 저장 가능.
   → 이슈 본문 구현 플랜에서는:
      "Promise.all([callEngineQuestions(resumeText), prisma.resume.create({ resumeText, questions: [] }).then(r => r.id)])"
      즉 DB에는 빈 questions로 먼저 생성하고 resumeId만 받는 구조.

   → 이슈 본문 플랜을 따름: DB에 `questions: []`로 먼저 생성 → resumeId 확보.
      questions 배열 저장은 포기하거나 별도 update로 처리.

   ** 하지만 기존 코드가 questions 배열을 DB에 저장하는 이유가 있을 것 (resume/feedback에서 사용).
   → resume/feedback route 확인 필요. 현재는 resumeText만 사용하는 것으로 보임.
   → questions 저장 포기 가능 여부: AC에 "기존 응답 형식 유지"만 있고 DB 저장 형식은 언급 없음.
   → 이슈 본문 플랜이 `questions: []`로 저장하므로 이를 따름.

4. /questions 에러 처리: !ok → status/body 전파
5. questions 배열 검증 → 응답 반환 (resumeId 포함)
```

**실제 구현:**

```typescript
export const maxDuration = 60

export async function POST(request: NextRequest) {
  // formData, file, ENGINE_BASE_URL 검증 (기존과 동일)

  // Step 1: parse
  let parseRes: Response
  try {
    parseRes = await callEngineParse(file)
  } catch (err) {
    // network 오류
    return NextResponse.json({ error: '서버 오류...' }, { status: 500 })
  }
  let parseData: unknown
  try {
    parseData = await parseRes.json()
  } catch {
    return NextResponse.json({ error: '서버 오류...' }, { status: 500 })
  }
  if (!parseRes.ok) {
    return NextResponse.json(parseData, { status: parseRes.status })
  }
  const resumeText = (parseData as { resumeText: string }).resumeText

  // Step 2: 병렬 — questions + DB 저장
  let engineResponse: Response
  let resumeId: string | null = null
  try {
    const [qRes, resume] = await Promise.all([
      callEngineQuestions(resumeText),
      prisma.resume.create({ data: { resumeText, questions: [] } }).catch((err) => {
        console.error('[resume/questions] DB save failed', { err })
        return null
      }),
    ])
    engineResponse = qRes
    resumeId = resume?.id ?? null
  } catch (err) {
    return NextResponse.json({ error: '서버 오류...' }, { status: 500 })
  }

  // questions 응답 처리 (기존과 동일)
  let data: unknown
  try {
    data = await engineResponse.json()
  } catch {
    return NextResponse.json({ error: '서버 오류...' }, { status: 500 })
  }
  if (!engineResponse.ok) {
    return NextResponse.json(data, { status: engineResponse.status })
  }
  const questions = (data as Record<string, unknown>)?.questions
  if (!Array.isArray(questions)) {
    return NextResponse.json({ error: '엔진 응답이 올바르지 않습니다.' }, { status: 502 })
  }

  return NextResponse.json({ ...(data as object), resumeId }, { status: 200 })
}
```

---

### Step 3 — `pdf-utils.ts` 삭제 + import 제거

- `services/seung/src/lib/pdf-utils.ts` 삭제
- `route.ts`에서 `import { extractPdfText } from '@/lib/pdf-utils'` 제거

---

### Step 4 — `pdf-parse` 패키지 제거

```bash
cd services/seung && npm uninstall pdf-parse @types/pdf-parse
```

사용처 전수 확인 후 제거:
- `pdf-utils.ts` (삭제 예정) 외 다른 파일에서 사용 없음 확인

---

### Step 5 — 테스트 업데이트

변경 파일: `services/seung/tests/api/questions.test.ts`

**기존 10개 테스트 전면 수정:**
- `mockExtractPdfText`, `vi.mock('@/lib/pdf-utils', ...)` 제거
- `vi.mock('@/lib/engine-client', ...)` 추가: `callEngineParse`, `callEngineQuestions` mock
- 또는 global fetch mock 유지하되 두 번 호출 패턴으로 변경

**mock 전략:** engine-client 함수 직접 mock (fetch 2회 호출보다 명확)

```typescript
const { mockCallEngineParse, mockCallEngineQuestions } = vi.hoisted(() => ({
  mockCallEngineParse: vi.fn(),
  mockCallEngineQuestions: vi.fn(),
}))
vi.mock('@/lib/engine-client', () => ({
  callEngineParse: mockCallEngineParse,
  callEngineQuestions: mockCallEngineQuestions,
}))
```

**테스트 케이스 (최소 10개 유지):**

| # | 설명 | 변경 내용 |
|---|------|----------|
| 1 | 파일 없으면 400 | 유지 |
| 2 | ENGINE_BASE_URL 없으면 500 | 유지 |
| 3 | /parse 네트워크 오류 → 500 | 신규 |
| 4 | /parse 400 에러 전파 | 신규 |
| 5 | /parse 422 에러 전파 | 신규 |
| 6 | /questions 400 에러 전파 | 수정 (이전 엔진 400) |
| 7 | /questions 422 에러 전파 | 수정 |
| 8 | /questions 500 에러 전파 | 수정 |
| 9 | 성공 시 resumeId 반환 | 수정 |
| 10 | Prisma create 올바른 데이터 | 수정 (questions: [] 로 저장) |
| 11 | DB 실패 시에도 엔진 결과 반환 (resumeId=null) | 수정 |
| 12 | /questions 응답에 questions 배열 없으면 502 | 유지 |

**삭제 테스트:**
- `'빈 resumeText이면 DB 저장 건너뛰고 resumeId=null 반환'` → engine /parse가 422로 막으므로 dead code, 테스트 제거

---

### Step 6 — `.ai.md` 최신화

변경 파일: `services/seung/.ai.md`

- 구조 섹션: `pdf-utils.ts` 항목 제거, `engine-client.ts` 항목 추가
- 진행 상태: Phase 4 항목 추가 (이중 파싱 제거 #121)
- `pdf-parse` 의존성 제거 반영

---

### 변경 파일 목록

| 파일 | 작업 |
|------|------|
| `src/lib/engine-client.ts` | 신규 생성 |
| `src/app/api/resume/questions/route.ts` | 수정 |
| `src/lib/pdf-utils.ts` | 삭제 |
| `package.json` | `pdf-parse`, `@types/pdf-parse` 제거 |
| `tests/api/questions.test.ts` | 전면 수정 |
| `.ai.md` | 최신화 |

---

### 주의사항

1. **`questions: []` 저장**: DB에 questions 배열을 저장하지 않음. `resume/feedback`에서 `resumeText`만 사용하므로 영향 없음.
2. **에러 전파 일관성**: `/parse`, `/questions` 모두 engine 에러 status/body를 그대로 전파 (기존 패턴 유지).
3. **DB best-effort**: DB 저장 실패 시 `resumeId=null`로 응답 — 클라이언트가 면접 시작 버튼을 숨김 (기존 동작 유지).
4. **engine-client mock**: `vi.mock('@/lib/engine-client', ...)` 방식으로 테스트 — fetch를 직접 mock하는 것보다 단순하고 명확.
