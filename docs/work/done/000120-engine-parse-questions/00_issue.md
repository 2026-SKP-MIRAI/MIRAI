# feat: [kwan] 이중 파싱 제거 — engine /parse + /questions 병렬 전환

## 사용자 관점 목표
이력서 업로드 시 이중 파싱 제거, DB 저장과 질문 생성 병렬 처리로 응답 속도 개선.

## 배경
현재 `POST /api/resume/questions`는 `Promise.all([callEngineQuestions(파일), extractTextFromPdf(buffer)])`로 이중 파싱 병렬 수행. engine `/parse` 도입 후 단일 파싱으로 전환.

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

## 구현 플랜
1. `engine-client.ts` 수정:
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

   // 변경: (file: File) → (resumeText: string), FormData → JSON
   export async function callEngineQuestions(resumeText: string): Promise<Response> {
     return fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ resumeText }),
       signal: AbortSignal.timeout(30_000),
     })
   }
   ```
2. `route.ts` 수정:
   ```typescript
   // extractTextFromPdf 함수 및 PDFParse import 삭제
   // /parse → Promise.all([DB 저장, /questions]) 전환
   const parseRes = await callEngineParse(engineFile)
   const { resumeText } = await parseRes.json()

   const [resume, engineRes] = await Promise.all([
     prisma.resume.create({ data: { resumeText, questions: [] } }),
     callEngineQuestions(resumeText),
   ])
   // engineRes 성공 후 questions 업데이트 OR Promise.all 후 DB에 questions 포함 저장 선택
   ```
3. `pdf-parse` 의존성 제거 + `.ai.md` 최신화

## 주의사항
> **이 이슈는 engine 파싱 엔드포인트 분리 이슈(#118)가 머지된 후 착수해야 합니다.**

**추가 주의사항 (#118 코드 리뷰 기반):**
- `callEngineQuestions`는 `route.ts` 한 곳에서만 호출 → 시그니처 변경 시 다른 파일 영향 없음 ✅
- `EngineQuestionsResponseSchema` (Zod) 검증 항목이 새 /questions 응답과 완전 일치 확인됨:
  - `questions: [{ category, question }]` ✅
  - `meta: { extractedLength, categoriesUsed }` ✅
  → Zod 스키마 수정 불필요
- `route.ts` 상단 `import { PDFParse } from 'pdf-parse'` 제거 필수 (TypeScript 컴파일 에러 방지)
- 기존 빈 resumeText 분기(`if (!resumeText)` → resumeId: null)는 engine /parse 422로 대체되어 제거 가능

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 변경 파일 (9개, services/kwan/ 내부만)

**`src/lib/engine-client.ts`**
- `callEngineParse(file: File)` 추가 — engine `/api/resume/parse`에 multipart 전송
- `callEngineQuestions` 시그니처 변경: `(file: File)` multipart → `(resumeText: string)` JSON

**`src/app/api/resume/questions/route.ts`** — 전면 재작성
- `extractTextFromPdf()` 함수 및 `PDFParse` import 삭제
- 새 흐름: PDF → callEngineParse → resumeText 추출 → Promise.all([callEngineQuestions, prisma.create]) → Zod 검증 → 응답
- 엔진 에러 응답을 `{ error: detail }` 형식으로 래핑 (한국어 fallback 포함)
- TimeoutError/AbortError 구분 처리 (타임아웃 전용 메시지)
- DB 실패 시 `.catch(() => null)` → `resumeId: null`로 graceful degradation
- `maxDuration` 35 → 70 (parse 30s + questions 30s 직렬 고려)

**`src/domain/interview/types.ts`**
- `GenerateResult.resumeId`: `string` → `string | null` (DB 실패 시 null 반환 패턴 타입 일치)

**`src/components/QuestionList.tsx`**
- `resumeId` prop 타입: `string` → `string | null`
- `!resumeId` 시 면접 시작 버튼 비활성화 + early return 추가

**`tests/api/resume-questions.test.ts`** — 전면 재작성 (15개 테스트)
- pdf-parse mock 제거, callEngineParse/callEngineQuestions mock으로 전환
- 커버리지: 파일 없음, /parse 네트워크·JSON·400·422·resumeText 누락·공백, 정상 흐름, /questions 에러·네트워크, DB 실패, /parse 타임아웃, /questions 타임아웃, /questions JSON 파싱 실패, Zod 검증 실패

**`package.json`** — `pdf-parse`, `@types/pdf-parse`, `pdfjs-dist` 제거

**`next.config.ts`** — `serverExternalPackages: ['pdf-parse']` 제거 (빈 config)

**`.ai.md`** — 기술 스택·API 라우트·구조 트리 업데이트

### 기술적 결정
- seung #121 패턴을 따름 (DB 실패 → 200 + resumeId: null, questions: [] 저장)
- Zod 검증은 kwan 기존 패턴 유지 (seung의 Array.isArray보다 엄격)
- 엔진 에러 래핑은 seung보다 개선 (raw passthrough → `{ error }` 형식)

