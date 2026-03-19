# [#140] feat: [siw] 이력서 피드백 기능 실데이터 연동 — engine /resume/feedback + inferredTargetRole 저장 (#90·#113 기반) — 구현 계획

> 작성: 2026-03-19

---

## 완료 기준

- [ ] `Resume` 모델에 `feedbackJson Json?`, `inferredTargetRole String?` 컬럼 추가 + 마이그레이션 SQL
- [ ] `POST /api/resumes`: 업로드 후 엔진 `/api/resume/feedback` 호출 → `feedbackJson` DB 저장 (inferredTargetRole → targetRole 자동 사용)
- [ ] `GET /api/resumes/[id]/feedback`: 저장된 `feedbackJson` 반환 (현재 null 고정 → 실데이터)
- [ ] `ResumeFeedback`, `ResumeFeedbackScores`, `SuggestionItem` 타입을 `src/lib/types.ts`로 이동 (page.tsx 로컬 정의 제거)
- [ ] 기존 응답 형식 유지 (UI 변경 없음 — 이미 완성된 UI 그대로 동작)
- [ ] 테스트 추가 (feedback route GET 200/401/404, POST /api/resumes feedback 저장 검증)
- [ ] `services/siw/.ai.md` 최신화

---

## 구현 계획

> 팀 검증 완료 (2026-03-19): 아키텍트·TDD 엔지니어·풀스택 3인 교차 검증
> 근거 문서: `02_engine_contract.md` (engine API 계약), `03_tdd_tests.md` (TDD 테스트 코드)

### 검증 완료 사항

| 검증 항목 | 결과 |
|----------|------|
| engine ResumeFeedbackScores 필드명 | specificity, achievementClarity, logicStructure, roleAlignment, differentiation ✅ |
| engine SuggestionItem 필드명 | section, issue, suggestion (**category 아님**) ✅ |
| page.tsx 타입과 engine 스키마 일치 | 완전 일치 ✅ |
| targetRole "소프트웨어 개발자" fallback 유효성 | min_length=1 충족 ✅ |
| inferredTargetRole 엔진 응답 포함 여부 | **없음** — #113 미머지, null 저장 ✅ |
| 기존 테스트 호환성 | 3번째 fetch mock 없어도 `.catch(() => null)` 처리 ✅ |
| maxDuration=60s 준수 | 병렬화로 안전 ✅ |

---

### Step 1. Prisma 스키마 + 마이그레이션

**변경 파일:**
- `services/siw/prisma/schema.prisma`
- `services/siw/prisma/migrations/20260319000001_add_resume_feedback_columns/migration.sql` (신규)

**schema.prisma 수정 (Resume 모델):**
```prisma
// Before
model Resume {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String
  fileName    String
  storageKey  String
  resumeText  String
  questions   Json     @default("[]")
  createdAt   DateTime @default(now())
  interviewSessions InterviewSession[]
  @@index([userId])
  @@map("resumes")
}

// After
model Resume {
  id                 String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId             String
  fileName           String
  storageKey         String
  resumeText         String
  questions          Json     @default("[]")
  feedbackJson       Json?
  inferredTargetRole String?
  createdAt          DateTime @default(now())
  interviewSessions  InterviewSession[]
  @@index([userId])
  @@map("resumes")
}
```

**migration.sql:**
```sql
-- AlterTable
ALTER TABLE "resumes" ADD COLUMN "feedbackJson" JSONB;
ALTER TABLE "resumes" ADD COLUMN "inferredTargetRole" TEXT;
```

**AC:** `npx prisma validate` 통과. migration SQL 파일 존재. 기존 데이터 안전 (nullable 컬럼).

---

### Step 2. resume-repository.ts 확장

**변경 파일:** `services/siw/src/lib/resume-repository.ts`

**Before → After:**
```ts
// Before
export type ResumeRecord = {
  id: string;
  userId: string;
  fileName: string;
  storageKey: string;
  resumeText: string;
  questions: Prisma.JsonValue;
  createdAt: Date;
};

// After
export type ResumeRecord = {
  id: string;
  userId: string;
  fileName: string;
  storageKey: string;
  resumeText: string;
  questions: Prisma.JsonValue;
  feedbackJson: Prisma.JsonValue | null;
  inferredTargetRole: string | null;
  createdAt: Date;
};
```

