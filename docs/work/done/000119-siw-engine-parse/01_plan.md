# [#119] feat: [siw] 이중 파싱 제거 — engine /parse + /questions 병렬 전환 — 구현 계획

> 작성: 2026-03-18

---

## 배경 — 무슨 문제가 있었나?

### 기존 문제: PDF가 두 번 파싱되고 있었다

이력서 업로드(`POST /api/resumes`) 흐름을 예로 들면, 기존 코드는 다음 순서로 동작했다:

```
클라이언트 → POST /api/resumes (PDF 파일)
  → siw: parsePdf(buffer)         ← 1번째 파싱 (로컬, pdf-parse 패키지)
  → engine: POST /questions (PDF 파일 첨부)
      → engine 내부: 또 PDF 파싱  ← 2번째 파싱 (engine, #118에서 구현)
  → DB 저장
```

같은 PDF를 siw와 engine이 각각 한 번씩, 총 **두 번** 파싱하고 있었다.

이 이중 파싱이 발생한 이유는:
1. siw는 `resumeText`(파싱된 텍스트)를 DB에 저장해야 했고, 당시에는 직접 파싱하는 것이 유일한 방법이었다.
2. engine의 `/questions`는 파일을 받아서 내부에서 파싱해 LLM에 전달하는 구조였다.
3. `#118`에서 engine에 `/parse` 엔드포인트가 추가되고 `/questions`가 JSON body(`{ resumeText }`)를 받도록 바뀌었지만, siw 쪽은 아직 이를 활용하지 않았다.

### 추가 문제: 스토리지 업로드와 질문 생성이 순차 실행됐다

기존 흐름에서 Supabase Storage 업로드(`uploadResumePdf`)와 engine 질문 생성은 **순차**로 실행됐다:

```
parsePdf → engine /questions → uploadResumePdf → DB 저장
```

둘은 서로 의존성이 없으므로 병렬 실행이 가능했지만 구현이 되어 있지 않았다.

---

## 해결: engine에 파싱을 위임하고 병렬화

`#118`에서 engine에 `POST /api/resume/parse` 엔드포인트가 생겼다. 이를 활용해:

1. siw가 직접 PDF를 파싱하지 않고 **engine에 위임** → 파싱이 한 번만 발생
2. engine에서 받은 `resumeText`를 `/questions` 호출 시 JSON body로 전달 → engine도 재파싱 불필요
3. 파싱 결과(`resumeText`) 획득 후 스토리지 업로드와 질문 생성을 **Promise.all로 병렬 실행** → 응답 속도 개선

새 흐름:
```
클라이언트 → POST /api/resumes (PDF 파일)
  → engine: POST /parse (PDF 파일)     ← 파싱은 여기서 한 번만
      ← { resumeText }
  → Promise.all([
      Supabase Storage 업로드,          ← 병렬
      engine: POST /questions (resumeText JSON)  ← 병렬
    ])
  → DB 저장 (storageKey + questions 모두 확보 후)
```

---

## AC별 해결 내용

| AC | 어떤 문제를 해결하나 |
|----|---------------------|
| `POST /api/resumes` engine /parse → Promise.all 전환 | 이중 파싱 제거 + 업로드·질문생성 병렬화로 응답 속도 개선 |
| `POST /api/resume/questions` 동일하게 전환 | 이 route도 parsePdf → engine /parse 방식을 쓰고 있었으므로 동일하게 제거. DB 저장은 없으므로 병렬화 불필요 |
| `pdf-parser.ts` 삭제 및 import 제거 | 로컬 파싱 코드가 남아 있으면 실수로 다시 사용될 수 있고, DOMMatrix 폴리필 등 Node.js 환경 핵을 유지해야 함. 사용처가 없어졌으므로 완전 제거 |
| `pdf-parse` 패키지 제거 | 미사용 패키지는 보안 취약점 노출 면적을 늘리고 Docker 이미지를 무겁게 함. `serverExternalPackages`, `outputFileTracingIncludes` 설정도 함께 제거 가능 |
| engine `/parse` 에러 시 HTTP 상태 코드 전파 | engine이 이미지 전용 PDF(422), 빈 PDF(422) 등을 감지해 반환하는 에러가 siw에서 묻혀 500으로 나가는 문제 방지. `mapDetailToKey`를 재사용해 engine 에러 코드 → 적절한 HTTP 코드로 변환 |
| 기존 응답 형식 유지 (`{ questions, meta, resumeId }`) | 클라이언트(UploadForm 등)가 기대하는 응답 구조가 변경되면 프론트엔드가 깨짐. 구현 변경에도 외부 API 계약은 그대로 유지 |
| `services/siw/.ai.md` 최신화 | pdf-parser.ts 삭제·패키지 제거를 문서에 반영하지 않으면 다음 작업자가 코드 구조를 잘못 파악함 |
| 테스트 2개 이상 | engine /parse 호출 여부, JSON body 전송 여부, 에러 전파를 테스트로 보장. 나중에 route 구현이 변경되더라도 회귀를 자동으로 감지 |
| `services/siw/` 내 파일만 변경 | engine은 다른 팀원 소유. 아키텍처 불변식(서비스 간 직접 수정 금지)을 지켜야 충돌 없이 독립 배포 가능 |

