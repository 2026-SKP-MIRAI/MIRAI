# [#180] feat: [fint] Phase 1 — 자소서 업로드 → Supabase Storage 저장 + 면접 맞춤 질문 연동 — 구현 계획

> 작성: 2026-03-25
> Architect 조건 반영, Critic 피드백 보완 완료

---

## 완료 기준

- [ ] AC1: 로그인 유저가 PDF 업로드 시 Supabase Storage에 저장됨 (`resumes` 버킷, RLS 본인만 접근)
- [ ] AC2: 면접 시작 시 업로드된 자소서가 있으면 resumeText를 엔진에 전달해 맞춤 질문 생성
- [ ] AC3: 자소서 없을 경우 기존 직군 기반 질문 생성 동작 유지 (하위 호환)
- [ ] AC4: 파일 크기 5MB 이하, PDF만 허용 (엔진 제약 동일)
- [ ] AC5: `/resume` 페이지에서 현재 업로드된 자소서 표시 및 교체 가능

---

## ADR (Architecture Decision Record)

- **Decision**: 1인 1파일 upsert 모델 — `resumes` 테이블 + Supabase Storage
- **Drivers**: AC1이 Storage 저장을 명시, Phase 1 범위 최소화, siw 패턴 재사용
- **Alternatives considered**:
  - DB-only (resume_text 컬럼만): Storage 불필요, 단순하지만 AC1 위반
  - Storage-only (온디맨드 파싱): 면접 시작 시 매번 파싱 → 지연 발생
- **Why chosen**: AC1이 명시적으로 Supabase Storage 저장을 요구하므로 Storage + DB 병행 필수
- **Consequences**: dual-source-of-truth 위험 → 업로드 시퀀스 강제로 완화
- **Follow-ups**: 이력 관리(Phase 2), Storage 용량 모니터링

---

## 사전 조건 (인프라)

> **구현 시작 전 Supabase Dashboard에서 수동 설정 필요**

### 1. Storage 버킷 생성
```
버킷명: resumes (또는 환경변수 SUPABASE_STORAGE_BUCKET 값)
공개 여부: Private (비공개)
```

### 2. Storage RLS 정책
```sql
-- resumes 버킷: 본인 폴더만 접근
CREATE POLICY "Users can upload own resume"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can read own resume"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete own resume"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'resumes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 3. resumes 테이블 생성
```sql
CREATE TABLE resumes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  storage_key  TEXT NOT NULL,          -- {userId}/{uuid}.pdf
  resume_text  TEXT,                   -- 엔진 /api/resume/parse 추출 텍스트
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)                      -- 1인 1파일
);

ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own resumes"
  ON resumes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 구현 계획

> **AC 우선 주의**: dev_spec.md(section 2.2)의 "HWP/DOC 지원, 10MB" 내용은 Phase 1에서 적용하지 않는다.
> 이슈 #180 AC(PDF만, 5MB)가 우선이며, 엔진 제약(`MAX_UPLOAD_BYTES = 5MB`)과 동일하다.

---

### Step 1: engine-client.ts allowlist 확장

**파일**: `services/fint/src/lib/engine-client.ts`

**변경**:
```typescript
// 기존
const ALLOWED_PATHS = [
  "/api/interview/start",
  "/api/interview/answer",
  "/api/report/generate",
  "/api/resume/questions",
  "/api/resume/feedback",
] as const;

// 변경 후 — /api/resume/parse 추가
const ALLOWED_PATHS = [
  "/api/interview/start",
  "/api/interview/answer",
  "/api/report/generate",
  "/api/resume/questions",
  "/api/resume/feedback",
  "/api/resume/parse",       // ← 추가: PDF 텍스트 추출 (upload 라우트에서 사용)
] as const;
```

**완료 조건**:
- `engineFetch("/api/resume/parse", ...)` 호출 시 "허용되지 않은 엔진 경로" 오류 없이 통과

---

### Step 2: resume-storage 유틸 생성

**파일**: `services/fint/src/lib/resume-storage.ts` (신규)

**변경** (siw 패턴 복제):
```typescript
// uuid 패키지 불필요 — Node.js 내장 crypto.randomUUID() 사용
import { createServiceClient } from '@/lib/supabase/server'

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? 'resumes'

export async function uploadResumePdf(
  userId: string,
  buffer: Buffer,
  originalFileName: string
): Promise<string> {
  const supabase = createServiceClient()
  const storageKey = `${userId}/${crypto.randomUUID()}.pdf`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storageKey, buffer, { contentType: 'application/pdf', upsert: false })
  if (error) throw new Error(`Storage upload failed: ${error.message}`)
  return storageKey
}

export async function deleteResumePdf(storageKey: string): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.storage.from(BUCKET).remove([storageKey])
  if (error) throw new Error(`Storage delete failed: ${error.message}`)
}
```