```ts
// create() 파라미터 Before
async create(data: {
  userId: string;
  fileName: string;
  storageKey: string;
  resumeText: string;
  questions: Prisma.InputJsonValue;
}): Promise<string>

// create() 파라미터 After
async create(data: {
  userId: string;
  fileName: string;
  storageKey: string;
  resumeText: string;
  questions: Prisma.InputJsonValue;
  feedbackJson?: Prisma.InputJsonValue | null;
  inferredTargetRole?: string | null;
}): Promise<string>
```

> `findDetailById()` — select clause 없으므로 Prisma 스키마 변경 후 feedbackJson 자동 포함. **수정 불필요**.

**AC:** 기존 `create()` 호출 깨지지 않음 (optional 파라미터). `tsc --noEmit` 통과.

---

### Step 3. POST /api/resumes — feedback 병렬 호출

**변경 파일:** `services/siw/src/app/api/resumes/route.ts`

**핵심 변경 — Promise.all 확장:**
```ts
// formData에서 targetRole 읽기 (있으면 사용, 없으면 fallback)
const targetRole = (formData.get("targetRole") as string | null) ?? "소프트웨어 개발자"

try {
  const [storageKey, engineData, feedbackJson] = await Promise.all([
    uploadResumePdf(user.id, buffer, file.name),
    fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText }),
      signal: AbortSignal.timeout(30000),
    }).then(async (r) => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({ detail: "" }))
        const key = mapDetailToKey(body.detail ?? "", r.status)
        throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: r.status, key })
      }
      return r.json()
    }),
    // best-effort: 실패해도 업로드/questions 성공 처리
    fetch(`${ENGINE_BASE_URL}/api/resume/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resumeText, targetRole }),
      signal: AbortSignal.timeout(35000), // engine 30s + 5s 여유 (아키텍트 권고)
    }).then(r => r.ok ? r.json() : null).catch(() => null),
  ])

  const resumeId = await resumeRepository.create({
    userId: user.id,
    fileName: file.name,
    storageKey,
    resumeText,
    questions: engineData.questions ?? [],
    feedbackJson: feedbackJson ?? null,
    // inferredTargetRole: engine /feedback 응답에 없음 (#113 머지 후 연동 예정)
  })

  return NextResponse.json({ ...engineData, resumeId })
} catch (err) {
  // 기존 에러 처리 패턴 유지
  if (err instanceof Error && 'status' in err) {
    return NextResponse.json({ message: err.message }, { status: (err as { status: number }).status })
  }
  console.error("[POST /api/resumes] error:", err instanceof Error ? err.message : String(err))
  return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 })
}
```

> **기존 테스트 호환성:** 기존 테스트는 parse·questions 2개 fetch만 mock. feedback 3번째 호출 시 `vi.fn()` 기본값 undefined → `.then(r => r.ok ...)` throw → `.catch(() => null)` 처리 → feedbackJson=null. **기존 테스트 깨지지 않음.**

**AC:** feedback 실패 시에도 POST 200. maxDuration=60s 내 완료. 응답 형식 `{ questions, resumeId }` 유지.

---

### Step 4. GET /api/resumes/[id]/feedback

**변경 파일:** `services/siw/src/app/api/resumes/[id]/feedback/route.ts`

**전체 파일 교체:**
```ts
import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { resumeRepository } from "@/lib/resume-repository"
import { cookies } from "next/headers"

export const runtime = "nodejs"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const { id } = await params
  try {
    const resume = await resumeRepository.findDetailById(id, user.id)
    return NextResponse.json(resume.feedbackJson ?? null)
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }
}
```

**AC:** 없는 resume → 404. 타인 resume → 404. feedbackJson=null → 200+null. feedbackJson 있음 → 200+JSON.

---

### Step 5. types.ts 타입 이동 + page.tsx import 정리 + .ai.md 최신화

**변경 파일:**
- `services/siw/src/lib/types.ts`
- `services/siw/src/app/(app)/resumes/[id]/page.tsx`
- `services/siw/.ai.md`

**types.ts에 추가할 타입 (engine 스키마 완전 일치):**
```ts
// 이력서 피드백 타입 (engine ResumeFeedbackResponse와 완전 일치)
export type ResumeFeedbackScores = {
  specificity: number        // 경험·사례의 구체성
  achievementClarity: number // 성과의 명확성
  logicStructure: number     // 논리 구조
  roleAlignment: number      // 직무 연관성
  differentiation: number    // 차별화
}

export type SuggestionItem = {
  section: string     // ← "category" 아님 (engine: section)
  issue: string
  suggestion: string
}

