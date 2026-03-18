# [#127] feat: services/seung Phase 3 — 서류 강점·약점 진단 구현 (기능 02) — 구현 계획

> 작성: 2026-03-17

---

## 완료 기준

- [x] `lib/types.ts`에 `FeedbackScores`, `SuggestionItem`, `ResumeFeedbackResponse` 타입 추가
- [x] `Resume` Prisma 모델에 `diagnosisResult Json?` 추가 + `prisma migrate dev`
- [x] `POST /api/resume/feedback` 라우트: `{ resumeId, targetRole }` → DB에서 `resumeText` 조회 → 엔진 포워딩 (`AbortSignal.timeout(40_000)`) → 결과 DB 저장(덮어쓰기) 후 반환
- [x] `GET /api/resume/diagnosis?resumeId=xxx` 라우트: DB 조회 후 반환, 없으면 404
- [x] `/resume` 페이지: "면접 시작하기 / 서류 진단받기" 브랜칭 카드 UX로 구현 (초기 계획의 "섹션 추가" 방식에서 변경)
- [x] `/diagnosis` 페이지: `resumeId` 없거나 404 시 `/resume` redirect, 5개 항목 점수·강점·약점·개선 방향·"홈으로" 버튼 표시
- [x] Vitest 단위 + Playwright E2E 테스트 전체 통과 (기존 회귀 없음 포함)
- [x] `services/seung/.ai.md` 최신화

---

## 구현 계획

> 원칙: TDD (Red → Green → Refactor). 각 단계에서 테스트 먼저 작성 후 구현.
> 불변식: 엔진 직접 수정 금지. LLM 호출은 엔진 경유만.

### 전체 흐름 요약

```
── 기반 준비 ──────────────────────────────────────────────────────────
Step 1  타입 정의       엔진 응답 스펙과 1:1 대응하는 TS 타입 3개 작성
Step 2  DB 스키마       Resume 모델에 diagnosisResult Json? 컬럼 추가 + 마이그레이션
Step 3  기존 테스트 보호  스키마 변경으로 깨질 수 있는 mock 3곳 선제적으로 수정

── 서버 구현 ──────────────────────────────────────────────────────────
Step 4  진단 요청 API   resumeId → DB에서 resumeText 조회 → 엔진 포워딩 → 결과 저장
Step 5  진단 조회 API   저장된 diagnosisResult 반환 (미진단이면 404)

── 화면 구현 ──────────────────────────────────────────────────────────
Step 6  /resume 수정    "🎤 면접 시작하기 / 📋 서류 진단받기" 브랜칭 카드 UX 추가
Step 7  /diagnosis 신규  5개 항목 점수·강점·약점·개선 방향을 보여주는 결과 페이지

── 검증 · 마무리 ───────────────────────────────────────────────────────
Step 8  E2E 테스트      API 모킹 8케이스 + 실제 엔진 연동 1케이스 (영상 녹화)
Step 9  .ai.md 최신화   신규 라우트·페이지·테스트 반영
```

---

### Step 1 — 타입 정의 (`lib/types.ts`)

**파일:** `services/seung/src/lib/types.ts`

추가할 타입:

```ts
export type FeedbackScores = {
  specificity: number
  achievementClarity: number
  logicStructure: number
  roleAlignment: number
  differentiation: number
}

export type SuggestionItem = {
  section: string
  issue: string
  suggestion: string
}

export type ResumeFeedbackResponse = {
  scores: FeedbackScores
  strengths: string[]
  weaknesses: string[]
  suggestions: SuggestionItem[]
}
```

엔진 계약(`engine/.ai.md`)의 `/api/resume/feedback` 응답 스펙과 1:1 대응.

---

### Step 2 — Prisma 스키마 변경 + 마이그레이션

**파일:** `services/seung/prisma/schema.prisma`

`Resume` 모델에 필드 추가:
```prisma
model Resume {
  ...
  diagnosisResult Json?
}
```

마이그레이션:
```bash
cd services/seung && npx prisma migrate dev --name add_diagnosis_result
```

**주의:** `questions.test.ts`의 `mockPrisma.resume.create` 반환 객체에 `diagnosisResult: null` 추가 필요 (Step 3에서 처리).

---

### Step 3 — 기존 테스트 mock 수정

**파일:** `services/seung/tests/api/questions.test.ts`

