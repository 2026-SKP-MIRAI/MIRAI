# #39 SIW MVP 01 구현 플랜 — 자소서 업로드 → 질문 생성 end-to-end

> 작성일: 2026-03-08
> 레퍼런스: `services/lww/` (동일 패턴 구현체)

---

## 1. 완료 기준 (Acceptance Criteria)

```
- [ ] services/siw/ 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [ ] Next.js API 라우트: POST /api/resume/questions → 엔진 HTTP 호출 → 응답 전달
- [ ] 업로드 UI: PDF 선택, "질문 생성" 버튼, 상태머신 (idle→ready→uploading→done/error)
- [ ] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [ ] 에러 처리: 400/422/500 한국어 안내 (엔진 detail 텍스트 → 에러 키 매핑)
- [ ] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트 + error-messages 매핑) — 총 20개
- [ ] services/siw/.ai.md 최신화 (구조·진행 상태 반영)
- [ ] 불변식 준수: import anthropic / import fitz 없음
- [ ] ENGINE_BASE_URL 환경변수로 엔진 접근
```

---

## 2. 전제조건 및 환경 설정

### 엔진 API 계약 (frozen)

- **엔드포인트:** `POST /api/resume/questions`
- **요청:** `multipart/form-data`, 필드명 `file`
- **성공(200):**
  ```json
  {
    "questions": [{"category": "직무 역량", "question": "..."}],
    "meta": {"extractedLength": 1234, "categoriesUsed": ["직무 역량", "기술 역량"]}
  }
  ```
- **실패:** `{"detail": "한국어 메시지"}` + HTTP 상태 코드

### 엔진 실제 에러 메시지 매핑표

| HTTP | 예외 클래스 | 엔진 detail 원문 | 서비스 에러 키 |
|------|------------|-----------------|--------------|
| 400 | RequestValidationError | `"파일이 필요합니다."` | `noFile` |
| 400 | FileSizeError | `"파일 크기가 너무 큽니다. 5MB 이하..."` | `tooLarge` |
| 400 | PageLimitError | `"페이지 수가 너무 많습니다. 10페이지 이하..."` | `tooManyPages` |
| 400 | ParseError | `"PDF 파일을 읽을 수 없습니다..."` | `corruptedPdf` |
| 422 | ImageOnlyPDFError | `"이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요."` | `imageOnlyPdf` |
| 422 | EmptyPDFError | `"PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요."` | `emptyPdf` |
| 500 | LLMError | `"질문 생성 중 오류가 발생했습니다..."` | `llmError` |

### 환경변수

```
ENGINE_BASE_URL=http://localhost:8000   # .env.local
```

### lww와 siw의 차이점

| 항목 | lww | siw |
|------|-----|-----|
| `noFile` 판별 키워드 | `"파일"+"없"` | `"파일"+"필요"` (엔진 실제 메시지 기반) |
| `UploadState` | `"idle"\|"ready"\|"uploading"\|"processing"\|"done"\|"error"` | `"idle"\|"ready"\|"uploading"\|"done"\|"error"` |
| 버튼 disabled 조건 | `uploading \|\| processing` | `uploading` 만 |
| e2e 테스트 | Playwright 포함 | Vitest 단위 테스트만 (MVP 01 범위) |

---

## 3. 파일 구조 청사진

```
services/siw/
├── package.json              # Next.js 15, React 19, TypeScript strict, Vitest
├── tsconfig.json             # strict, bundler moduleResolution, @/* 별칭
├── vitest.config.ts          # environmentMatchGlobs: api→node, ui→jsdom
├── .env.local.example        # ENGINE_BASE_URL=http://localhost:8000
├── .ai.md                    # 완료 후 최신화
├── src/
│   ├── app/
│   │   ├── layout.tsx                          # RootLayout (html lang="ko")
│   │   ├── resume/page.tsx                     # 업로드+결과 단일 페이지
│   │   └── api/resume/questions/route.ts       # POST 핸들러 → 엔진 프록시
│   ├── components/
│   │   ├── UploadForm.tsx    # PDF 선택 + 질문 생성 버튼 (상태머신)
│   │   └── QuestionList.tsx  # 카테고리별 질문 카드 + 다시하기
│   └── lib/
│       ├── types.ts          # Category, QuestionItem, QuestionsResponse, UploadState
│       └── error-messages.ts # ENGINE_ERROR_MESSAGES + mapDetailToKey
└── tests/
    ├── setup.ts                              # @testing-library/jest-dom import
    ├── api/
    │   ├── error-messages.test.ts            # 7개 (node 환경)
    │   └── resume-questions-route.test.ts    # 6개 (node 환경)
    └── ui/
        ├── upload-form.test.tsx              # 5개 (jsdom 환경)
        └── question-results.test.tsx         # 2개 (jsdom 환경)
```