---

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

---

## 구현 계획

### Step 1. 테스트 먼저 작성 (TDD) ✅

**작성 위치**: 기존 컨벤션에 따라 `services/siw/tests/api/` 디렉토리

- `services/siw/tests/api/resumes-route.test.ts` (기존 파일에 신규 케이스 추가)
  - engine `/api/resume/parse` 를 fetch로 호출한다
  - resumeText 획득 후 upload + `/api/resume/questions JSON`을 Promise.all로 병렬 호출한다
  - engine `/parse` 422 응답 시 422를 반환한다
  - 응답에 `{ questions, resumeId }` 포함
- `services/siw/tests/api/resume-questions-route.test.ts` (기존 파일에 신규 케이스 추가)
  - engine `/api/resume/parse` 를 fetch로 호출한다
  - resumeText를 JSON body로 `/api/resume/questions` 에 전송한다
  - engine `/parse` 에러 시 상태 코드 전파
  - engine `/questions` 에러 시 상태 코드 전파

**테스트 실행기**: vitest (jest 아님, `npm test` = `vitest run`)

### Step 2. `resumes/route.ts` 수정 ✅

파일: `services/siw/src/app/api/resumes/route.ts`

**변경 내용**:
1. `import { parsePdf } from "@/lib/pdf-parser"` 제거
2. 로컬 parsePdf 호출 블록(`let resumeText = "" ... } catch`) 제거
3. engine `/api/resume/parse` fetch 추가 (FormData, AbortSignal.timeout(30000))
4. engine /parse 에러 시 `mapDetailToKey` 재사용, 상태 코드 전파
5. `Promise.all([uploadResumePdf, fetch /questions JSON])` 병렬화
6. `/questions` 호출을 FormData → JSON body(`{ resumeText }`)로 전환
7. catch에서 `err.status` 존재 시 해당 상태 코드 전파

**최종 핵심 흐름**:
```typescript
// 1. engine /parse
const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, { method: "POST", body: engineParseForm, ... })
const { resumeText } = await parseResp.json()

// 2. 병렬
const [storageKey, engineData] = await Promise.all([
  uploadResumePdf(user.id, buffer, file.name),
  fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resumeText }),
  }).then(async (r) => { /* 에러 처리 */ return r.json() }),
])

// 3. DB 저장
const resumeId = await resumeRepository.create({ ..., storageKey, resumeText, questions: engineData.questions ?? [] })
```

### Step 3. `resume/questions/route.ts` 수정 ✅

파일: `services/siw/src/app/api/resume/questions/route.ts`

**변경 내용**:
1. `import { parsePdf } from "@/lib/pdf-parser"` 제거
2. 로컬 parsePdf 호출 블록 제거
3. engine `/api/resume/parse` fetch 추가 (에러 처리 포함)
4. engineForm FormData 블록 제거
5. `/api/resume/questions` 호출을 JSON body(`{ resumeText }`)로 전환
6. 에러 처리: `mapDetailToKey` 재사용, 상태 코드 전파

**이 route는 DB 저장 없음** — 기존 동작 유지 (questions만 반환)

### Step 4. `pdf-parser.ts` 삭제 및 `pdf-parse` 패키지 제거 ✅

1. `services/siw/src/lib/pdf-parser.ts` 삭제 (`git rm`)
2. `services/siw/package.json`에서 `pdf-parse`, `@types/pdf-parse` 제거
3. `services/siw/next.config.ts`의 `serverExternalPackages`, `outputFileTracingIncludes`에서 `pdf-parse` 항목 제거
4. src/ 내 잔존 import 없음 확인: `grep -r "pdf-parser\|pdf-parse" src/` → 결과 없음
5. TypeScript 체크: `npx tsc --noEmit` → 에러 없음

### Step 5. `.ai.md` 최신화 ✅

`services/siw/.ai.md` 업데이트:
- 목적 섹션에 Issue #119 완료 기록 추가
- 구조 트리: `resume/questions/route.ts`, `resumes/route.ts` 설명 업데이트
- 기술 스택: `pdf-parse v2`, `serverExternalPackages` 항목 제거
- Issue #137 항목의 `#119에서 제거 예정` → `#119에서 삭제됨`으로 갱신
- 진행 상태: Issue #119 완료 항목 추가

---

## 검증 결과

```
Test Files: 24 passed (24)
Tests:      117 passed (117)
TypeScript: 에러 없음 (src/ 기준)
pdf-parser import 잔존: 없음
```

**변경 파일 목록** (services/siw/ 내부만):
- `src/app/api/resumes/route.ts` — engine /parse + Promise.all 전환
- `src/app/api/resume/questions/route.ts` — engine /parse + /questions JSON 전환
- `src/lib/pdf-parser.ts` — 삭제
- `package.json` — pdf-parse 제거
- `next.config.ts` — serverExternalPackages/outputFileTracingIncludes에서 pdf-parse 제거
- `tests/api/resumes-route.test.ts` — 신규 TDD 케이스 추가
- `tests/api/resume-questions-route.test.ts` — 신규 TDD 케이스 추가
- `.ai.md` — 최신화
