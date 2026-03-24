# [#212] feat: [siw] 서비스 업그레이드 — 개선 제안 글씨 크기 조정 + 이력서 삭제 기능 — 구현 계획

> 작성: 2026-03-24 (3-에이전트 팀 플랜)

---

## 완료 기준

- [ ] `/resumes` 페이지 각 이력서 카드에 삭제 버튼이 표시되고, 확인 후 이력서가 삭제되어 목록에서 사라진다
- [ ] 삭제 API (`DELETE /api/resumes/[id]`)가 본인 이력서만 삭제 가능하고, 타인 이력서는 403을 반환한다
- [ ] `/resumes/[id]` 개선 제안 섹션의 section 제목(`text-[11px]`) · 본문(`text-xs`) 크기가 가독성 있게 커진다

---

## 구현 계획

> **구현 순서**: 백엔드(Step 1-2) → 프론트엔드(Step 3-4) → 테스트(Step 5) → 문서(Step 6)
> 각 Step은 독립적으로 구현 가능하되, Step 5(테스트)는 Step 1-2 완료 후 작성.

---

### Step 1: resumeRepository에 deleteById 추가

**파일**: `services/siw/src/lib/resume-repository.ts`

기존 `listByUserId` 메서드 아래에 추가:

```ts
async deleteById(id: string, userId: string): Promise<boolean> {
  const result = await prisma.resume.deleteMany({
    where: { id, userId },
  });
  return result.count > 0;
},
```

**설계 근거**:
- `deleteMany` with `{ id, userId }` — 단일 쿼리로 소유권 확인 + 삭제를 원자적으로 처리
- `findFirst` 후 `delete` 2-step 방식보다 race condition 없음
- `count > 0` 반환으로 caller가 404 vs 403 판단 가능
  - count === 0: 해당 userId로 일치하는 레코드 없음 → 404 (존재 자체 없거나 타인 소유)
  - NOTE: 보안상 타인 이력서와 존재하지 않는 이력서를 구분하지 않고 404로 통일 (정보 노출 방지)

---

### Step 2: DELETE /api/resumes/[id] 핸들러 추가

**파일**: `services/siw/src/app/api/resumes/[id]/route.ts`

기존 GET 핸들러 아래에 추가:

```ts
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const { id } = await params

  // 1. Supabase Storage에서 파일 삭제 (storageKey 조회 필요)
  let storageKey: string | null = null
  try {
    const resume = await resumeRepository.findDetailById(id, user.id)
    storageKey = resume.storageKey
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  // 2. Storage 파일 삭제 (bucket 환경변수 있을 때만)
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (bucket && storageKey) {
    const serviceClient = createServiceClient()
    await serviceClient.storage.from(bucket).remove([storageKey])
    // Storage 삭제 실패는 무시하고 DB 삭제 진행 (고아 파일 허용)
  }

  // 3. DB에서 삭제
  const deleted = await resumeRepository.deleteById(id, user.id)
  if (!deleted) {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  return NextResponse.json({ message: "삭제되었습니다." }, { status: 200 })
}
```

**추가 import** (파일 상단에):
```ts
import { createServiceClient } from "@/lib/supabase/server"
```

**설계 근거**:
- Storage 파일도 함께 삭제 → download route에서 `storageKey` 사용 확인됨 (orphan 파일 방지)
- Storage 삭제 실패는 soft-fail (스토리지 정책 변경, 이미 삭제된 파일 등 허용)
- 응답: 200 JSON (204 No Content 대신 — 클라이언트에서 메시지 확인 가능)
- 인증 없음 → 401, 본인 이력서 아님 → 404 (403 대신, 존재 여부 노출 방지)

> **AC 주의**: 이슈의 완료 기준은 "타인 이력서는 403"을 요구.
> 보안상 404가 더 안전하나, AC를 정확히 충족하려면 아래 대안 사용:
>
> ```ts
> // 대안: findFirst로 존재 확인 후 userId 비교하여 403 반환
> const resume = await prisma.resume.findUnique({ where: { id } })
> if (!resume) return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
> if (resume.userId !== user.id) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 })
> ```
>
> **권장**: AC 충족을 위해 403 명시적 반환 사용. `resumeRepository.findById(id)` (userId 없이)를 사용해 존재 확인 후 userId 비교.

**최종 DELETE 핸들러 (AC 충족 버전)**:

```ts
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const { id } = await params

  // 존재 확인 (userId 무관)
  let resume: Awaited<ReturnType<typeof resumeRepository.findById>>
  try {
    resume = await resumeRepository.findById(id)
  } catch {
    return NextResponse.json({ message: "이력서를 찾을 수 없습니다." }, { status: 404 })
  }

  // 소유권 확인
  if (resume.userId !== user.id) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 })
  }

  // Storage 파일 삭제
  const bucket = process.env.SUPABASE_STORAGE_BUCKET
  if (bucket) {
    const serviceClient = createServiceClient()
    await serviceClient.storage.from(bucket).remove([resume.storageKey])
  }

  // DB 삭제
  await resumeRepository.deleteById(id, user.id)

  return NextResponse.json({ message: "삭제되었습니다." }, { status: 200 })
}
```

---

### Step 3: resumes/page.tsx — 삭제 버튼 UI 추가

**파일**: `services/siw/src/app/(app)/resumes/page.tsx`

#### 3-1. Import 추가
```ts
// 기존: import { FileText, Plus } from "lucide-react"
import { FileText, Plus, Trash2 } from "lucide-react"
```

#### 3-2. State 추가 (기존 state 선언부 아래)
```ts
const [deletingId, setDeletingId] = useState<string | null>(null)
```

#### 3-3. 삭제 핸들러 추가 (useEffect 아래)
```ts
async function handleDelete(resumeId: string) {
  if (!window.confirm("이 이력서를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return
  setDeletingId(resumeId)
  try {
    const res = await fetch(`/api/resumes/${resumeId}`, { method: "DELETE" })
    if (!res.ok) throw new Error("삭제 실패")
    setResumes(prev => prev.filter(r => r.id !== resumeId))
  } catch {
    alert("삭제에 실패했습니다. 다시 시도해 주세요.")
  } finally {
    setDeletingId(null)
  }
}
```

#### 3-4. 삭제 버튼 추가 (이력서 카드 버튼 행 — 현재 line 90-104 영역)

기존 버튼 행:
```tsx
<div className="flex gap-2 mt-3">
  <Link href={`/resumes/${resume.id}`} ...>내용 보기 →</Link>
  <Link href={`/interview/new?resumeId=${resume.id}`} ...>이 이력서로 면접</Link>
</div>
```

변경 후:
```tsx
<div className="flex gap-2 mt-3 items-center">
  <Link href={`/resumes/${resume.id}`} ...>내용 보기 →</Link>
  <Link href={`/interview/new?resumeId=${resume.id}`} ...>이 이력서로 면접</Link>
  <button
    onClick={() => handleDelete(resume.id)}
    disabled={deletingId === resume.id}
    className="ml-auto flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
  >
    <Trash2 className="w-3.5 h-3.5" />
    {deletingId === resume.id ? "삭제 중..." : "삭제"}
  </button>
</div>
```

**설계 근거**:
- `window.confirm` 사용 — 간단한 확인으로 충분, 별도 모달 state 불필요
- `ml-auto`로 오른쪽 끝 배치 — 기존 버튼(내용보기, 면접)과 분리
- `deletingId` state로 삭제 중 버튼 비활성화

---

### Step 4: resumes/[id]/page.tsx — 개선 제안 폰트 크기 수정

**파일**: `services/siw/src/app/(app)/resumes/[id]/page.tsx`

**변경 위치**: line 244-247 (개선 제안 카드 내부)

현재:
```tsx
<div key={i} className="bg-amber-50 rounded-xl px-4 py-3.5 border border-amber-100">
  <p className="text-[11px] font-bold text-amber-700 mb-1">{sg.section}</p>
  <p className="text-xs text-gray-600 mb-1.5"><span className="font-semibold text-gray-700">문제: </span>{sg.issue}</p>
  <p className="text-xs text-gray-700 leading-relaxed"><span className="font-semibold">제안: </span>{sg.suggestion}</p>
</div>
```

변경 후:
```tsx
<div key={i} className="bg-amber-50 rounded-xl px-4 py-3.5 border border-amber-100">
  <p className="text-sm font-bold text-amber-700 mb-1">{sg.section}</p>
  <p className="text-sm text-gray-600 mb-1.5"><span className="font-semibold text-gray-700">문제: </span>{sg.issue}</p>
  <p className="text-sm text-gray-700 leading-relaxed"><span className="font-semibold">제안: </span>{sg.suggestion}</p>
</div>
```

**변경 요약**:
- `text-[11px]` → `text-sm` (section 제목, line 245)
- `text-xs` → `text-sm` (문제 본문, line 246)
- `text-xs` → `text-sm` (제안 본문, line 247)