**완료 조건**:
- `uploadResumePdf` 단위 테스트: storageKey 반환 확인 (Supabase mock)
- `deleteResumePdf` 단위 테스트: 에러 없이 실행 확인

---

### Step 3: POST /api/resume/upload 라우트 생성

**파일**: `services/fint/src/app/api/resume/upload/route.ts` (신규)

**업로드 시퀀스** (Architect 조건: parse-first, atomic):
1. 인증 확인 → 미인증 시 401
2. FormData에서 PDF 파일 수신
3. 파일 검증: PDF 타입, 5MB 이하
4. **엔진 `/api/resume/parse` 호출** → `resumeText` 추출 (parse 실패 시 전체 롤백)
5. `uploadResumePdf` → storageKey 획득 (Storage 저장)
6. `resumes` 테이블 UPSERT — 기존 레코드 있으면 이전 storageKey로 `deleteResumePdf` 먼저 실행
7. 응답: `{ storageKey, fileName, resumeText, questions }`

```typescript
// 핵심 로직 스케치
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (file.type !== 'application/pdf') return NextResponse.json({ error: 'PDF only' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  // 1. 엔진 parse (실패 시 중단 — Storage 저장 전)
  const parseFormData = new FormData()
  parseFormData.append('file', new Blob([buffer], { type: 'application/pdf' }), file.name)
  const parseResult = await engineFetch('/api/resume/parse', { method: 'POST', body: parseFormData })
  if (!parseResult.ok) {
    const err = await parseResult.json().catch(() => ({}))
    return NextResponse.json({ error: 'Resume parse failed', detail: err }, { status: 400 })
  }
  const { resumeText } = await parseResult.json()

  // 2. 기존 레코드 조회 (교체용)
  const serviceClient = createServiceClient()
  const { data: existing } = await serviceClient
    .from('resumes').select('storage_key').eq('user_id', user.id).maybeSingle()

  // 3. Storage 저장
  const storageKey = await uploadResumePdf(user.id, buffer, file.name)

  try {
    // 4. DB upsert
    await serviceClient.from('resumes').upsert({
      user_id: user.id, file_name: file.name, storage_key: storageKey,
      resume_text: resumeText, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    // 5. 이전 파일 삭제 (DB 성공 후)
    if (existing?.storage_key && existing.storage_key !== storageKey) {
      await deleteResumePdf(existing.storage_key).catch(() => {}) // 삭제 실패는 무시
    }
  } catch (err) {
    // DB 실패 시 방금 올린 파일 롤백
    await deleteResumePdf(storageKey).catch(() => {})
    throw err
  }

  return NextResponse.json({ storageKey, fileName: file.name, resumeText })
}
```

**완료 조건**:
- 인증 유저 + 유효 PDF → Storage 파일 존재 + DB 레코드 존재
- 미인증 → 401
- 5MB 초과 → 400
- PDF 아닌 파일 → 400
- 동일 유저 재업로드 → 이전 파일 삭제 + 새 파일 저장

---

### Step 4: GET /api/resume + interview/start 수정

**파일**:
- `services/fint/src/app/api/resume/route.ts` (신규 — GET 핸들러)
- `services/fint/src/app/api/interview/start/route.ts` (수정)

#### GET /api/resume

```typescript
export async function GET() {
  const supabase = await createClient()  // server.ts의 createClient는 async
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ resume: null })

  const serviceClient = createServiceClient()
  const { data } = await serviceClient
    .from('resumes')
    .select('file_name, updated_at, resume_text')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ resume: null })
  return NextResponse.json({
    resume: {
      fileName: data.file_name,
      uploadedAt: data.updated_at,
      hasResumeText: !!data.resume_text,
    }
  })
}
```

#### POST /api/interview/start 수정

수정 위치: `route.ts:29` — `resumeText` 생성 로직

```typescript
// 기존 (변경 전)
const resumeText = `직군: ${jobCategories.join(', ')} / 취준 단계: ${careerStage}`

// 변경 후 — 자소서 있으면 우선 사용
const userId = await getCurrentUserId()  // 인수 없음 — 쿠키를 내부에서 읽음; 기존 line 47 호출을 위로 이동
let resumeText = `직군: ${jobCategories.join(', ')} / 취준 단계: ${careerStage}`

if (userId) {
  const serviceClient = createServiceClient()
  const { data: resumeRow } = await serviceClient
    .from('resumes')
    .select('resume_text')
    .eq('user_id', userId)
    .maybeSingle()

  if (resumeRow?.resume_text) {
    resumeText = `직군: ${jobCategories.join(', ')} / 취준 단계: ${careerStage}\n\n[자소서]\n${resumeRow.resume_text}`
  }
}
```

**완료 조건**:
- GET /api/resume: 업로드된 자소서 있으면 메타데이터 반환, 없으면 `{ resume: null }`
- 면접 시작: 자소서 있는 유저 → resumeText에 자소서 내용 포함
- 면접 시작: 자소서 없는 유저 → 기존 직군 기반 동작 유지 (회귀 없음)
- 비로그인 유저 → 기존 동작 유지