`mockPrisma.resume.create.mockResolvedValueOnce({ id: 'resume-xxx' })` → `{ id: 'resume-xxx', diagnosisResult: null }` 로 변경 (총 3곳).

목적: Prisma 스키마 변경 후 타입 불일치로 인한 기존 테스트 파손 방지.

---

### Step 4 — `POST /api/resume/feedback` API 라우트 (TDD)

**파일:**
- 테스트: `services/seung/tests/api/resume-feedback.test.ts` (신규)
- 구현: `services/seung/src/app/api/resume/feedback/route.ts` (신규)

#### 4-1. 테스트 케이스 (Red)

| 케이스 | 예상 응답 |
|--------|---------|
| resumeId 없음 | 400 |
| targetRole 빈 문자열 | 400 |
| Resume DB 조회 실패 (없는 id) | 404 |
| 엔진 200 성공 → DB update 후 결과 반환 | 200 + `ResumeFeedbackResponse` |
| 엔진 400/500 에러 | 에러 상태 그대로 전달 |
| fetch 자체 실패 | 500 |
| AbortSignal.timeout(40_000) 설정 확인 | (fetch 호출 인자 검증) |

#### 4-2. 구현 로직

```
요청: POST { resumeId, targetRole }
1. resumeId / targetRole 검증 (없거나 빈 값 → 400)
2. prisma.resume.findUnique({ where: { id: resumeId } }) → 없으면 404
3. ENGINE_BASE_URL + /api/resume/feedback 로 fetch
   body: { resumeText: resume.resumeText, targetRole }
   signal: AbortSignal.timeout(40_000)
4. 엔진 응답 !ok → 에러 상태 그대로 반환
5. 결과를 prisma.resume.update({ where: { id: resumeId }, data: { diagnosisResult: result } })
6. 200 + result 반환
```

mock 구조 (`vi.hoisted`):
```ts
mockPrisma.resume.findUnique  // Resume 조회
mockPrisma.resume.update      // diagnosisResult 저장
mockFetch                     // 엔진 호출
```

---

### Step 5 — `GET /api/resume/diagnosis` API 라우트 (TDD)

**파일:**
- 테스트: `services/seung/tests/api/resume-diagnosis.test.ts` (신규)
- 구현: `services/seung/src/app/api/resume/diagnosis/route.ts` (신규)

#### 5-1. 테스트 케이스 (Red)

| 케이스 | 예상 응답 |
|--------|---------|
| resumeId 쿼리 파라미터 없음 | 400 |
| Resume 없는 id | 404 |
| Resume 있지만 diagnosisResult null | 404 (`{ error: '진단 결과가 없습니다.' }`) |
| Resume + diagnosisResult 있음 | 200 + `ResumeFeedbackResponse` |

#### 5-2. 구현 로직

```
요청: GET ?resumeId=xxx
1. resumeId 없으면 400
2. prisma.resume.findUnique({ where: { id: resumeId } }) → 없으면 404
3. resume.diagnosisResult 없으면 404
4. 200 + diagnosisResult 반환
```

---

### Step 6 — `/resume` 페이지 수정

**파일:** `services/seung/src/app/resume/page.tsx`

> ⚠️ 계획 변경: 초기 계획(면접 시작 버튼 아래 진단 섹션 추가)에서 **브랜칭 카드 UX**로 변경.
> 이유: 질문 생성 직후 면접/진단 두 기능이 동등하게 제안되는 UX가 더 자연스럽다는 판단.

**실제 구현:**

`state === 'done'` + `result.resumeId` 가 있을 때, "🎤 면접 시작하기 / 📋 서류 진단받기" 카드 2개를 가로 배치.
카드 클릭 시 해당 세부 UI가 카드 아래에 확장:

- **면접 시작하기** 선택 → 실전/연습 모드 선택 UI + "확인" 버튼
- **서류 진단받기** 선택 → `targetRole` 입력 필드 + "진단하기" 버튼

```
[🎤 면접 시작하기]  [📋 서류 진단받기]
─────────────────────────────────────
(선택된 카드에 따라 세부 UI 확장)
```

추가 상태:
```ts
const [selectedAction, setSelectedAction] = useState<'interview' | 'diagnosis' | null>(null)
const [targetRole, setTargetRole] = useState('')
const [isDiagnosing, setIsDiagnosing] = useState(false)
const [diagnosisError, setDiagnosisError] = useState('')
```

---

### Step 7 — `/diagnosis` 페이지 신규 생성

