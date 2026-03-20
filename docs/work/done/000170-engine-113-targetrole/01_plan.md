# [#170] [seung] 엔진 #113 연동 — targetRole 자동 감지 및 직무 맞춤 질문 생성 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

- [x] engine-client.ts: callEngineAnalyze 추가 (timeout 40s), callEngineQuestions에 targetRole?: string 파라미터 추가, 미사용 callEngineParse 제거
- [x] questions/route.ts: callEngineParse → callEngineAnalyze 교체, targetRole 추출, "미지정" 또는 필드 누락 시 questions 호출에서 생략, 정상 값이면 callEngineQuestions에 전달
- [x] questions.test.ts: mockCallEngineParse → mockCallEngineAnalyze 전환, targetRole 케이스 추가 (정상 역할 전달 / "미지정" 시 omit)

---

## 구현 계획

### 작업 요약

| Step | 파일 | 핵심 변경 |
|------|------|-----------|
| 1 | `engine-client.ts` | `callEngineParse` 삭제 → `callEngineAnalyze` 추가 (40s), `callEngineQuestions`에 `targetRole?` 파라미터 추가 |
| 2 | `questions/route.ts` | `callEngineAnalyze` 호출로 교체, `targetRole` 추출 후 `"미지정"`·누락 시 생략, 정상값이면 questions에 전달 |
| 3 | `questions.test.ts` | `mockCallEngineParse` → `mockCallEngineAnalyze` 전환, `targetRole` 케이스 3개 신규 추가 |

---

### 현황 파악

**`services/seung/src/lib/engine-client.ts`** (현재):
- `callEngineParse(file)` → POST `/api/resume/parse`, timeout 30s → `{resumeText, extractedLength}`
- `callEngineQuestions(resumeText)` → POST `/api/resume/questions`, body `{resumeText}`

**`services/seung/src/app/api/resume/questions/route.ts`** (현재):
- `callEngineParse` → `resumeText` 추출 → `callEngineQuestions(resumeText)` → 결과 반환
- targetRole 개념 없음, 직무 무관 질문 생성됨

**`services/seung/tests/api/questions.test.ts`** (현재):
- `mockCallEngineParse`, `mockCallEngineQuestions` 사용
- `mockCallEngineParse`가 `{resumeText, extractedLength}` 반환하도록 설정

---

### Step 1 — `engine-client.ts` 수정

**파일**: `services/seung/src/lib/engine-client.ts`

변경 사항:
1. `callEngineParse` **삭제**
2. `callEngineAnalyze(file: File)` **추가**
   - POST `/api/resume/analyze`
   - timeout **40s** (30s → 40s, analyze가 더 무거운 작업)
   - 엔진 응답: `{resumeText, extractedLength, targetRole}`
3. `callEngineQuestions` 시그니처 변경: `(resumeText: string, targetRole?: string)`
   - body에 `targetRole`이 있으면 포함: `{ resumeText, ...(targetRole ? { targetRole } : {}) }`

```ts
// 변경 후 전체 모습
export async function callEngineAnalyze(file: File): Promise<Response> {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/analyze`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(40_000),
  })
}

export async function callEngineQuestions(
  resumeText: string,
  targetRole?: string
): Promise<Response> {
  return fetch(`${process.env.ENGINE_BASE_URL}/api/resume/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resumeText, ...(targetRole ? { targetRole } : {}) }),
    signal: AbortSignal.timeout(30_000),
  })
}
```

---

### Step 2 — `questions/route.ts` 수정

**파일**: `services/seung/src/app/api/resume/questions/route.ts`

변경 사항:
1. import: `callEngineParse` → `callEngineAnalyze`
2. Step 1 블록: `callEngineParse` → `callEngineAnalyze`, 변수명 `parseRes` → `analyzeRes`, `parseData` → `analyzeData`
3. `resumeText` 추출 후 `targetRole` 추출 추가:
   ```ts
   const rawTargetRole = (analyzeData as { targetRole?: unknown }).targetRole
   const targetRole =
     typeof rawTargetRole === 'string' && rawTargetRole.trim() && rawTargetRole !== '미지정'
       ? rawTargetRole
       : undefined
   ```
4. Step 2: `callEngineQuestions(resumeText)` → `callEngineQuestions(resumeText, targetRole)`
5. 로그 접두사 `[resume/questions] engine parse` → `[resume/questions] engine analyze`

---

### Step 3 — `questions.test.ts` 수정

**파일**: `services/seung/tests/api/questions.test.ts`

변경 사항:
1. `mockCallEngineParse` → `mockCallEngineAnalyze` (vi.hoisted 선언 + vi.mock 모두)
2. `callEngineParse: mockCallEngineParse` → `callEngineAnalyze: mockCallEngineAnalyze`
3. `beforeEach` 기본 mock: `mockCallEngineAnalyze`가 `{resumeText: 'extracted text', extractedLength: 100, targetRole: '백엔드 개발자'}` 반환
4. 기존 `/parse` 테스트 → `/analyze` 테스트로 명칭·내용 변경:
   - `/analyze 네트워크 오류 → 500`
   - `/analyze 성공이지만 resumeText 누락 시 500`
   - `/analyze 성공이지만 resumeText 공백만 있을 시 500`
   - `/analyze 400 에러 그대로 전달`
   - `/analyze 422 에러 그대로 전달`
5. 미인증 테스트: `mockCallEngineParse` → `mockCallEngineAnalyze` 참조 수정
6. **신규 테스트 케이스 추가**:
   - `targetRole 정상값이면 callEngineQuestions에 전달`: mockCallEngineAnalyze가 `targetRole: '프론트엔드 개발자'` 반환 → `mockCallEngineQuestions`가 `{resumeText, targetRole: '프론트엔드 개발자'}` body로 호출됐는지 확인
   - `targetRole이 "미지정"이면 callEngineQuestions에 생략`: mockCallEngineAnalyze가 `targetRole: '미지정'` 반환 → `mockCallEngineQuestions`가 `targetRole` 없이 `{resumeText}` body로 호출됐는지 확인
   - `targetRole 필드 누락 시 callEngineQuestions에 생략`: mockCallEngineAnalyze가 `targetRole` 필드 없이 반환 → 동일하게 생략 확인

---

### 주의사항 / 엣지 케이스

- `callEngineQuestions` body에 `targetRole: undefined`를 그냥 넣으면 JSON.stringify 시 키 자체가 사라짐 → spread 방식으로 처리 (이미 계획에 반영)
- 엔진 `/api/resume/analyze`의 실제 응답 스펙은 이슈 배경에서 `{resumeText, extractedLength, targetRole}` — `targetRole`이 없거나 `"미지정"`인 경우 모두 생략
- `callEngineParse`를 제거하므로 다른 곳에서 import하는지 확인 필요 → 현재 코드베이스에서 `questions/route.ts`만 사용
- 테스트 실행: `cd services/seung && npx vitest run tests/api/questions.test.ts`

---

### 실행 순서

```
1. engine-client.ts 수정
2. questions/route.ts 수정
3. questions.test.ts 수정 (Red → Green 확인)
4. 테스트 실행 통과 확인
5. .ai.md 최신화
```