export type ResumeFeedback = {
  scores: ResumeFeedbackScores
  strengths: string[]
  weaknesses: string[]
  suggestions: SuggestionItem[]
}
```

**page.tsx 변경:**
```ts
// 제거할 로컬 정의 (lines 12-35 근방)
// type ResumeFeedbackScores = { ... }  ← 삭제
// type SuggestionItem = { ... }        ← 삭제
// type ResumeFeedback = { ... }        ← 삭제

// 추가할 import
import type { ResumeFeedback, ResumeFeedbackScores, SuggestionItem } from "@/lib/types"
```

> `SCORE_LABELS` 상수는 page.tsx에 그대로 유지 (UI 표시용, types.ts 이동 불필요)

---

### 테스트 계획 (8개 케이스, TDD Red-Green-Refactor)

> 전체 테스트 코드: `docs/work/active/000140-siw-resume-feedback/03_tdd_tests.md` 참조

**실행 명령:**
```bash
cd services/siw
npx vitest run tests/api/resume-feedback-route.test.ts  # 신규
npx vitest run tests/api/resumes-route.test.ts           # 기존 확장
npm test  # 전체
```

| # | 파일 | 케이스 | RED 조건 | GREEN 구현 |
|---|------|--------|----------|------------|
| 1 | resume-feedback-route.test.ts | GET 200 — feedbackJson 반환 | null 고정 반환 | `resume.feedbackJson ?? null` |
| 2 | resume-feedback-route.test.ts | GET 200+null — feedbackJson=null | null이지만 이미 null → 타입 문제 | Prisma 스키마 + 타입 업데이트 |
| 3 | resume-feedback-route.test.ts | GET 401 — 미인증 | import 오류 | 라우트 구현 |
| 4 | resume-feedback-route.test.ts | GET 404 — resume 없음 | catch에서 null 반환 | catch → 404 변경 |
| 5 | resumes-route.test.ts | POST: /feedback URL 호출 검증 | feedback fetch 없음 | Promise.all에 feedback 추가 |
| 6 | resumes-route.test.ts | POST: create()에 feedbackJson 포함 | create()에 feedbackJson 없음 | create() 파라미터 확장 |
| 7 | resumes-route.test.ts | POST: feedback reject → null, 200 | Promise.all 전체 reject | `.catch(() => null)` 추가 |
| 8 | resumes-route.test.ts | POST: targetRole 전달 검증 | body에 targetRole 없음 | FormData에서 읽어 전달 |

---

### 변경 파일 전체 목록

| 파일 | 타입 | 주요 변경 |
|------|------|----------|
| `prisma/schema.prisma` | 수정 | feedbackJson Json?, inferredTargetRole String? 추가 |
| `prisma/migrations/20260319000001_.../migration.sql` | 신규 | ALTER TABLE resumes ADD COLUMN x2 |
| `src/lib/resume-repository.ts` | 수정 | ResumeRecord 필드 추가, create() 파라미터 확장 |
| `src/app/api/resumes/route.ts` | 수정 | Promise.all에 feedback 병렬 추가, targetRole FormData 읽기 |
| `src/app/api/resumes/[id]/feedback/route.ts` | 수정 | null 고정 → feedbackJson 반환, 404 처리 |
| `src/lib/types.ts` | 수정 | ResumeFeedback 타입 3개 추가 |
| `src/app/(app)/resumes/[id]/page.tsx` | 수정 | 로컬 타입 제거, types.ts import |
| `tests/api/resume-feedback-route.test.ts` | 신규 | GET feedback 4개 테스트 |
| `tests/api/resumes-route.test.ts` | 수정 | POST feedback 4개 테스트 추가 |
| `services/siw/.ai.md` | 수정 | feedbackJson 컬럼·연동 내역 반영 |

---

### ADR

**Decision:** feedback을 기존 `Promise.all`에 병렬 추가, create() 시 단일 DB 쓰기

**Drivers:**
1. maxDuration=60s 제약 — 순차 호출 시 90s 초과 위험
2. 단순성 — updateFeedback 별도 메서드 불필요
3. 실패 격리 — feedback 실패가 resume 생성 차단 없음

**Alternatives considered:**
- (A) create 후 순차 feedback 호출: 90s 초과 위험 → **기각**
- (B) Background job 비동기 처리: serverless 환경 불안정 → **기각**

**Consequences:**
- feedbackJson=null인 resume 존재 가능 (엔진 실패 시) — UI 이미 null 처리
- targetRole FormData 파라미터 추가 시 기존 upload 호출 변경 불필요 (optional)

**Follow-ups:**
- #113 inferredTargetRole 엔진 머지 후 연동
- feedback 재시도 메커니즘 — 별도 이슈
