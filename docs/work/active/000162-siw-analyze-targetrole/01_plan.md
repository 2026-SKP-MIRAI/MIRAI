# [#162] feat: [siw] 직무 확인·수정 UI 추가 — engine /analyze 연동, targetRole 2-step 흐름 — 구현 계획

> 작성: 2026-03-20 (team plan — worker-1/analyst, worker-2/architect, worker-3/test-engineer)

---

## 완료 기준

- [ ] `POST /api/resumes/analyze` 신규 라우트 — engine `/api/resume/analyze` 프록시, `{ resumeText, targetRole }` 반환
- [ ] `POST /api/resumes` — `/parse` 호출 제거, 클라이언트가 formData로 `targetRole` 전달하는 기존 구조 활용
- [ ] `UploadForm.tsx` 2-step 상태머신: `uploading(/analyze) → confirming(직무 확인·수정) → submitting(/resumes)`
- [ ] targetRole `"미지정"` 반환 시 input placeholder로 직접 입력 유도, 빈 값도 허용
- [ ] `UploadState`에 `"confirming" | "submitting"` 추가
- [ ] 테스트 포함 (API 라우트 + UploadForm UI)
- [ ] `services/siw/.ai.md` 최신화

---

## 구현 계획

### 변경 파일 (5개)

| # | 파일 | 변경 유형 | 내용 |
|---|------|---------|------|
| 1 | `src/lib/types.ts` | 수정 | UploadState 확장, AnalyzeResult 타입 추가 |
| 2 | `src/lib/observability/event-logger.ts` | 수정 | feature_type에 `resume_analyze` 추가 |
| 3 | `src/app/api/resumes/analyze/route.ts` | **신규** | engine /analyze 프록시 라우트 |
| 4 | `src/app/api/resumes/route.ts` | 수정 | /parse 블록 제거, targetRole fallback 단순화 |
| 5 | `src/components/UploadForm.tsx` | 수정 | 2-step 상태머신 + confirming UI |

테스트 파일:
| # | 파일 | 변경 유형 |
|---|------|---------|
| T1 | `tests/api/resumes-analyze-route.test.ts` | **신규** |
| T2 | `tests/api/resumes-route.test.ts` | 수정 (parse 제거 반영) |
| T3 | `tests/ui/upload-form.test.tsx` | **신규** |

---

### UX 흐름

```
idle
  → ready          (파일 선택됨)
  → uploading      ("자소서 분석 중...", POST /api/resumes/analyze ~7-15s)
  → confirming     직무 확인·수정 UI
      ┌─────────────────────────────────┐
      │ 지원 직무가 확인됐어요           │
      │ [ 경영기획            ✏️ ]      │  ← input, 수정 가능
      │ [이 직무로 면접 준비하기]        │
      └─────────────────────────────────┘
      (targetRole="미지정"이면 value="" + placeholder="지원 직무를 입력하세요")
  → submitting     ("면접 준비 중...", POST /api/resumes with file + targetRole ~30s)
  → done           → onComplete(data) → router.push(/interview/new?resumeId=...)
  (오류 시 → error → 다시 시도 → idle)
```

---

### 구현 순서

- [x] Step 1: `types.ts` — UploadState + AnalyzeResult 타입 확장
- [x] Step 2: `event-logger.ts` — resume_analyze feature_type 추가
- [x] Step 3: `resumes/analyze/route.ts` 신규 생성 (engine /analyze 프록시)
- [x] Step 4: `resumes/route.ts` — /parse 블록 제거
- [x] Step 5: `UploadForm.tsx` — 2-step 상태머신 구현
- [x] Step 6: 테스트 작성 (T1 + T2 수정 + T3)
- [x] Step 7: `.ai.md` 최신화

---

## Step 1: `src/lib/types.ts` 변경

### Before (line 8)
```typescript
export type UploadState = "idle" | "ready" | "uploading" | "done" | "error";
```

### After
```typescript
export type UploadState = "idle" | "ready" | "uploading" | "confirming" | "submitting" | "done" | "error";

// /api/resumes/analyze 응답 타입
export type AnalyzeResult = {
  resumeText: string;
  targetRole: string;
};
```

---

## Step 2: `src/lib/observability/event-logger.ts` 변경