**파일:** `services/seung/src/app/diagnosis/page.tsx` (신규)

`/report/page.tsx` 패턴 동일하게 `Suspense` 래퍼 + `DiagnosisContent` 분리.

#### 화면 구성 (report 페이지 스타일 일관성 유지):

```
헤더: MirAI — 서류 강점·약점 진단

1. 5개 점수 섹션 (프로그레스 바)
   - 서술의 구체성 (specificity)
   - 성과 수치 명확성 (achievementClarity)
   - 논리 구조 (logicStructure)
   - 직무 적합성 (roleAlignment)
   - 차별성 (differentiation)

2. 강점 섹션 (strengths 리스트, 파란 계열)

3. 약점 섹션 (weaknesses 리스트, 주황 계열)

4. 개선 방향 섹션 (suggestions 카드)
   - section / issue / suggestion 3줄 구조

5. "홈으로" 버튼 → /resume
```

#### 로직:

```
1. useSearchParams()로 resumeId 추출
2. resumeId 없으면 router.replace('/resume')
3. GET /api/resume/diagnosis?resumeId=xxx
   - 404/에러 → router.replace('/resume')
   - 200 → setDiagnosis(data)
4. loading 중: 로딩 스크린
```

점수 레이블 맵:
```ts
const SCORE_LABEL_MAP = {
  specificity: '서술의 구체성',
  achievementClarity: '성과 수치 명확성',
  logicStructure: '논리 구조',
  roleAlignment: '직무 적합성',
  differentiation: '차별성',
}
```

점수 색상: 70 이상 → 파란 계열, 미만 → 주황 계열 (report 페이지와 동일한 시각적 언어).

---

### Step 8 — Playwright E2E 테스트

**파일:** `services/seung/tests/e2e/diagnosis-flow.spec.ts` (신규)

#### 테스트 시나리오:

```
[mock 서버 또는 실제 서버]

1. /resume 페이지 진입
2. PDF 업로드 → 질문 목록 로드 (기존 upload-flow 패턴 재사용)
3. resumeId 있을 때 진단 섹션 노출 확인
4. targetRole 입력 → "진단하기" 버튼 활성화 확인
5. "진단하기" 클릭 → /diagnosis?resumeId=xxx 이동 확인
6. /diagnosis 페이지에서 5개 점수 섹션, 강점, 약점, 개선 방향 섹션 노출 확인
7. "홈으로" 버튼 → /resume 이동 확인
8. /diagnosis?resumeId= 없이 진입 시 /resume redirect 확인
```

기존 `upload-flow.spec.ts` 패턴을 참고하여 mock fetch 활용.

---

### Step 9 — `.ai.md` 최신화

**파일:** `services/seung/.ai.md`

기능 02 (서류 강점·약점 진단) 관련 내용 추가:
- 신규 API 라우트: `POST /api/resume/feedback`, `GET /api/resume/diagnosis`
- 신규 페이지: `/diagnosis`
- Prisma `Resume` 모델 `diagnosisResult` 필드 추가 이력

---

## 실행 순서 요약

```
Step 1  lib/types.ts 타입 추가
Step 2  Prisma 스키마 변경 + 마이그레이션
Step 3  questions.test.ts mock 수정
Step 4  POST /api/resume/feedback (테스트 → 구현)
Step 5  GET /api/resume/diagnosis (테스트 → 구현)
Step 6  /resume 페이지 진단 섹션 추가
Step 7  /diagnosis 페이지 신규 생성
Step 8  Playwright E2E 테스트
Step 9  .ai.md 최신화
```

---

## 주의사항 / 엣지 케이스

| 항목 | 처리 방법 |
|------|---------|
| 엔진 timeout (30s 내부) | 서비스에서 `AbortSignal.timeout(40_000)` — 엔진보다 10s 여유 |
| 재진단 | `prisma.resume.update`로 `diagnosisResult` 덮어쓰기 (upsert 아님) |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 API route에서만 사용, `NEXT_PUBLIC_` 접두어 절대 금지 |
| 엔진 `ResumeFeedbackParseError` (500) | 서비스에서 500 그대로 전달, 유저에게 재시도 안내 |
| diagnosisResult null인 Resume | `GET /api/resume/diagnosis` → 404 반환 (진단 미실시) |
| /diagnosis 직접 진입 (resumeId 없음) | `router.replace('/resume')` redirect |
