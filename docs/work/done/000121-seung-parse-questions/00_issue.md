# feat: [seung] 이중 파싱 제거 — engine /parse + /questions 병렬 전환

## 사용자 관점 목표
이력서 업로드 시 이중 파싱 제거, DB 저장과 질문 생성 병렬 처리로 응답 속도 개선.

## 배경
현재 `POST /api/resume/questions`는 `Promise.all([fetch(engine /questions, multipart), extractPdfText(buffer)])`로 이중 파싱 수행. `pdf-utils.ts`에서 `pdf-parse` dynamic import 구조. engine `/parse` 도입 후 단일 파싱 전환.

## 완료 기준
- [x] `POST /api/resume/questions` 흐름: engine `/api/resume/parse` → `Promise.all([DB 저장, engine /api/resume/questions({ resumeText })])`
- [x] `services/seung/src/lib/pdf-utils.ts` 삭제 및 import 제거
- [x] `lib/engine-client.ts` 신규 생성: `callEngineParse(file)`, `callEngineQuestions(resumeText)` 함수 포함
- [x] `pdf-parse` 패키지 제거 (미사용 확인 후)
- [x] 기존 응답 형식 유지
- [x] `services/seung/.ai.md` 최신화
- [x] 테스트 2개 이상
- [x] `services/seung/` 내 파일만 변경 (engine 코드 수정 금지)

## 구현 플랜
1. `src/lib/engine-client.ts` 신규 생성 (현재 seung에 없음 — inline fetch를 함수로 분리):
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
2. `route.ts` 수정:
   ```typescript
   // extractPdfText, engineFormData 제거
   // /parse → Promise.all([DB 저장, /questions JSON]) 전환
   const parseRes = await callEngineParse(engineFile)
   if (!parseRes.ok) { /* 에러 전파 */ }
   const { resumeText } = await parseRes.json()

   const [engineResponse, resumeId] = await Promise.all([
     callEngineQuestions(resumeText),
     prisma.resume.create({ data: { resumeText, questions: [] } }).then(r => r.id),
   ])
   ```
3. `pdf-utils.ts` 삭제, `pdf-parse` 의존성 제거 + `.ai.md` 최신화

## 주의사항
> **이 이슈는 engine 파싱 엔드포인트 분리 이슈(#118)가 머지된 후 착수해야 합니다.**

**추가 주의사항 (#118 코드 리뷰 기반):**
- seung에 현재 `engine-client.ts` 없음 → 신규 생성 필수 (kwan 패턴 참고)
- `pdf-parse` 사용처가 `pdf-utils.ts` 한 곳뿐 → 삭제 후 패키지 제거 가능 ✅
- 기존 `resumeText.trim()` 빈값 분기(DB 저장 스킵 + 경고 로그)는 engine /parse가 빈 PDF를 422로 막으므로 사실상 dead code → 제거 가능
- engine /parse 에러(400/422/500) 처리: 현재 `route.ts`의 에러 패턴(`NextResponse.json({ error: ... }, { status })`) 그대로 유지하되 /parse 에러도 동일하게 처리
- `maxDuration = 35` (현재값): /parse + /questions 직렬 호출로 총 타임아웃 소요 증가 가능 → 60으로 조정 권고

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 변경 파일 요약

| 파일 | 변경 | 이유 |
|------|------|------|
| `src/lib/engine-client.ts` | 신규 생성 | inline fetch를 `callEngineParse`, `callEngineQuestions` 함수로 분리 |
| `src/app/api/resume/questions/route.ts` | 수정 | 이중 파싱 제거, engine /parse → /questions 전환, resumeText 방어 코드 추가 |
| `src/lib/pdf-utils.ts` | 삭제 | engine /parse가 파싱을 담당하므로 불필요 |
| `next.config.ts` | 수정 | `serverExternalPackages: ['pdf-parse']` 잔여 설정 제거 |
| `package.json` / `package-lock.json` | 수정 | `pdf-parse`, `@types/pdf-parse` 제거 |
| `tests/api/questions.test.ts` | 전면 수정 | engine-client mock으로 전환, /parse 케이스 6개 신규 추가 |
| `services/seung/.ai.md` | 수정 | engine-client.ts 반영, Phase 4 항목 추가 |

### 핵심 변경 내용

**이중 파싱 제거**: 기존 `POST /api/resume/questions`는 engine `/questions`에 multipart로 파일을 보내면서 동시에 `pdf-parse`로 직접 파싱하는 구조였다. engine #118 업데이트로 `/parse`(multipart→텍스트)와 `/questions`(JSON→질문)가 분리됨에 따라, seung도 `/parse` 호출 후 `resumeText`를 받아 `/questions`에 JSON으로 전달하는 단일 파싱 구조로 전환했다.

**병렬 처리**: `/parse` 완료 후 `callEngineQuestions(resumeText)`와 `prisma.resume.create({ resumeText, questions: [] })`를 `Promise.all`로 병렬 실행한다. DB에는 `questions: []`로 먼저 생성해 병렬성을 확보했다(downstream 코드가 `Resume.questions`를 읽지 않음을 확인).

**방어 코드 추가**: `/parse` 200 응답이라도 `resumeText`가 string이 아닌 경우 500을 반환하는 검증 추가.

**maxDuration**: 35 → 60 (parse + questions 직렬 타임아웃 여유 확보).

### 테스트

기존 10개 테스트를 전면 수정해 `engine-client` mock 방식으로 전환했다. `/parse` 관련 케이스 6개(네트워크 오류, 400/422 에러 전파, resumeText 누락 포함)를 신규 추가해 총 14개. 전체 Vitest 93개 통과.
