# feat: [seung] UX 소개선 — 리포트 생성 안내 · 타임아웃 메시지 · 자소서 파일명 표시

## 사용자 관점 목표

면접 중 리포트를 언제 생성할 수 있는지 알 수 있고, 서버 응답이 느릴 때 기다려야 하는지 판단할 수 있으며, 지금 어떤 자소서로 면접 중인지 확인할 수 있다.

## 배경

세 가지 소소하지만 사용자가 자주 마주치는 불편 사항이 있다.

1. **리포트 생성 시점 불명확**: 5개 미만 답변 시 리포트 버튼 자체가 없어 사용자가 왜 없는지 모름
2. **타임아웃 에러 구분 없음**: LLM 응답 지연 시 일반 서버 오류와 동일한 메시지 표시
3. **현재 자소서 불명확**: 면접 페이지에 어떤 자소서로 진행 중인지 파일명이 안 보임

**작업 위치:** `services/seung`

## 완료 기준

- [x] 5개 미만 답변 시 "리포트는 5개 이상 답변 후 생성할 수 있습니다" 안내 표시
- [x] 타임아웃(504) 발생 시 "응답이 지연되고 있습니다. 다시 시도해주세요." 메시지 표시
- [x] 면접 페이지 상단에 현재 자소서 파일명 표시

## 구현 플랜

### 1. 리포트 생성 안내 (`src/components/InterviewChat.tsx`)

`answerCount < 5`일 때 버튼 위치(line 180 근처)에 안내 문구 추가:

```tsx
{!sessionComplete && answerCount < 5 && (
  <p className="text-xs text-gray-400 text-center">
    리포트는 5개 이상 답변 후 생성할 수 있습니다
  </p>
)}
```

### 2. 타임아웃 에러 구분

**서버 API 라우트** (`interview/answer`, `resume/questions`, `report/generate`, `resume/feedback`)의 엔진 호출 catch 블록에서 `TimeoutError` 감지 → 504 반환:

```ts
} catch (err) {
  if ((err as { name?: string }).name === 'TimeoutError') {  // DOMException은 instanceof Error 불통과 → name만 체크
    return NextResponse.json({ error: '응답이 지연되고 있습니다. 다시 시도해주세요.' }, { status: 504 })
  }
  return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
}
```

**클라이언트** (`src/lib/types.ts`) ERROR_MESSAGES에 504 추가:

```ts
export const ERROR_MESSAGES: Record<number, string> = {
  // 기존...
  504: '응답이 지연되고 있습니다. 다시 시도해주세요.',
}
```

### 3. 자소서 파일명 표시

**`src/app/api/interview/session/route.ts`** — resume join 추가:

```ts
session = await prisma.interviewSession.findUnique({
  where: { id: sessionId },
  select: {
    // 기존 필드들...
    resume: { select: { fileName: true } },
  },
})
```

응답에 `fileName` 추가:
```ts
return NextResponse.json({
  // 기존 필드들...
  fileName: session.resume?.fileName ?? null,
})
```

**`src/app/interview/page.tsx`** — 헤더에 파일명 표시:

```tsx
{data.fileName && (
  <p className="text-xs text-gray-400">{data.fileName}</p>
)}
```

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `src/components/InterviewChat.tsx` | 리포트 생성 안내 문구 추가 |
| `src/app/api/interview/session/route.ts` | resume join + fileName 응답 추가 |
| `src/app/interview/page.tsx` | 헤더 파일명 표시 |
| `src/app/api/interview/answer/route.ts` | TimeoutError → 504 처리 |
| `src/app/api/resume/questions/route.ts` | TimeoutError → 504 처리 |
| `src/app/api/report/generate/route.ts` | TimeoutError → 504 처리 |
| `src/app/api/resume/feedback/route.ts` | TimeoutError → 504 처리 |
| `src/lib/types.ts` | ERROR_MESSAGES에 504 추가 |

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음


---

## 작업 내역

### AC1 — 리포트 생성 안내 문구 (`InterviewChat.tsx`)

`answerCount < 5 && !sessionComplete && interviewMode !== 'practice'` 조건으로 안내 문구를 추가했다. practice 모드에는 리포트 기능이 없으므로 해당 조건을 배제했다. 기존 `answerCount >= 5` 리포트 버튼 로직과 대칭 구조를 유지했다.

### AC2 — 타임아웃(504) 에러 구분 (4개 라우트, 5개 catch 블록)

`AbortSignal.timeout()` 초과 시 Node.js가 던지는 `DOMException { name: 'TimeoutError' }`를 감지해 504를 반환하도록 각 라우트의 엔진 fetch catch 블록을 수정했다. `instanceof Error` 체크가 vitest Node.js 환경에서 `DOMException`을 통과시키지 못하는 문제로 인해 `(err as { name?: string }).name === 'TimeoutError'` 방식으로 구현했다. `src/lib/types.ts`의 `ERROR_MESSAGES`에도 504를 추가해 업로드 흐름과 일관성을 맞췄다.

공통 패턴을 shared fetchEngine wrapper로 추출하는 리팩터링은 후속 이슈로 트래킹한다 (각 catch 블록에 TODO 주석으로 표시).

### AC3 — 면접 페이지 자소서 파일명 표시

`interview/session` GET API에서 Prisma `select`에 `resume: { select: { fileName: true } }` join을 추가하고 `fileName`을 응답에 포함시켰다. `interview/page.tsx`에서는 `fileName` state를 추가해 fetch 응답에서 세팅하고, 헤더에서 null 시 미표시하도록 조건부 렌더링했다. 구 데이터(resume 없는 세션)와의 하위 호환성을 위해 nullable 처리를 유지했다.