### Before (line 8-9)
```typescript
  feature_type:
    | "interview_start" | "interview_answer" | "interview_followup"
    | "report_generate" | "resume_parse" | "resume_questions" | "resume_feedback" | "practice_feedback";
```

### After
```typescript
  feature_type:
    | "interview_start" | "interview_answer" | "interview_followup"
    | "report_generate" | "resume_parse" | "resume_analyze" | "resume_questions" | "resume_feedback" | "practice_feedback";
```

### Before (line 41-50, FEATURE_MODE 객체)
```typescript
const FEATURE_MODE: Record<LLMEvent["feature_type"], LLMEvent["mode"]> = {
  // ... 기존 항목들
  resume_parse:       "resume",
  resume_questions:   "resume",
  resume_feedback:    "resume",
};
```

### After
```typescript
const FEATURE_MODE: Record<LLMEvent["feature_type"], LLMEvent["mode"]> = {
  // ... 기존 항목들
  resume_parse:       "resume",
  resume_analyze:     "resume",   // 추가
  resume_questions:   "resume",
  resume_feedback:    "resume",
};
```

---

## Step 3: `src/app/api/resumes/analyze/route.ts` (신규)

```typescript
import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages"
import { withEventLogging } from "@/lib/observability/event-logger"
import { cookies } from "next/headers"

export const runtime = "nodejs"
export const maxDuration = 60

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000"

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.noFile }, { status: 400 })
  }

  if (file.type !== "application/pdf") {
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.noFile }, { status: 400 })
  }

  try {
    const result = await withEventLogging('resume_analyze', null, async (meta) => {
      const engineForm = new FormData()
      engineForm.append("file", file, file.name)

      const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/analyze`, {
        method: "POST",
        body: engineForm,
        signal: AbortSignal.timeout(35000),
      })

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: "" }))
        const key = mapDetailToKey(body.detail ?? "", resp.status)
        throw Object.assign(new Error(ENGINE_ERROR_MESSAGES[key]), { status: resp.status })
      }

      const d = await resp.json()
      if (d.usage) meta.usage = d.usage
      return d as { resumeText: string; extractedLength: number; targetRole: string }
    })

    // extractedLength는 클라이언트에 불필요, resumeText + targetRole만 반환
    return NextResponse.json({
      resumeText: result.resumeText,
      targetRole: result.targetRole,
    })
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      return NextResponse.json({ message: err.message }, { status: (err as { status: number }).status })
    }
    return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 })
  }
}
```

**설계 결정:**
- `extractedLength` 제외: 클라이언트 불필요, 응답 크기 최소화
- `maxDuration = 60`: Vercel 제한 내 여유 (engine 35s + 오버헤드)
- `withEventLogging('resume_analyze', null, ...)`: observability 일관성 유지
- 인증 필수: 미인증 사용자의 analyze 호출 방지

---

## Step 4: `src/app/api/resumes/route.ts` 변경

### 제거 대상: lines 34-59 (/parse 블록 전체)

```typescript
// ❌ 제거: lines 34-59
const engineParseForm = new FormData()
engineParseForm.append("file", file, file.name)
let resumeText: string;
try {
  const parsed = await withEventLogging('resume_parse', null, async (meta) => {
    const parseResp = await fetch(`${ENGINE_BASE_URL}/api/resume/parse`, {
      method: "POST",
      body: engineParseForm,
      signal: AbortSignal.timeout(180000),
    });
    // ... (오류 처리 포함 전체)
  });
  resumeText = parsed.resumeText;
} catch (err) {
  // ...
}
```

### 변경 대상: line 61 (targetRole fallback)

```typescript
// ❌ Before
const targetRole = (formData.get("targetRole") as string | null) ?? "소프트웨어 개발자"