---

### Step 5: /resume 페이지 UI 업데이트

**파일**: `services/fint/src/app/resume/page.tsx` (수정)

**변경**:
1. 페이지 마운트 시 `GET /api/resume` 호출 → 현재 자소서 상태 조회
2. 자소서 있으면: 파일명 + 업로드 일시 표시, "교체하기" 버튼
3. 업로드 핸들러를 `/api/resume/questions`(기존 — 저장 없음) 대신 `/api/resume/upload`(신규) 호출로 변경
4. 파일 크기 제한 UI: 5MB로 표시 (기존 10MB → 5MB)
5. 업로드 완료 후 상태 갱신 (파일명/일시 표시)
6. 미로그인 시: 기존 `/api/resume/questions` 유지 (로그인 없이도 예상 질문 조회는 가능)

**완료 조건**:
- 로그인 + 업로드 → 페이지에 파일명/업로드일 표시
- "교체하기" 클릭 후 새 파일 업로드 → 이전 파일 대체 표시
- 5MB 초과 파일 선택 시 UI에서 즉시 오류 표시

---

### Step 6: 테스트 + .ai.md 최신화

**파일**:
- `services/fint/src/lib/__tests__/resume-storage.test.ts` (신규)
- `services/fint/src/app/api/resume/__tests__/upload.test.ts` (신규)
- `services/fint/src/app/api/interview/__tests__/start.test.ts` (수정)
- `services/fint/.ai.md` (수정)

#### Unit Tests

**resume-storage.test.ts**:
```
- uploadResumePdf: storageKey 형식 검증 ({userId}/{uuid}.pdf)
- uploadResumePdf: Supabase error → throws
- deleteResumePdf: remove 호출 확인
- deleteResumePdf: Supabase error → throws
```

**upload.test.ts**:
```
- 미인증 → 401
- PDF 아닌 파일 → 400
- 5MB 초과 → 400
- 유효 PDF + 인증 → 200, storageKey 반환
- 기존 레코드 있을 때 재업로드 → deleteResumePdf 호출 확인
- 엔진 parse 실패 → 400, Storage 업로드 미발생
- DB upsert 실패 → 500, Storage 파일 롤백 확인
```

#### Integration Tests (start.test.ts 확장)

```
기존 테스트 유지 (회귀 없음)
추가:
- 자소서 있는 유저 → resumeText에 "[자소서]" 포함 확인
- 자소서 없는 유저 → resumeText가 직군 기반 문자열
- 비로그인 유저 → resumeText가 직군 기반 문자열 (기존 동작 유지)
```

#### .ai.md 최신화 내용
- `resumes` 테이블 스키마 추가
- `resume-storage.ts` 유틸 설명 추가
- `/api/resume/upload` POST 라우트 추가
- `/api/resume` GET 라우트 추가
- `/api/interview/start` resumeText 주입 로직 설명 업데이트

**완료 조건**:
- 모든 신규 테스트 통과
- 기존 테스트 회귀 없음
- `services/fint/.ai.md` 업데이트 완료

---

## 변경 파일 요약

| 파일 | 변경 유형 |
|------|----------|
| `services/fint/src/lib/engine-client.ts` | 수정 (allowlist에 `/api/resume/parse` 추가) |
| `services/fint/src/lib/resume-storage.ts` | 신규 |
| `services/fint/src/app/api/resume/upload/route.ts` | 신규 |
| `services/fint/src/app/api/resume/route.ts` | 신규 (GET) |
| `services/fint/src/app/api/interview/start/route.ts` | 수정 |
| `services/fint/src/app/resume/page.tsx` | 수정 |
| `services/fint/src/components/UploadForm.tsx` | 수정 (파일 크기 제한 10MB→5MB, 업로드 엔드포인트 변경) |
| `services/fint/src/lib/__tests__/resume-storage.test.ts` | 신규 |
| `services/fint/src/app/api/resume/__tests__/upload.test.ts` | 신규 |
| `services/fint/src/app/api/interview/__tests__/start.test.ts` | 수정 |
| `services/fint/.ai.md` | 수정 |

---

## 리스크 및 완화

| 리스크 | 완화 전략 |
|--------|---------|
| Storage + DB dual-source-of-truth | parse-first 시퀀스 강제; DB 실패 시 Storage 롤백 |
| 엔진 `/api/resume/parse` 응답 변경 | `engine/app/schemas.py:20-22` ParseResponse 계약 준수 |
| Storage 버킷 미생성 | 사전 조건 섹션에 인프라 설정 명시 |
| 비로그인 면접 흐름 회귀 | `getCurrentUserId()` null 체크 + fallback 유지 |
| 이전 자소서 파일 삭제 실패 | `catch(() => {})` 무시 (Storage 용량 이슈는 모니터링) |