---

## 4. 타입 계약 (engine schemas.py ↔ TypeScript)

### engine/app/schemas.py (참고용, 수정 금지)

```python
Category = Literal["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]

class QuestionItem(BaseModel):
    category: Category
    question: str

class Meta(BaseModel):
    extractedLength: int   # Python에서도 camelCase
    categoriesUsed: list[str]

class QuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    meta: Meta
```

### src/lib/types.ts

```typescript
export type Category = "직무 역량" | "경험의 구체성" | "성과 근거" | "기술 역량";
export type QuestionItem = { category: Category; question: string };
export type QuestionsResponse = {
  questions: QuestionItem[];
  meta: { extractedLength: number; categoriesUsed: string[] };
};
export type UploadState = "idle" | "ready" | "uploading" | "done" | "error";
```

**매핑 규칙:**
- `Meta.extractedLength: int` (Python camelCase) → `meta.extractedLength: number`
- `Category = Literal[...]` → `type Category = "..." | ...`
- `processing` 상태 없음 — lww와 달리 단순화

---

## 5. 설정 파일

### package.json

```json
{
  "name": "mirai-siw",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["**/*.ts", "**/*.tsx", "next-env.d.ts", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    environment: "jsdom",
    environmentMatchGlobs: [
      ["tests/api/**", "node"],   // AbortSignal.timeout 등 Node API
      ["tests/ui/**", "jsdom"],   // React 컴포넌트 렌더링
    ],
  },
});
```

---

## 6. API 라우트 구현

### src/app/api/resume/questions/route.ts

```typescript
import { ENGINE_ERROR_MESSAGES, mapDetailToKey } from "@/lib/error-messages";

export const runtime = "nodejs";  // AbortSignal.timeout Edge Runtime 미지원
export const maxDuration = 35;    // 30s 타임아웃 + 여유

const ENGINE_BASE_URL = process.env.ENGINE_BASE_URL ?? "http://localhost:8000";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.noFile },
      { status: 400 }
    );
  }

  const engineForm = new FormData();
  engineForm.append("file", file, file.name);  // 세 번째 인자(filename) 필수

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      body: engineForm,
      // ⚠️ Content-Type 헤더 수동 설정 금지 — boundary 자동 삽입을 위해
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ detail: "" }));
      const key = mapDetailToKey(body.detail ?? "", resp.status);
      return Response.json(
        { message: ENGINE_ERROR_MESSAGES[key] },
        { status: resp.status }
      );
    }

    return Response.json(await resp.json());
  } catch {
    return Response.json(
      { message: ENGINE_ERROR_MESSAGES.llmError },
      { status: 500 }
    );
  }
}
```

---

## 7. UI 컴포넌트

### 상태머신 전이도

```
idle ──[파일 선택]──→ ready ──[질문 생성 클릭]──→ uploading ──[응답 성공]──→ done
                                                   │
                                                   └──[응답 실패]──→ error ──[다시 시도]──→ idle
```

### src/components/UploadForm.tsx

