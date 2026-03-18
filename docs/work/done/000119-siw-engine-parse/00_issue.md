# feat: [siw] 이중 파싱 제거 — engine /parse + /questions 병렬 전환

## 사용자 관점 목표
이력서 업로드 시 PDF 파싱이 한 번만 발생하고, Supabase 저장과 질문 생성이 병렬 처리되어 응답 속도 개선.

## 배경
현재 `POST /api/resumes`는 로컬 `parsePdf(buffer)` + engine `/questions` 파일 전송으로 이중 파싱이 순차 발생. engine `/parse` 도입 후, 파싱을 engine에 위임하고 결과 텍스트를 병렬 활용.

## 완료 기준
- [x] `POST /api/resumes` 흐름: engine `/api/resume/parse` → `Promise.all([uploadResumePdf, engine /api/resume/questions({ resumeText })])` → DB 저장
- [x] `POST /api/resume/questions` 흐름도 동일하게 전환 (해당 route도 parsePdf + engine /questions FormData 사용 중)
- [x] `services/siw/src/lib/pdf-parser.ts` 삭제 및 import 제거 (resumes/route.ts, resume/questions/route.ts 두 곳 모두)
- [x] `pdf-parse` 패키지 제거 (미사용 확인 후)
- [x] engine `/parse` 에러 시 적절한 HTTP 상태 코드 전파 (`mapDetailToKey` 재사용 가능)
- [x] 기존 응답 형식 유지 (`{ questions, meta, resumeId }`)
- [x] `services/siw/.ai.md` 최신화
- [x] 테스트 2개 이상 (resumes 6케이스 + questions 6케이스, 총 12개 신규)
- [x] `services/siw/` 내 파일만 변경 (engine 코드 수정 금지)

## 구현 플랜
1. `resumes/route.ts` — parsePdf 제거, engine `/parse` fetch 추가
2. 병렬화 설계:
   ```typescript
   // engine /parse → resumeText 획득
   const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, { method: 'POST', body: engineForm })
   const { resumeText } = await parseResp.json()

   // 스토리지 업로드 + /questions 병렬
   const [storageKey, engineData] = await Promise.all([
     uploadResumePdf(user.id, buffer, file.name),
     fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ resumeText }),
     }).then(r => r.json()),
   ])

   // 두 결과 모두 준비된 후 DB 저장 (questions 포함)
   const resumeId = await resumeRepository.create({ ..., storageKey, resumeText, questions: engineData.questions ?? [] })
   ```
   - `questions Json @default("[]")` 이므로 TypeScript에서도 `questions: []` 전달 가능 ✅
3. `resume/questions/route.ts` — 동일하게 parsePdf 제거, engine `/parse` → `/questions JSON` 전환 (이 route는 resumeId 저장 없음 — DB 저장 불필요)
4. `pdf-parser.ts` 삭제, `pdf-parse` 의존성 제거
5. `.ai.md` 최신화

## 주의사항
> **이 이슈는 engine 파싱 엔드포인트 분리 이슈(#118)가 머지된 후 착수해야 합니다.**
> engine `POST /api/resume/parse` 엔드포인트와 `/questions` JSON 수신 전환이 완료되어야 서비스에서 호출 가능합니다.

**추가 주의사항 (#118 코드 리뷰 기반):**
- `pdf-parser.ts`를 import하는 파일이 2개임: `resumes/route.ts` AND `resume/questions/route.ts` — 둘 다 수정 필요
- `mapDetailToKey()` 함수가 engine /parse 에러 메시지("파일", "크기", "페이지", "이미지", "텍스트")를 모두 이미 처리함 → 재사용 가능
- engine /parse 422 응답(빈PDF/이미지PDF)은 기존 `mapDetailToKey`의 `imageOnlyPdf`, `emptyPdf` key로 매핑됨

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 2026-03-19 — 구현 완료 (9/9 AC)

#### resumes/route.ts
- `parsePdf(buffer)` 로컬 파싱 블록 제거
- engine `POST /api/resume/parse` fetch 추가 (FormData, AbortSignal.timeout(30000))
- engine /parse 에러 시 `mapDetailToKey` 재사용하여 HTTP 상태 코드 전파
- `Promise.all([uploadResumePdf, fetch /questions JSON])` 병렬화
- `/questions` 호출 FormData → JSON body `{ resumeText }` 전환
- catch 블록: 내부 에러 메시지 노출 방지 → `ENGINE_ERROR_MESSAGES.llmError` 반환

#### resume/questions/route.ts
- `parsePdf` import 및 호출 블록 제거
- engine `/api/resume/parse` fetch 추가 (에러 시 상태 코드 전파)
- `/questions` 호출 FormData → JSON body `{ resumeText }` 전환
- PDF 타입 체크(`file.type !== "application/pdf"`) 추가 (resumes/route.ts와 일관성)

#### pdf-parser.ts 삭제 + pdf-parse 패키지 제거
- `src/lib/pdf-parser.ts` git rm (DOMMatrix 폴리필 등 Node.js 핵 제거)
- `package.json`: `pdf-parse ^2.4.5`, `@types/pdf-parse ^1.1.5` 제거
- `next.config.ts`: `serverExternalPackages: ["pdf-parse"]`, `outputFileTracingIncludes` 제거

#### 테스트 (TDD)
- `tests/api/resumes-route.test.ts`: engine /parse 호출 확인, Promise.all JSON body 확인, 422 전파, 응답 형식 검증 등 6케이스 신규
- `tests/api/resume-questions-route.test.ts`: 동일 패턴 6케이스 신규
- vitest 117/117 통과, `npx tsc --noEmit` 에러 없음

#### .ai.md 최신화
- Issue #119 완료 기록, 구조 트리 route 설명 업데이트, pdf-parse 기술 스택 항목 제거