// ✅ After
const targetRole = (formData.get("targetRole") as string | null) ?? ""
```

> **이유**: 클라이언트가 confirming 단계에서 확정된 targetRole을 전달하므로 fallback 불필요.
> 빈 값("")은 engine /feedback이 "미지정 직무"로 fallback 처리함 (engine 계약).

### 변경 후 POST 함수 구조

```typescript
export async function POST(request: Request) {
  // 1. 인증
  const cookieStore = await cookies()
  const supabase = createServerClient(cookieStore)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ message: "인증이 필요합니다" }, { status: 401 })

  // 2. 파일 검증
  const formData = await request.formData()
  const file = formData.get("file")
  if (!(file instanceof File)) { /* 400 */ }
  if (file.type !== "application/pdf") { /* 400 */ }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // ✅ /parse 블록 완전 제거됨

  // 3. targetRole 수신 (클라이언트가 confirming 단계에서 확정 후 전달)
  const targetRole = (formData.get("targetRole") as string | null) ?? ""

  // 4. 병렬 처리 (기존과 동일)
  try {
    const [storageKey, engineData, feedbackJson] = await Promise.all([
      uploadResumePdf(user.id, buffer, file.name),
      withEventLogging('resume_questions', null, async (meta) => { /* /questions */ }),
      withEventLogging('resume_feedback', null, async (meta) => { /* /feedback */ }).catch(...),
    ])
    // 5. DB 저장 + 응답
    const resumeId = await resumeRepository.create({ ... })
    return NextResponse.json({ ...engineData, resumeId })
  } catch (err) { /* 오류 처리 */ }
}
```

**주의**: `resumeText`를 `/questions`와 `/feedback`에 전달해야 한다.
→ **문제**: 기존 route.ts에서 `resumeText`는 /parse로부터 왔으나, 이제 /parse가 없다.
→ **해결**: UploadForm이 `POST /api/resumes`에 file만 전달하는 기존 방식이 아닌, **file + targetRole만 전달**하고 서버에서 resumeText가 필요 없는 것이 아님.

> **⚠️ 중요한 재설계 포인트**: route.ts에서 /questions와 /feedback은 `resumeText`가 필요하다.
> 현재 route.ts는 /parse에서 resumeText를 얻어서 /questions, /feedback에 전달하는 구조다.
> `/parse` 제거 시 resumeText 공급 경로가 없어진다.
>
> **해결책 A**: UploadForm이 `/api/resumes/analyze` 응답의 `resumeText`를 state에 저장해두고, `/api/resumes` POST 시 formData에 `resumeText`도 함께 전달
>   - 장점: route.ts 단순화
>   - 단점: resumeText(최대 50K자)를 클라이언트→서버 재전송 (보안상 문제 없음, 성능 영향 미미)
>
> **해결책 B**: `/api/resumes` route에서 file을 받아 엔진 /parse를 재호출 (기존 parse 유지)
>   - 단점: PDF 재파싱 비용 발생, 이슈 목적과 어긋남
>
> **해결책 C** (권장): UploadForm이 formData에 `file + targetRole + resumeText`를 전달
>   - route.ts: formData에서 resumeText를 직접 수신 (`formData.get("resumeText") as string`)
>   - /parse 완전 제거 가능

**→ 해결책 C 채택** (이슈 지침 "formData로 targetRole 전달하는 기존 구조 활용"과 일치하며, resumeText도 동일하게 formData로 전달)

### 최종 route.ts 변경 (해결책 C 반영)

```typescript
// /parse 블록 제거 후 추가:
const targetRole = (formData.get("targetRole") as string | null) ?? ""
const resumeText = (formData.get("resumeText") as string | null) ?? ""

// resumeText가 없으면 오류 (정상 흐름에서는 항상 있어야 함)
if (!resumeText) {
  return NextResponse.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 400 })
}
```

---

## Step 5: `src/components/UploadForm.tsx` 변경

### 상태 추가

```typescript
const [analyzeResult, setAnalyzeResult] = useState<{ resumeText: string; targetRole: string } | null>(null)
const [confirmedRole, setConfirmedRole] = useState<string>("")
```

### 전체 컴포넌트 구조

```typescript
"use client";
import React, { useState, useRef } from "react";
import { QuestionsResponse, UploadState } from "@/lib/types";
import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";

interface Props {
  onComplete: (data: QuestionsResponse) => void;
  hideTitle?: boolean;
}