```typescript
"use client";
import React, { useState, useRef } from "react";
import { QuestionsResponse, UploadState } from "@/lib/types";
import { ENGINE_ERROR_MESSAGES } from "@/lib/error-messages";

interface Props {
  onComplete: (data: QuestionsResponse) => void;
}

export default function UploadForm({ onComplete }: Props) {
  const [state, setState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setState("ready"); }
  };

  const handleSubmit = async () => {
    if (!file) return;
    setState("uploading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const resp = await fetch("/api/resume/questions", { method: "POST", body: formData });
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
    setError(""); setState("idle"); setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input ref={inputRef} type="file" accept=".pdf" onChange={handleFileChange} />
      {error && <p role="alert">{error}</p>}
      {state === "error" && <button onClick={handleRetry}>다시 시도</button>}
      <button onClick={handleSubmit} disabled={state === "uploading"}>
        질문 생성
      </button>
    </div>
  );
}
```

### src/components/QuestionList.tsx

```typescript
"use client";
import React from "react";
import { QuestionsResponse, Category } from "@/lib/types";

interface Props { data: QuestionsResponse; onReset: () => void; }

const CATEGORIES: Category[] = ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"];

export default function QuestionList({ data, onReset }: Props) {
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = data.questions.filter(q => q.category === cat);
    return acc;
  }, {} as Record<Category, typeof data.questions>);

  return (
    <div>
      {CATEGORIES.map(cat => (
        <section key={cat}>
          <h2>{cat}</h2>
          <ul>
            {grouped[cat].map((q, i) => (
              <li key={i} data-testid="question-item">{q.question}</li>
            ))}
          </ul>
        </section>
      ))}
      <button onClick={onReset}>다시 하기</button>
    </div>
  );
}
```

### src/app/resume/page.tsx

```typescript
"use client";
import React, { useState } from "react";
import UploadForm from "@/components/UploadForm";
import QuestionList from "@/components/QuestionList";
import { QuestionsResponse } from "@/lib/types";

export default function ResumePage() {
  const [result, setResult] = useState<QuestionsResponse | null>(null);
  if (result) return <QuestionList data={result} onReset={() => setResult(null)} />;
  return <UploadForm onComplete={setResult} />;
}
```

### src/app/layout.tsx

```typescript
export const metadata = {
  title: 'MirAI — 자소서 면접 질문 생성',
  description: '자소서를 업로드하면 AI가 면접 예상 질문을 카테고리별로 생성해드립니다.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

---

## 8. 에러 처리 설계

### src/lib/error-messages.ts

```typescript
export const ENGINE_ERROR_MESSAGES = {
  noFile:       "파일이 없습니다. PDF 파일을 업로드해 주세요.",
  tooLarge:     "파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.",
  tooManyPages: "페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요.",
  corruptedPdf: "PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.",
  imageOnlyPdf: "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.",
  emptyPdf:     "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.",
  llmError:     "질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
} as const;

export type ErrorKey = keyof typeof ENGINE_ERROR_MESSAGES;

export function mapDetailToKey(detail: string, status: number): ErrorKey {
  if (detail.includes("파일") && detail.includes("필요")) return "noFile";
  if (detail.includes("크기") || detail.includes("5MB")) return "tooLarge";
  if (detail.includes("페이지")) return "tooManyPages";
  if (detail.includes("읽을 수 없")) return "corruptedPdf";
  if (status === 422 && detail.includes("이미지")) return "imageOnlyPdf";  // emptyPdf보다 먼저
  if (status === 422 && detail.includes("텍스트")) return "emptyPdf";
  return "llmError";
}
```

#### imageOnlyPdf 우선 검사 이유

엔진의 `ImageOnlyPDFError` detail:
> `"이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요."`

이 메시지에 `"텍스트"` 키워드가 포함되어 있어 `emptyPdf` 조건(`detail.includes("텍스트")`)과 충돌함.
`imageOnlyPdf`(`"이미지"` 검사)를 반드시 먼저 수행해야 정확히 분기됨.

#### lww noFile 차이

lww는 `detail.includes("파일") && detail.includes("없")`을 사용.
그러나 엔진의 실제 `RequestValidationError` 메시지는 `"파일이 필요합니다."`.
siw는 `"필요"` 키워드로 정확히 매핑.

---

## 9. 테스트 전략 (TDD — 총 20개)

| 파일 | 테스트 수 | 환경 | 주요 케이스 |
|------|----------|------|------------|
| `tests/api/error-messages.test.ts` | 7 | node | 모든 에러 키 매핑 (엔진 실제 detail 텍스트 기준) |
| `tests/api/resume-questions-route.test.ts` | 6 | node | 성공, 파일 없음, 400/422/500 패스스루, 타임아웃 |
| `tests/ui/upload-form.test.tsx` | 5 | jsdom | 상태 전이 5개 독립 (Iron Law: mega-test 금지) |
| `tests/ui/question-results.test.tsx` | 2 | jsdom | 카테고리별 그룹핑, 다시하기 버튼 |

### tests/api/error-messages.test.ts (7개)

```typescript
import { describe, it, expect } from "vitest";
import { mapDetailToKey } from "@/lib/error-messages";

