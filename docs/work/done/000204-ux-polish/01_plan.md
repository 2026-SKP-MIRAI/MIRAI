# [#204] feat: [seung] UX 소개선 — 리포트 생성 안내 · 타임아웃 메시지 · 자소서 파일명 표시 — 구현 계획

> 작성: 2026-03-23
> 검토: Planner → Architect → Critic (APPROVE)

---

## 완료 기준

- [x] 5개 미만 답변 시 "리포트는 5개 이상 답변 후 생성할 수 있습니다" 안내 표시
- [x] 타임아웃(504) 발생 시 "응답이 지연되고 있습니다. 다시 시도해주세요." 메시지 표시
- [x] 면접 페이지 상단에 현재 자소서 파일명 표시

---

## 구현 계획

### Step 1. 리포트 생성 안내 문구 (AC1)

**파일:** `services/seung/src/components/InterviewChat.tsx`

line 180 근처에 기존 리포트 버튼 조건부(`answerCount >= 5`) 바로 앞/아래에 추가:

```tsx
{!sessionComplete && answerCount < 5 && (
  <p className="text-xs text-gray-400 text-center">
    리포트는 5개 이상 답변 후 생성할 수 있습니다
  </p>
)}
```

- `answerCount`는 line 55에서 이미 계산됨: `messages.filter((m) => m.type === 'answer').length`
- 순수 UI 추가, 기존 로직 변경 없음

---

### Step 2. 타임아웃(504) 에러 구분 (AC2)

**원칙:** `AbortSignal.timeout()` 초과 시 Node 18+에서 `DOMException { name: 'TimeoutError' }` throw됨.
각 라우트의 **엔진 fetch catch 블록**에 다음 분기 추가:

```ts
} catch (err) {
  // TODO: extract to shared fetchEngine wrapper (후속 이슈로 트래킹)
  if ((err as { name?: string }).name === 'TimeoutError') {  // DOMException은 instanceof Error 불통과 → name만 체크
    return NextResponse.json(
      { error: '응답이 지연되고 있습니다. 다시 시도해주세요.' },
      { status: 504 }
    )
  }
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}
```

**수정 대상 catch 블록 (총 5개):**

| 파일 | catch 위치 |
|------|-----------|
| `src/app/api/interview/answer/route.ts` | line ~106 (AbortSignal.timeout(55_000)) |
| `src/app/api/resume/questions/route.ts` | line ~35 (`callEngineAnalyze`) |
| `src/app/api/resume/questions/route.ts` | line ~88 (`callEngineQuestions`) — **2개 catch** |
| `src/app/api/report/generate/route.ts` | line ~94 (AbortSignal.timeout(90_000)) |
| `src/app/api/resume/feedback/route.ts` | line ~62 (AbortSignal.timeout(40_000)) |

> ⚠️ `resume/questions`는 engine-client 호출이 2개 → catch 블록 **2곳** 모두 수정

**클라이언트 에러 처리:**
- 기존 `interview/page.tsx`는 `data?.error`를 직접 읽으므로 서버가 body에 메시지를 포함하면 자동 표시됨
- `src/lib/types.ts` `ERROR_MESSAGES`에 504 추가 (resume 업로드 흐름 일관성):

```ts
export const ERROR_MESSAGES: Record<number, string> = {
  // 기존...
  504: '응답이 지연되고 있습니다. 다시 시도해주세요.',
}
```

---

### Step 3. 자소서 파일명 표시 (AC3)

**3-1. API 라우트 수정:** `src/app/api/interview/session/route.ts`

현재 `select`에 resume join 추가:

```ts
session = await prisma.interviewSession.findUnique({
  where: { id: sessionId },
  select: {
    // 기존 필드들...
    resume: { select: { fileName: true } },
  },
})
```

응답에 `fileName` 포함:

```ts
return NextResponse.json({
  // 기존 필드들...
  fileName: session.resume?.fileName ?? null,  // String? nullable 처리
})
```

**3-2. 면접 페이지 헤더:** `src/app/interview/page.tsx` (line 255–278)

```tsx
{data.fileName && (
  <p className="text-xs text-gray-400">{data.fileName}</p>
)}
```

> `fileName`이 null인 경우 렌더링하지 않음 (구 데이터 호환)

---

### Step 4. 테스트

각 AC별 테스트 추가 (vitest + React Testing Library 패턴 준수):

| 테스트 대상 | 케이스 |
|-----------|------|
| `InterviewChat.tsx` | `answerCount < 5`일 때 안내 문구 표시 |
| `InterviewChat.tsx` | `answerCount >= 5`일 때 안내 문구 미표시 |
| `InterviewChat.tsx` | `sessionComplete=true`일 때 안내 문구 미표시 |
| `interview/answer/route.ts` | TimeoutError → 504 반환 |
| `interview/session/route.ts` | fileName 포함 응답 |
| `interview/session/route.ts` | fileName=null 응답 |
| `resume/questions/route.ts` | callEngineAnalyze TimeoutError → 504 |
| `resume/questions/route.ts` | callEngineQuestions TimeoutError → 504 |
| `report/generate/route.ts` | TimeoutError → 504 반환 |
| `resume/feedback/route.ts` | TimeoutError → 504 반환 |
| `interview/page.tsx` | fileName 헤더 표시/미표시 — Next.js App Router 훅(useRouter, useSearchParams) 모킹 복잡도로 단위 테스트 미작성. API 계층(interview/session)과 렌더링 조건 단순 구조로 충분한 커버리지 확보 |

---

### Step 5. `.ai.md` 최신화

작업 완료 후 `services/seung/.ai.md` 업데이트:
- 타임아웃 에러 처리 패턴 (`err.name === 'TimeoutError'` → 504) 추가
- InterviewChat 리포트 생성 안내 문구 기술

---

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/components/InterviewChat.tsx` | 리포트 생성 안내 문구 추가 |
| `src/app/api/interview/session/route.ts` | resume join + fileName 응답 추가 |
| `src/app/interview/page.tsx` | 헤더 파일명 표시 |
| `src/app/api/interview/answer/route.ts` | TimeoutError → 504 처리 |
| `src/app/api/resume/questions/route.ts` | TimeoutError → 504 처리 (2개 catch) |
| `src/app/api/report/generate/route.ts` | TimeoutError → 504 처리 |
| `src/app/api/resume/feedback/route.ts` | TimeoutError → 504 처리 |
| `src/lib/types.ts` | ERROR_MESSAGES에 504 추가 |
| `services/seung/.ai.md` | 변경 내역 최신화 |

---

## 주의사항

1. `resume/questions/route.ts`는 catch 블록이 2개 — 둘 다 수정
2. `fileName`은 `String?` (nullable) — null 시 표시 안 함
3. 클라이언트는 `data?.error` 직접 읽음 — 서버 body에 메시지 포함 필수
4. `ERROR_MESSAGES[504]` 추가는 resume 업로드 흐름 일관성용, 면접 흐름에는 직접 영향 없음