---

### Step 5: 테스트 작성

**파일**: `services/siw/src/app/api/resumes/[id]/__tests__/route.test.ts` (신규)

**프레임워크**: Vitest (기존 테스트 패턴 `import { describe, it, expect, vi, beforeEach } from 'vitest'` 확인)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock 설정 (기존 feedback/__tests__/route.test.ts 패턴 동일)
vi.mock('@/lib/resume-repository', () => ({
  resumeRepository: {
    findById: vi.fn(),
    deleteById: vi.fn(),
  },
}))
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  })),
  createServiceClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        remove: vi.fn().mockResolvedValue({ error: null }),
      })),
    },
  })),
}))
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}))

import { resumeRepository } from '@/lib/resume-repository'

const BASE_RESUME = {
  id: 'resume-1',
  userId: 'user-1',
  fileName: 'cv.pdf',
  storageKey: 'resumes/user-1/cv.pdf',
  resumeText: '자소서',
  questions: null,
  feedbackJson: null,
  trendComparison: null,
  inferredTargetRole: null,
  createdAt: new Date(),
}

describe('DELETE /api/resumes/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_STORAGE_BUCKET = 'test-bucket'
  })

  it('401 - 미인증 요청', async () => {
    const { createServerClient } = await import('@/lib/supabase/server')
    vi.mocked(createServerClient).mockReturnValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    } as never)

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(401)
  })

  it('404 - 존재하지 않는 이력서', async () => {
    vi.mocked(resumeRepository.findById).mockRejectedValue(new Error('Not found'))

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'no-exist' }),
    })
    expect(res.status).toBe(404)
  })

  it('403 - 타인 이력서 삭제 시도', async () => {
    vi.mocked(resumeRepository.findById).mockResolvedValue({
      ...BASE_RESUME,
      userId: 'other-user', // 다른 유저의 이력서
    })

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(403)
  })

  it('200 - 본인 이력서 삭제 성공', async () => {
    vi.mocked(resumeRepository.findById).mockResolvedValue(BASE_RESUME)
    vi.mocked(resumeRepository.deleteById).mockResolvedValue(true)

    const { DELETE } = await import('../route')
    const res = await DELETE(new Request('http://localhost'), {
      params: Promise.resolve({ id: 'resume-1' }),
    })
    expect(res.status).toBe(200)
    expect(resumeRepository.deleteById).toHaveBeenCalledWith('resume-1', 'user-1')
  })
})
```

---

### Step 6: .ai.md 최신화

**대상 파일**:
- `services/siw/src/app/api/resumes/[id]/.ai.md` (있으면 업데이트, 없으면 생성)
- `services/siw/src/app/(app)/resumes/.ai.md` (있으면 업데이트, 없으면 생성)

업데이트 내용: DELETE 핸들러 추가, 삭제 버튼 UI 추가 사실 기재

---

## 변경 파일 요약

| 파일 | 변경 유형 | 내용 |
|------|-----------|------|
| `services/siw/src/lib/resume-repository.ts` | 수정 | `deleteById(id, userId)` 메서드 추가 |
| `services/siw/src/app/api/resumes/[id]/route.ts` | 수정 | `DELETE` 핸들러 추가 (401/403/404/200) |
| `services/siw/src/app/(app)/resumes/page.tsx` | 수정 | 삭제 버튼 UI + `handleDelete` 핸들러 |
| `services/siw/src/app/(app)/resumes/[id]/page.tsx` | 수정 | 개선 제안 폰트: `text-[11px]`·`text-xs` → `text-sm` |
| `services/siw/src/app/api/resumes/[id]/__tests__/route.test.ts` | 신규 | DELETE 엔드포인트 Vitest 테스트 |
| `.ai.md` 파일들 | 수정/생성 | 변경 사항 반영 |

## 엣지 케이스 & 주의사항

1. **Storage 삭제 실패 허용**: Supabase Storage 파일이 이미 삭제되었거나 존재하지 않아도 DB 삭제는 진행
2. **동시 삭제 방지**: `deletingId` state로 버튼 비활성화 (중복 클릭 방지)
3. **이미 삭제된 이력서 상세 페이지 접근**: 삭제 후 `/resumes`로 돌아가므로 문제 없음
4. **`createServiceClient` import**: download/route.ts에서 이미 사용 중이므로 존재 확인됨
5. **Vitest 테스트에서 dynamic import**: 기존 패턴(`await import('../route')`)과 동일하게 사용