describe("mapDetailToKey", () => {
  it("파일 필요 에러를 noFile로 매핑한다", () => {
    expect(mapDetailToKey("파일이 필요합니다.", 400)).toBe("noFile");
  });
  it("파일 크기 에러를 tooLarge로 매핑한다", () => {
    expect(mapDetailToKey("파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.", 400)).toBe("tooLarge");
  });
  it("페이지 수 에러를 tooManyPages로 매핑한다", () => {
    expect(mapDetailToKey("페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요.", 400)).toBe("tooManyPages");
  });
  it("손상된 PDF 에러를 corruptedPdf로 매핑한다", () => {
    expect(mapDetailToKey("PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.", 400)).toBe("corruptedPdf");
  });
  it("이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다", () => {
    // "이미지"+"텍스트" 둘 다 포함 → imageOnlyPdf 먼저 검사 필수
    expect(mapDetailToKey("이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.", 422)).toBe("imageOnlyPdf");
  });
  it("텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다", () => {
    expect(mapDetailToKey("PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.", 422)).toBe("emptyPdf");
  });
  it("알 수 없는 에러를 llmError로 매핑한다 (fallback)", () => {
    expect(mapDetailToKey("질문 생성 중 오류가 발생했습니다.", 500)).toBe("llmError");
  });
});
```

### tests/api/resume-questions-route.test.ts (6개)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENGINE_BASE_URL = "http://localhost:8000";
});

describe("POST /api/resume/questions", () => {
  it("성공 시 200 반환");           // mockFetch → 200 + mockData
  it("파일 없음 시 400 반환");       // 빈 FormData → file instanceof File 실패
  it("엔진 400 에러 패스스루");      // mockFetch → 400
  it("엔진 422 에러 패스스루");      // mockFetch → 422
  it("엔진 500 에러 패스스루");      // mockFetch → 500
  it("타임아웃 시 500 반환");        // mockFetch → DOMException("AbortError")
});
```

**Mock 전략:** `vi.stubGlobal("fetch", mockFetch)` → 엔진 없이 독립 실행.
동적 import `await import("../../src/app/api/resume/questions/route")`로 핸들러 직접 호출.

### tests/ui/upload-form.test.tsx (5개 — 상태 독립)

```
1. idle_renders_upload_controls          — 초기: "질문 생성" 버튼 존재
2. moves_to_ready_when_pdf_selected      — 파일 선택 → 버튼 활성화
3. moves_to_uploading_when_submit_clicked — fetch pending → 버튼 비활성
4. moves_to_done_when_api_returns_questions — 성공 → onComplete 호출
5. moves_to_error_when_api_fails_and_retry_restarts — 실패 → "다시 시도" 표시
```

**Iron Law:** 각 테스트는 독립적 상태에서 시작. 이전 테스트 상태를 이어받지 않음.

### tests/ui/question-results.test.tsx (2개)

```
1. 카테고리별_그룹핑_렌더링  — 4개 카테고리 h2 모두 표시
2. 다시하기_버튼_클릭_시_onReset_호출 — onReset mock 호출 확인
```

---

## 10. 구현 순서 (TDD 단계별)