export default function UploadForm({ onComplete, hideTitle }: Props) {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const [resumeText, setResumeText] = useState<string>("");
  const [targetRole, setTargetRole] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setState("ready"); }
  };

  // Step 1: /analyze 호출 → confirming 단계로 전환
  const handleAnalyze = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/resumes/analyze", { method: "POST", body: formData });
      if (!resp.ok) {
        const body = await resp.json();
        setError(body.message ?? ENGINE_ERROR_MESSAGES.llmError);
        setState("error");
        return;
      }
      const data = await resp.json();
      setResumeText(data.resumeText);
      // "미지정"이면 빈 문자열로 변환 (placeholder로 유도)
      setTargetRole(data.targetRole === "미지정" ? "" : data.targetRole);
      setState("confirming");
    } catch {
      setError(ENGINE_ERROR_MESSAGES.llmError);
      setState("error");
    }
  };

  // Step 2: /resumes 호출 → done
  const handleSubmit = async () => {
    if (!file) return;
    setState("submitting");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("targetRole", targetRole);
      formData.append("resumeText", resumeText);
      const resp = await fetch("/api/resumes", { method: "POST", body: formData });
      if (!resp.ok) {
        const body = await resp.json();
        setError(body.message ?? ENGINE_ERROR_MESSAGES.llmError);
        setState("error");
        return;
      }
      const data = await resp.json();
      setState("done");
      onComplete(data);
    } catch {
      setError(ENGINE_ERROR_MESSAGES.llmError);
      setState("error");
    }
  };

  const handleRetry = () => {
    setError(""); setState("idle"); setFile(null); setResumeText(""); setTargetRole("");
    if (inputRef.current) inputRef.current.value = "";
  };

  // --- Render ---
  return (
    <div className="glass-card rounded-2xl p-8 shadow-sm">
      {!hideTitle && <h2 className="text-2xl font-bold gradient-text mb-2">자소서 분석</h2>}
      <p className="text-sm text-[#4B5563] mb-6">PDF 자소서를 업로드하면 맞춤 면접 질문을 생성해드립니다</p>

      {/* confirming 단계 UI */}
      {state === "confirming" && (
        <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/50">
          <p className="text-sm font-medium text-[#374151] mb-3">지원 직무가 확인됐어요</p>
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="지원 직무를 입력하세요"
            className="w-full border border-indigo-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-[#6B7280] mt-2">지원 직무가 다르다면 수정해주세요</p>
        </div>
      )}

      {/* 파일 드롭존 (confirming/submitting/done 단계에서는 숨김) */}
      {!["confirming", "submitting", "done"].includes(state) && (
        <div
          className={file
            ? "border-2 border-dashed border-indigo-400 rounded-xl bg-indigo-50 p-10 text-center cursor-pointer"
            : "border-2 border-dashed border-indigo-200 rounded-xl bg-indigo-50/30 p-10 text-center cursor-pointer hover:border-indigo-400 transition-colors"}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
          {file ? (
            <><span className="tag tag-purple">{file.name}</span><p className="mt-2 text-sm text-[#4B5563]">파일이 선택됐습니다</p></>
          ) : (
            <><p className="text-[#9CA3AF]">PDF 파일을 클릭해서 선택하세요</p><p className="text-xs text-[#9CA3AF] mt-1">최대 5MB · 10페이지 이내</p></>
          )}
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-[#EF4444]">{error}</p>}

      <div className="mt-6 flex gap-3">
        {state === "error" && (
          <button onClick={handleRetry} className="btn-outline rounded-xl px-5 py-3 flex-1">다시 시도</button>
        )}

        {/* confirming 단계: 확인 버튼 */}
        {state === "confirming" && (
          <button
            onClick={handleSubmit}
            className="btn-primary rounded-xl px-5 py-3 flex-1"
          >
            이 직무로 면접 준비하기
          </button>
        )}

        {/* uploading/submitting/idle/ready 단계: 메인 버튼 */}
        {state !== "confirming" && state !== "done" && state !== "error" && (
          <button
            onClick={handleAnalyze}
            disabled={state === "uploading" || state === "submitting" || !file}
            aria-label="이력서 분석"
            className="btn-primary rounded-xl px-5 py-3 flex-1 flex items-center justify-center gap-2"
          >
            {state === "uploading" && (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />자소서를 분석하고 있습니다...</>
            )}
            {state === "submitting" && (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />면접을 준비하고 있습니다...</>
            )}
            {(state === "idle" || state === "ready") && "이력서 분석"}
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## Step 6: 테스트 작성

### T1: `tests/api/resumes-analyze-route.test.ts` (신규)

**Mock 구조** (기존 resumes-route.test.ts 패턴 동일):
```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [] }),
}));

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn().mockReturnValue({
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
  }),
}));

function setAuthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } } });
}
function setUnauthenticated() {
  mockGetUser.mockResolvedValue({ data: { user: null } });
}
function makeAnalyzeRequest(targetRole?: string) {
  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([1,2,3])], "resume.pdf", { type: "application/pdf" }));
  return new Request("http://localhost/api/resumes/analyze", { method: "POST", body: formData });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
});
```

**테스트 케이스:**

```typescript
describe("POST /api/resumes/analyze", () => {
  it("200: engine /analyze 성공 → { resumeText, targetRole } 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "이력서 텍스트", extractedLength: 100, targetRole: "백엔드 개발자" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.resumeText).toBe("이력서 텍스트");
    expect(body.targetRole).toBe("백엔드 개발자");
  });

  it("200: targetRole='미지정'도 정상 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", extractedLength: 50, targetRole: "미지정" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.targetRole).toBe("미지정");
  });

  it("401: 미인증", async () => {
    setUnauthenticated();
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(401);
  });

  it("400: PDF 아닌 파일", async () => {
    setAuthenticated();
    const formData = new FormData();
    formData.append("file", new File([new Uint8Array([1])], "resume.txt", { type: "text/plain" }));
    const req = new Request("http://localhost/api/resumes/analyze", { method: "POST", body: formData });
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("400: 파일 없음", async () => {
    setAuthenticated();
    const req = new Request("http://localhost/api/resumes/analyze", { method: "POST", body: new FormData() });
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("422: engine 422 → 422 전달", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "PDF에 텍스트가 포함되어 있지 않습니다." }), { status: 422 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(422);
  });

  it("500: engine 500 → 500 반환", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "internal error" }), { status: 500 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    const res = await POST(makeAnalyzeRequest());
    expect(res.status).toBe(500);
  });

  it("engine /api/resume/analyze URL 호출 검증", async () => {
    setAuthenticated();
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", extractedLength: 50, targetRole: "개발자" }), { status: 200 })
    );
    const { POST } = await import("@/app/api/resumes/analyze/route");
    await POST(makeAnalyzeRequest());
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:8000/api/resume/analyze",
      expect.objectContaining({ method: "POST" })
    );
  });
});
```

### T2: `tests/api/resumes-route.test.ts` 수정 사항

**제거/수정할 테스트:**
- `"engine /api/resume/parse 를 fetch로 호출한다"` → 삭제 (parse 제거됨)
- `"resumeText 획득 후 upload + /api/resume/questions JSON을 Promise.all로 병렬 호출한다"` → mock 순서 변경

**Mock 순서 변경** (/parse 제거로 fetch 횟수 변경):
```typescript
// ❌ Before: parse(1) + questions(2) + feedback(3)
mockFetch
  .mockResolvedValueOnce(new Response(JSON.stringify({ resumeText: "텍스트" }), { status: 200 })) // parse
  .mockResolvedValueOnce(new Response(JSON.stringify({ questions: [...] }), { status: 200 }))    // questions
  .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))                      // feedback

// ✅ After: questions(1) + feedback(2) — formData에 resumeText 포함
function makePdfRequestWithResumeText(targetRole = "백엔드 개발자") {
  const formData = new FormData();
  formData.append("file", new File([new Uint8Array([1,2,3])], "resume.pdf", { type: "application/pdf" }));
  formData.append("targetRole", targetRole);
  formData.append("resumeText", "추출된 이력서 텍스트");
  return new Request("http://localhost/api/resumes", { method: "POST", body: formData });
}

mockFetch
  .mockResolvedValueOnce(new Response(JSON.stringify({ questions: [...], meta: {} }), { status: 200 })) // questions
  .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }))                            // feedback
```

**추가할 테스트:**
```typescript
it("/parse 호출이 발생하지 않는다", async () => {
  setAuthenticated();
  mockCreate.mockResolvedValue("new-resume-id");
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [], meta: {} }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  const { POST } = await import("@/app/api/resumes/route");
  await POST(makePdfRequestWithResumeText());
  const parseCall = mockFetch.mock.calls.find(c => String(c[0]).includes("/api/resume/parse"));
  expect(parseCall).toBeUndefined();
});

it("formData의 resumeText가 /questions body에 전달된다", async () => {
  setAuthenticated();
  mockCreate.mockResolvedValue("new-resume-id");
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => ({ questions: [], meta: {} }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
  const { POST } = await import("@/app/api/resumes/route");
  await POST(makePdfRequestWithResumeText());
  const questionsCall = mockFetch.mock.calls.find(c => String(c[0]).includes("/api/resume/questions"));
  const body = JSON.parse(questionsCall?.[1]?.body ?? "{}");
  expect(body.resumeText).toBe("추출된 이력서 텍스트");
});
```

### T3: `tests/ui/upload-form.test.tsx` (신규)

```typescript
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import UploadForm from "@/components/UploadForm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockOnComplete = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UploadForm", () => {
  it("초기 idle: 버튼 disabled", () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const btn = screen.getByRole("button", { name: /이력서 분석/ });
    expect(btn).toBeDisabled();
  });

  it("파일 선택 → 버튼 활성화", () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });
    const btn = screen.getByRole("button", { name: /이력서 분석/ });
    expect(btn).not.toBeDisabled();
  });

  it("uploading → confirming: /analyze 성공 후 직무 확인 UI 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "이력서 텍스트", targetRole: "백엔드 개발자" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      expect(screen.getByText("지원 직무가 확인됐어요")).toBeInTheDocument();
    });
  });

  it("confirming: targetRole 입력란에 AI 추론 직무 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "프론트엔드 개발자" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      const roleInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(roleInput.value).toBe("프론트엔드 개발자");
    });
  });

  it("confirming: targetRole='미지정' → 빈 input + placeholder", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "미지정" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      const roleInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(roleInput.value).toBe("");
      expect(roleInput.placeholder).toBe("지원 직무를 입력하세요");
    });
  });

  it("confirming → done: 확인 버튼 클릭 → onComplete 호출", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "개발자" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ questions: [], resumeId: "r-1" }), { status: 200 })
      );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => screen.getByText("지원 직무가 확인됐어요"));

    fireEvent.click(screen.getByRole("button", { name: /이 직무로 면접 준비하기/ }));
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(expect.objectContaining({ resumeId: "r-1" }));
    });
  });

  it("submitting 중 버튼 disabled (중복 제출 방지)", async () => {
    // /resumes 응답을 늦게 반환하는 시나리오
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "개발자" }), { status: 200 })
      )
      .mockReturnValueOnce(new Promise(() => {})); // pending (응답 없음)

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => screen.getByText("지원 직무가 확인됐어요"));
    fireEvent.click(screen.getByRole("button", { name: /이 직무로 면접 준비하기/ }));

    await waitFor(() => {
      // submitting 중에는 메인 버튼이 없거나 disabled
      const mainBtn = screen.queryByRole("button", { name: /이력서 분석/ });
      expect(mainBtn).toBeNull(); // confirming 버튼으로 대체됨
    });
  });

  it("/analyze 오류 → error 상태 + 에러 메시지 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "PDF 파일을 읽을 수 없습니다." }), { status: 422 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
```

---

## Step 7: `.ai.md` 최신화

`services/siw/.ai.md`에 다음 변경사항 반영:
- `POST /api/resumes/analyze` 라우트 추가 설명
- UploadForm 2-step 흐름 설명 업데이트
- UploadState 타입 목록 업데이트

---

## 데이터 흐름 다이어그램

```
[사용자]
  │ 파일 선택
  ▼
[UploadForm: ready]
  │ 분석 버튼 클릭
  ▼
[UploadForm: uploading]
  │ POST /api/resumes/analyze { file }
  ▼
[Next.js: /api/resumes/analyze]
  │ POST engine /api/resume/analyze { file }
  │ ← { resumeText, extractedLength, targetRole }
  │ withEventLogging('resume_analyze')
  ▼
[UploadForm: confirming] ← resumeText stored in state
  │ input: targetRole (수정 가능)
  │ 확인 버튼 클릭
  ▼
[UploadForm: submitting]
  │ POST /api/resumes { file, targetRole, resumeText }
  ▼
[Next.js: /api/resumes]
  │ Promise.all([
  │   uploadResumePdf,
  │   engine /questions { resumeText },
  │   engine /feedback { resumeText, targetRole }
  │ ])
  │ resumeRepository.create(...)
  ▼
[UploadForm: done]
  │ onComplete({ questions, resumeId })
  ▼
[router.push(/interview/new?resumeId=...)]
```

---

## ⚠️ Workers 분석에서 발견된 추가 변경 사항 (필수)

### A. `/questions`에도 targetRole 전달 필요 (worker-1 발견)

현재 `resumes/route.ts:70`: `body: JSON.stringify({ resumeText })` — `targetRole` 미전달
engine `QuestionsRequest.targetRole: str | None` (Optional 지원)

```typescript
// ❌ 현재
body: JSON.stringify({ resumeText })

// ✅ 변경 후 — 직무 맥락 반영한 질문 생성
body: JSON.stringify({ resumeText, targetRole })
```

### B. `inferredTargetRole` DB 저장 (worker-1 발견)

Prisma 스키마 + `resume-repository.ts`에 `inferredTargetRole?: string | null` 이미 존재.
`resumes/route.ts`의 `resumeRepository.create()` 호출에 추가 필요:

```typescript
const resumeId = await resumeRepository.create({
  userId: user.id,
  fileName: file.name,
  storageKey,
  resumeText,
  questions: engineData.questions ?? [],
  feedbackJson: feedbackJson ?? null,
  inferredTargetRole: targetRole || null,  // ← 추가
})
```

### C. AC4 준수: 빈 targetRole 허용 (worker-2 설계와 다름)

이슈 AC4: "빈 값도 허용 (engine이 '미지정 직무' fallback 처리)"
→ confirming 단계 버튼은 `disabled` 조건에서 빈 값 체크 **제거**:

```typescript
// ❌ worker-2 설계 (AC 위반)
disabled={!targetRole.trim()}

// ✅ 올바른 구현 — 빈 값도 허용
disabled={state === "submitting"}  // submitting 중만 disable
```

### D. `upload-form.test.tsx` 신규 생성이 아닌 **수정** (worker-3 발견)

`tests/ui/upload-form.test.tsx` 이미 존재 → 2-step UX 반영하여 전면 수정.
기존 단일-step 가정 테스트들 교체.

---

## 엣지 케이스 처리

| 케이스 | 처리 방법 |
|--------|---------|
| targetRole = "미지정" | UploadForm: value="" + placeholder 표시. 사용자가 빈 값 그대로 제출 허용. engine /feedback이 "미지정 직무"로 fallback 처리. |
| targetRole 빈 값("") | route.ts: formData.get("targetRole") ?? "" → engine /feedback의 targetRole=null 허용 (engine 계약상 optional) |
| /analyze timeout (35s 초과) | AbortSignal.timeout(35000) → fetch throw → 500 반환 → error state |
| /resumes timeout | 기존과 동일 (maxDuration=300, questions 30s, feedback 35s) |
| 중복 제출 | submitting 중 버튼 조건부 렌더링으로 방지 |
| /analyze 422 (페이지 초과 등) | mapDetailToKey → ENGINE_ERROR_MESSAGES → error state에 한국어 메시지 표시 |
| resumeText 없음 (/resumes 직접 호출) | route.ts에서 400 반환 (정상 흐름에서는 발생 불가) |

---

## 아키텍처 불변식 준수 확인

| 불변식 | 준수 여부 | 근거 |
|--------|---------|------|
| 인증은 서비스에서만 | ✅ | /analyze route에 supabase 인증 추가 |
| AI API 호출은 엔진에서만 | ✅ | Next.js → engine /analyze 프록시 |
| 서비스 간 직접 통신 금지 | ✅ | 변경 없음 |
| DB는 서비스가 소유 | ✅ | /analyze는 DB 저장 없음, /resumes에서만 저장 |
| 테스트 없는 PR 금지 | ✅ | T1 + T2 수정 + T3 신규 |