| Phase | 내용 | 검증 방법 |
|-------|------|----------|
| 0 | 프로젝트 초기화 (package.json, tsconfig.json, vitest.config.ts, .env.local.example) | `npm install` 성공, `vitest run` 정상 종료 |
| 1 | 타입 + 에러 메시지 정의 (`src/lib/types.ts`, `src/lib/error-messages.ts`) | TS 컴파일 에러 없음 |
| 2 | **[RED]** `tests/api/error-messages.test.ts` → **[GREEN]** `mapDetailToKey` | 7/7 통과 |
| 3 | **[RED]** `tests/api/resume-questions-route.test.ts` → **[GREEN]** `route.ts` | 13/13 통과 |
| 4 | **[RED]** UI 테스트 7개 → **[GREEN]** `UploadForm.tsx` + `QuestionList.tsx` | 20/20 통과 |
| 5 | 페이지 통합 (`src/app/layout.tsx`, `src/app/resume/page.tsx`) | 전체 테스트 통과 |
| 6 | 통합 검증 (엔진 + siw 로컬 실행, 브라우저 수동 테스트) | end-to-end 동작 확인 |
| 7 | `services/siw/.ai.md` 최신화, `.gitkeep` 제거 | `.ai.md` 구조 반영 |

---

## 11. 주의사항 및 잠재적 오류

### 1. Content-Type 헤더 수동 설정 금지

```typescript
// ❌ boundary 누락 → FastAPI 422
fetch(url, { body: engineForm, headers: { "Content-Type": "multipart/form-data" } });

// ✅ boundary 자동 삽입
fetch(url, { body: engineForm });
```

### 2. detail 텍스트 파싱 필수

HTTP 400이 FileSizeError / PageLimitError / ParseError 3가지를 커버하므로
status code만으로 에러 종류 구분 불가 → `detail` 텍스트 키워드 파싱 필수.

### 3. 422 에러 매핑 순서 엄수

`ImageOnlyPDFError` 메시지에 `"텍스트"` 포함.
`imageOnlyPdf` 검사를 `emptyPdf`보다 먼저 수행하지 않으면 `emptyPdf`로 잘못 매핑됨.

### 4. `.json().catch()` 방어

엔진이 HTML 에러 페이지를 반환하는 예외 상황 방어:
```typescript
const body = await resp.json().catch(() => ({ detail: "" }));
```

### 5. `engineForm.append` 세 번째 인자

```typescript
engineForm.append("file", file, file.name);  // filename 명시 필수
```

### 6. `runtime = "nodejs"` 필수

`AbortSignal.timeout()` Edge Runtime 미지원. 명시하지 않으면 Edge Runtime에서 실행되어 오류.

### 7. CORS 불필요

Next.js API route → 엔진 호출은 server-to-server. 브라우저가 직접 엔진을 호출하지 않음.

---

## 12. .ai.md 업데이트 체크리스트

완료 후 `services/siw/.ai.md` 업데이트 내용:

- **목적:** "MVP 01 완료 — 자소서 업로드 → 질문 생성 end-to-end"
- **구조:**
  ```
  siw/
  ├── src/
  │   ├── app/ (layout.tsx, resume/page.tsx, api/resume/questions/route.ts)
  │   ├── components/ (UploadForm.tsx, QuestionList.tsx)
  │   └── lib/ (types.ts, error-messages.ts)
  └── tests/ (setup.ts, api/, ui/)
  ```
- **역할:** Week 1 MVP 완료. 엔진 호출 패턴 (`ENGINE_BASE_URL` 환경변수).
- **기술 스택:** Next.js 15, React 19, TypeScript strict, Vitest 20개
- **진행 상태:** MVP 01 구현 완료

---

## 13. 아키텍처 불변식 체크

```
□ services/siw/에 인증 로직 없음 (MVP 01 범위 외)
□ services/siw/에 import anthropic 없음
□ services/siw/에 import fitz 없음
□ services/siw/에 import openai 없음
□ ENGINE_BASE_URL HTTP 호출만으로 엔진 접근
□ PDF 파싱은 엔진에 위임 (서비스에서 직접 파싱 없음)
□ Vitest 테스트 20개 전체 통과
□ scripts/check_invariants.py --check all 통과
```
