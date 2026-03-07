# [#33] feat: MVP 01 구현 — 엔진 파서·LLM·API + lww 서비스 연동 — 구현 계획

> 작성: 2026-03-07 | 검토: Codex Planner + Codex Architect + FastAPI Expert + Frontend Expert + Architecture Critic + TDD Expert (gpt-5.3-codex)

---

## 완료 기준

- [ ] 엔진: `POST /api/resume/questions` — PDF 수신 → 파싱 → Claude API → `{ questions, meta }` JSON 반환 (§5-1 형식)
- [ ] 엔진: 파서 edge case 처리 (빈 PDF→422, 이미지 전용→422, 크기/페이지 초과→400, Claude 오류→500)
- [ ] 엔진: pytest 단위·통합 테스트 포함 (파서·LLM 서비스·API 라우트)
- [ ] lww: `POST /api/resume/questions` Next.js API 라우트 → 엔진 HTTP 호출 → 응답 전달
- [ ] lww: 업로드 UI (PDF 선택, "질문 생성" 버튼, idle→uploading→processing→done/error 상태)
- [ ] lww: 결과 UI (카테고리별 질문 리스트, "다시 하기" 버튼)
- [ ] lww: 에러 상태 한국어 안내 (400/422/500)

---

## 사전 필수 작업

### 0-A. `scripts/check_invariants.py` 경로 수정

현재 `ALLOWED_DIRS`가 구 경로를 사용 중 → `engine/app/services`, `engine/app/parsers`로 수정 필요.
수정하지 않으면 엔진 구현 시 모든 LLM/PDF import가 CI에서 false positive 위반으로 flagging됨.

```python
# 수정 전 (잘못됨)
ALLOWED_DIRS = {"llm": "engine/services", "pdf": "engine/parsers"}
# 수정 후
ALLOWED_DIRS = {"llm": "engine/app/services", "pdf": "engine/app/parsers"}
```

### 0-B. `.ai.md` 참조 정정 ✅ 완료

`engine/app/parsers/.ai.md`, `engine/app/services/.ai.md`, `engine/app/routers/.ai.md`,
`engine/docs/.ai.md`, `services/lww/.ai.md`, `services/kwan/.ai.md`, `services/siw/.ai.md`, `services/seung/.ai.md`의
모든 `.ai.md`의 엔진 API 계약 참조 → `engine/.ai.md`로 전부 업데이트 완료.

---

## 파일 구조

### 엔진 (engine/)

```
engine/
├── pyproject.toml            # FastAPI, uvicorn, pymupdf, openai,
│                             # pydantic, pydantic-settings, pytest,
│                             # pytest-asyncio, httpx, python-multipart
├── .env.example
└── app/
    ├── __init__.py
    ├── main.py               # FastAPI 앱 + 전역 예외 핸들러
    ├── config.py             # pydantic-settings
    ├── schemas.py            # Pydantic v2 모델
    ├── parsers/
    │   ├── __init__.py
    │   ├── pdf_parser.py     # parse_pdf()
    │   └── exceptions.py    # 예외 계층
    ├── services/
    │   ├── __init__.py
    │   ├── llm_service.py    # generate_questions()
    │   └── output_parser.py  # LLM 응답 JSON 파싱 + Pydantic 검증
    ├── prompts/
    │   └── question_generation_v1.md
    └── routers/
        ├── __init__.py
        └── resume.py         # POST /api/resume/questions

└── tests/                    # engine/tests/ 위치 — engine/.ai.md 기준
    ├── conftest.py
    ├── unit/
    │   ├── parsers/test_pdf_parser.py
    │   └── services/
    │       ├── test_llm_service.py
    │       └── test_output_parser.py
    ├── integration/
    │   └── test_resume_questions_route.py
    └── fixtures/             # gitignored
        ├── input/  (sample_resume.pdf, empty.pdf, image_only.pdf, ...)
        └── output/ (expected_parsed.json, mock_llm_response.json)
```

### lww 서비스 (services/lww/)

```
services/lww/
├── package.json
├── next.config.ts
├── tsconfig.json
├── vitest.config.ts
├── .env.local.example        # ENGINE_BASE_URL=http://localhost:8000
└── src/
    ├── app/
    │   ├── api/resume/questions/route.ts  # POST 핸들러
    │   └── resume/page.tsx               # 업로드+결과 단일 페이지
    ├── components/
    │   ├── UploadForm.tsx    # PDF 드롭존 + 버튼
    │   └── QuestionList.tsx  # 카테고리별 질문 카드
    └── lib/
        ├── types.ts          # 공유 타입
        ├── engine-client.ts  # ENGINE_BASE_URL HTTP 래퍼
        └── error-messages.ts # 상태코드 → 한국어 메시지 (중앙 집중)

tests/
├── setup.ts
├── api/resume-questions-route.test.ts
└── ui/
    ├── upload-form.test.tsx
    └── question-results.test.tsx
```

---

## 프로젝트 설정

### 엔진 pyproject.toml 필수 항목

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
asyncio_mode = "auto"       # pytest-asyncio 필수 — 없으면 async 테스트 실행 안 됨
pythonpath = ["."]

[project.dependencies]
# fastapi, uvicorn[standard], pymupdf, openai, pydantic, pydantic-settings
# python-multipart  ← multipart/form-data 파싱 필수
# openai SDK를 OpenRouter base_url로 사용 (anthropic 미사용)
```

### 413 처리 방침

dev_spec §5-1에 413이 Optional로 언급되어 있으나 engine/.ai.md 예외 테이블에 없음.
**결정: 413 미지원. 5MB 초과 → `FileSizeError` → 400 응답으로 통일.**

### lww package.json devDependencies

```json
{
  "vitest": "latest",
  "@testing-library/react": "latest",
  "@testing-library/user-event": "latest",
  "@vitejs/plugin-react": "latest",
  "jsdom": "latest"
}
```

```ts
// vitest.config.ts — 환경을 파일별로 분리 (Frontend expert 권고)
export default defineConfig({
  plugins: [react()],
  test: {
    setupFiles: ["./tests/setup.ts"],
    environment: "jsdom",               // UI 테스트 기본
    environmentMatchGlobs: [
      ["tests/api/**", "node"],         // API route 테스트 → node 환경
      ["tests/ui/**", "jsdom"],         // UI 컴포넌트 테스트 → jsdom
    ],
  },
});
```

### conftest.py fixture 전략

**TDD expert 권고**: `pytest.skip()` 기반은 "가짜 그린" 위험 존재.
권장 분리 전략:
- 필수 단위·통합 테스트 → **synthetic fixture** (런타임 생성 bytes 사용)
- 대용량 실제 PDF 기반 테스트 → `@pytest.mark.external_fixture`로 분리
- 필수 fixture 누락 시 skip 대신 **즉시 fail** (실제 CI 환경 보호)

```python
# tests/conftest.py
import pytest
from pathlib import Path

FIXTURES_INPUT = Path(__file__).parent / "fixtures/input"

# 실제 PDF fixture (외부 fixture 마커)
@pytest.fixture
def sample_pdf_bytes():
    p = FIXTURES_INPUT / "sample_resume.pdf"
    if not p.exists():
        pytest.skip("external fixture not found — gitignored")
    return p.read_bytes()

# 필수 단위 테스트용 synthetic fixture (항상 존재)
@pytest.fixture
def minimal_pdf_bytes() -> bytes:
    """PyMuPDF로 생성한 최소 유효 PDF — gitignore 불필요"""
    import fitz
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "테스트 이력서 내용")
    return doc.tobytes()
```

---

## 타입 계약

### 엔진 Python

```python
# parsers/exceptions.py
class ParseError(Exception): pass          # → 400
class EmptyPDFError(ParseError): pass      # → 422
class ImageOnlyPDFError(ParseError): pass  # → 422
class FileSizeError(ParseError): pass      # → 400
class PageLimitError(ParseError): pass     # → 400
class LLMError(Exception): pass           # → 500

# schemas.py
from typing import Literal
Category = Literal["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]

class ParsedResume(BaseModel):
    text: str
    extracted_length: int   # page_count는 parse_pdf() 내부 로컬 변수로만 사용

class QuestionItem(BaseModel):
    category: Category   # Literal enum — 알 수 없는 카테고리 자동 거부
    question: str

class Meta(BaseModel):
    extractedLength: int
    categoriesUsed: list[str]

class QuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    meta: Meta
```

### 라우터 엔드포인트 시그니처 (FastAPI expert 필수 지적)

```python
# routers/resume.py
from fastapi import APIRouter, File, UploadFile
from app.schemas import QuestionsResponse, Meta, QuestionItem

router = APIRouter(prefix="/resume")

@router.post("/questions", response_model=QuestionsResponse)
async def create_questions(file: UploadFile = File(...)):
    file_bytes = await file.read()
    parsed = parse_pdf(file_bytes, filename=file.filename)
    questions = generate_questions(parsed.text)
    # Meta 조립: snake_case → camelCase 명시적 매핑
    categories_used = list(dict.fromkeys(q.category for q in questions))
    return QuestionsResponse(
        questions=questions,
        meta=Meta(
            extractedLength=parsed.extracted_length,  # 명시적 매핑 필수
            categoriesUsed=categories_used,           # output_parser 이후 router에서 조립
        ),
    )
```

> **`file: UploadFile = File(...)` 없으면 multipart 파싱 불가 (422 "field missing")**
> `Meta.extractedLength`(camelCase) ← `parsed.extracted_length`(snake_case): 직접 키워드 매핑 사용

---

### 함수 시그니처

```python
# parsers/pdf_parser.py
def parse_pdf(
    file_bytes: bytes,
    *,
    filename: str | None = None,
    max_file_size_bytes: int = 5 * 1024 * 1024,
    max_pages: int = 10,
) -> ParsedResume: ...

# services/llm_service.py
def generate_questions(
    resume_text: str,
    *,
    model: str = "google/gemini-flash-1.5",  # OpenRouter 모델명
    max_input_chars: int = 16000,
    timeout_seconds: float = 30.0,
) -> list[QuestionItem]: ...

# services/output_parser.py
def parse_llm_response(raw: str) -> list[QuestionItem]: ...
```

### 전역 예외 핸들러 (main.py)

```python
@app.exception_handler(EmptyPDFError)
@app.exception_handler(ImageOnlyPDFError)
async def handle_422(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

@app.exception_handler(FileSizeError)
@app.exception_handler(PageLimitError)
@app.exception_handler(ParseError)
async def handle_400(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(LLMError)
async def handle_500(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})
```

### lww TypeScript

```typescript
// lib/types.ts
type Category = "직무 역량" | "경험의 구체성" | "성과 근거" | "기술 역량";
export type QuestionItem = { category: Category; question: string };
export type QuestionsResponse = {
  questions: QuestionItem[];
  meta: { extractedLength: number; categoriesUsed: string[] };
};
export type UploadState = "idle" | "ready" | "uploading" | "processing" | "done" | "error";
// ready: PDF 선택 완료, 제출 버튼 활성화 상태

// lib/error-messages.ts — 픽스처 error_responses.json 기준 (케이스별 분리)
export const ENGINE_ERROR_MESSAGES = {
  noFile:      "파일이 없습니다. PDF 파일을 업로드해 주세요.",
  notPdf:      "PDF 파일만 업로드 가능합니다.",
  tooLarge:    "파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.",
  tooManyPages:"페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요.",
  corruptedPdf:"PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.",
  emptyPdf:    "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.",
  imageOnlyPdf:"이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.",
  llmError:    "질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
} as const;
```

---

## 프롬프트 설계 (question_generation_v1.md)

```
당신은 자소서 기반 면접 예상 질문 생성 전문가입니다.

아래는 지원자가 제출한 자기소개서 전문(또는 발췌)입니다.

<resume>
{resume_text}
</resume>

지침:
1. 자소서에 실제로 기술된 내용(프로젝트 경험, 직무 역량, 기술 키워드, 성과)만을 기반으로 질문을 만드세요.
2. 자소서에 없는 내용을 묻는 질문은 절대 만들지 마세요.
3. 아래 4개 카테고리만 사용하세요 (다른 카테고리 사용 금지):
   직무 역량 / 경험의 구체성 / 성과 근거 / 기술 역량
4. 각 카테고리당 2~5개, 총 8~20개 질문을 생성하세요.
5. 자소서가 16,000자를 초과하는 경우 앞부분만 제공됩니다. 제공된 내용만을 기준으로 질문을 생성하세요.
6. JSON 배열만 반환하세요. 다른 텍스트·마크다운·설명을 포함하지 마세요.

출력 형식:
[{"category": "직무 역량", "question": "..."}, ...]
```

---

## multipart/form-data 주의

- Next.js → FastAPI forwarding 시 `Content-Type` 헤더 **수동 설정 금지** (boundary 자동 처리)
- 파일 re-wrap 시 `filename`, MIME type 보존: `new File([bytes], file.name, { type: file.type })`
- 5MB 제한은 **양쪽에서 모두 검증** (Next.js 먼저 → 엔진 재검증)

### route.ts 핵심 구현 패턴 (Frontend expert 권고)

```typescript
// src/app/api/resume/questions/route.ts
export const runtime = "nodejs";  // AbortSignal.timeout 호환 보장
export const maxDuration = 35;    // 배포 환경 함수 타임아웃 (30s timeout + 여유)

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(ENGINE_ERROR_MESSAGES.noFile, { status: 400 });
  }

  const engineForm = new FormData();
  engineForm.append("file", file, file.name);  // Content-Type 헤더 미설정

  try {
    const resp = await fetch(`${ENGINE_BASE_URL}/api/resume/questions`, {
      method: "POST",
      body: engineForm,
      signal: AbortSignal.timeout(30000),
    });
    if (!resp.ok) {
      const { detail } = await resp.json();
      const key = mapDetailToKey(detail, resp.status);  // detail 텍스트 → 키 매핑
      return Response.json({ message: ENGINE_ERROR_MESSAGES[key] }, { status: resp.status });
    }
    return Response.json(await resp.json());
  } catch {
    return Response.json({ message: ENGINE_ERROR_MESSAGES.llmError }, { status: 500 });
  }
}
```

### 에러 키 매핑 전략 (status만으로는 불충분 — 400이 여러 원인)

```typescript
// lib/engine-client.ts — detail 텍스트 → error key 매핑
function mapDetailToKey(
  detail: string,
  status: number,
): keyof typeof ENGINE_ERROR_MESSAGES {
  if (detail.includes("파일") && detail.includes("없")) return "noFile";
  if (detail.includes("PDF")) return "notPdf";
  if (detail.includes("크기") || detail.includes("5MB")) return "tooLarge";
  if (detail.includes("페이지")) return "tooManyPages";
  if (detail.includes("손상") || detail.includes("읽을 수 없")) return "corruptedPdf";
  if (status === 422 && detail.includes("텍스트")) return "emptyPdf";
  if (status === 422 && detail.includes("이미지")) return "imageOnlyPdf";
  if (status === 500) return "llmError";
  return "llmError";  // fallback
}
```

> 엔진이 stable `errorCode` 필드 추가 시 이 함수를 코드 기반 매핑으로 단순화 가능.

### Tailwind v4 설정 (v3와 다름 — Frontend expert 권고)

```css
/* src/app/globals.css — v4 방식 */
@import "tailwindcss";
/* v3의 @tailwind base/components/utilities 패턴 사용 금지 */
```

```
PostCSS 플러그인: @tailwindcss/postcss  (v3: tailwindcss)
모노레포 외부 소스: @source "../../../packages/ui" 형태로 명시
테마 커스텀: tailwind.config.js 대신 CSS @theme { } 블록 사용
```

---

## LLM 출력 검증 파이프라인

```
Claude raw 텍스트
  → json.loads()                    실패 시 LLMError
  → list[dict] 타입 확인            실패 시 LLMError
  → Pydantic QuestionItem 검증     알 수 없는 category → LLMError
  → 최소 개수 확인 (8개 이상)       미달 시 LLMError
  → list[QuestionItem] 반환
```

---

## 에러 메시지 매핑 (한국어)

| HTTP | 원인 | 메시지 |
|------|------|--------|
| 400 | 파일 없음 | 파일이 없습니다. PDF 파일을 업로드해 주세요. |
| 400 | PDF 아님 | PDF 파일만 업로드 가능합니다. |
| 400 | 5MB 초과 | 파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요. |
| 400 | 10페이지 초과 | 페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요. |
| 400 | 손상/암호화 | PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요. |
| 422 | 텍스트 없음 | PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요. |
| 422 | 이미지 전용 | 이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요. |
| 500 | LLM 오류 | 질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요. |

---

## TDD 테스트 계획

### 엔진 pytest

| 파일 | 테스트 케이스 |
|------|--------------|
| `unit/parsers/test_pdf_parser.py` | 정상, 빈 PDF(EmptyPDFError), 이미지 전용(ImageOnlyPDFError), 손상(ParseError), 대용량(FileSizeError), 페이지 초과(PageLimitError), **경계값: 정확히 5MB 통과, 5MB+1byte 실패, 정확히 10페이지 통과, 11페이지 실패** |
| `unit/services/test_llm_service.py` | 정상 생성, API 오류(LLMError), JSON 파싱 실패(LLMError), 알 수 없는 category(LLMError), 긴 텍스트 truncate |
| `unit/services/test_output_parser.py` | `parses_valid_question_array_when_json_matches_schema`, `raises_llm_error_when_response_is_not_valid_json`, `raises_llm_error_when_root_is_not_list`, `raises_llm_error_when_item_is_not_object`, `raises_llm_error_when_required_key_category_is_missing`, `raises_llm_error_when_required_key_question_is_missing`, `raises_llm_error_when_category_is_not_allowed_literal`, `raises_llm_error_when_question_is_empty_string`, `raises_llm_error_when_question_count_is_less_than_8`, `returns_items_when_question_count_is_exactly_8`, **`raises_llm_error_when_question_count_is_zero`** (valid JSON but empty list) |
| `integration/test_resume_questions_route.py` | 성공(200), 파일 없음(400), **PDF 아님(400) — filename=.pdf 위장 + content_type=text/plain 조합 포함**, 5MB 초과(400), 10페이지 초과(400), 빈 PDF(422), 이미지 전용(422), LLM 오류(500) |

**통합 테스트 패턴 (TDD expert 권고 — AsyncClient + ASGITransport):**

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio  # asyncio_mode="auto" 이므로 마커 생략 가능
async def test_400_when_not_pdf():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        resp = await ac.post(
            "/api/resume/questions",
            files={"file": ("resume.txt", b"hello", "text/plain")},
        )
    assert resp.status_code == 400
```

> `TestClient`와 `AsyncClient` 혼용 금지. 비동기 테스트는 `ASGITransport`만 사용.

**LLM mock 전략 (TDD expert 권고):**

```python
# app.services.llm_service.OpenAI 생성자만 patch → fake client 반환
from unittest.mock import MagicMock, patch

def test_generate_questions_success():
    fake_client = MagicMock()
    fake_client.chat.completions.create.return_value.choices[0].message.content = '[{"category":"직무 역량","question":"Q?"}]' * 8
    with patch("app.services.llm_service.OpenAI", return_value=fake_client):
        result = generate_questions("이력서 텍스트")
    assert len(result) >= 8
```

> SDK 내부 private 동작 mock 금지. `chat.completions.create`만 mock.

### lww Vitest

| 파일 | 테스트 케이스 |
|------|--------------|
| `tests/api/resume-questions-route.test.ts` | 성공(200), 엔진 400/422/500 에러 패스스루, 타임아웃(500) |
| `tests/ui/upload-form.test.tsx` | **상태머신 5개 전이 (각 1개씩 분리)**: `idle_renders_upload_controls`, `moves_to_ready_when_pdf_selected`, `moves_to_uploading_when_submit_clicked`, `moves_to_done_when_api_returns_questions`, `moves_to_error_when_api_fails_and_retry_restarts` |
| `tests/ui/question-results.test.tsx` | 카테고리별 그룹핑 렌더링, "다시 하기" 버튼 동작 |

> 상태머신 테스트: 전이 1개씩 독립 검증. mega-test(여러 전이 한 테스트) 금지.

### e2e Playwright (TDD expert: 테스트 피라미드 70/20/10 충족용 최소 2개)

**설정:**
```
devDependencies: @playwright/test
테스트 위치: services/lww/tests/e2e/
실행 조건: engine + lww 모두 로컬 실행 중 (또는 CI에서 docker-compose)
마커: @pytest.mark.external_fixture 대응으로 별도 스크립트 실행
```

| 파일 | 테스트 케이스 | 전제 조건 |
|------|--------------|-----------|
| `tests/e2e/resume-flow.spec.ts` | **성공 플로우**: `sample_resume.pdf` 업로드 → 로딩 → 카테고리별 질문 8개 이상 렌더링 확인 | 실제 엔진 + Claude API |
| `tests/e2e/resume-flow.spec.ts` | **에러 플로우**: `.txt` 파일 업로드 → 한국어 에러 메시지(`PDF 파일만 업로드 가능합니다.`) 표시 확인 | 실제 엔진 (LLM 불필요) |

```typescript
// tests/e2e/resume-flow.spec.ts
import { test, expect } from "@playwright/test";
import path from "path";

test("성공: PDF 업로드 시 질문 리스트 렌더링", async ({ page }) => {
  await page.goto("/resume");
  await page.setInputFiles("input[type=file]", path.join(__dirname, "../fixtures/input/sample_resume.pdf"));
  await page.getByRole("button", { name: "질문 생성" }).click();
  await expect(page.getByText("직무 역량")).toBeVisible({ timeout: 40000 });
  const questions = page.locator("[data-testid='question-item']");
  await expect(questions).toHaveCount({ min: 8 });
});

test("에러: PDF 아닌 파일 업로드 시 한국어 에러 표시", async ({ page }) => {
  await page.goto("/resume");
  await page.setInputFiles("input[type=file]", path.join(__dirname, "../fixtures/input/not-a-pdf.txt"));
  await page.getByRole("button", { name: "질문 생성" }).click();
  await expect(page.getByText("PDF 파일만 업로드 가능합니다.")).toBeVisible();
});
```

> e2e 테스트는 CI에서 선택적 실행 (`--grep @e2e` 또는 별도 스크립트). 단위/통합 테스트와 분리.

---

## 구현 순서

### Phase 0: 사전 수정 (30분, 순차)
1. `scripts/check_invariants.py` 경로 수정 (`engine/services` → `engine/app/services` 등)
2. `.ai.md` 파일 `engine/.ai.md` 참조 업데이트 ✅ 완료

### Phase 1: 프로젝트 셋업 (병렬 가능)
| 엔진 (독립) | lww (독립) |
|-------------|------------|
| `pyproject.toml` 작성 | Next.js 프로젝트 초기화 |
| `main.py`, `config.py`, `schemas.py` 기본 구조 | `lib/types.ts`, `lib/error-messages.ts` |
| `parsers/exceptions.py` 예외 계층 | `vitest.config.ts` + test setup |
| `.env.example` | `.env.local.example` |

### Phase 2: 엔진 파서 TDD (순차)
1. `[RED]` `unit/parsers/test_pdf_parser.py` 작성 → 실패 확인
2. `[GREEN]` `app/parsers/pdf_parser.py` PyMuPDF 구현
3. `[REFACTOR]` 정리 → 파서 테스트 Green

### Phase 3: 엔진 LLM 서비스 TDD (Phase 2와 병렬 가능)
1. `[RED]` `unit/services/test_output_parser.py` 11개 케이스 작성 → 실패 확인
2. `[GREEN]` `app/services/output_parser.py` 구현 → 테스트 Green
3. `[RED]` `unit/services/test_llm_service.py` 작성 → 실패 확인
4. `app/prompts/question_generation_v1.md` 작성
5. `[GREEN]` `app/services/llm_service.py` OpenAI SDK + OpenRouter base_url 구현 → 테스트 Green

> **Iron Law**: output_parser 테스트 먼저(step 1) → 구현(step 2) 순서 필수

### Phase 4: 엔진 API 라우트 + 통합 (Phase 2+3 완료 후)
1. `[RED]` `integration/test_resume_questions_route.py` 작성 → 실패 확인
2. `[GREEN]` `app/routers/resume.py` 구현 — `router = APIRouter(prefix="/resume")`
3. `[GREEN]` `app/main.py` 전역 핸들러 + 라우터 등록 — `app.include_router(router, prefix="/api")`
   → `POST /api/resume/questions` 경로 완성 → 테스트 Green → **API 계약 freeze**

> **Iron Law**: 통합 테스트 먼저(step 1) → 라우터 구현(step 2) 순서 필수

### Phase 5: lww API 라우트 TDD (Phase 4 후 또는 mock으로 병렬)
1. `[RED]` `tests/api/resume-questions-route.test.ts` 작성 → 실패 확인
2. `[GREEN]` `src/app/api/resume/questions/route.ts` 구현

### Phase 6: lww UI TDD (Phase 5와 병렬 가능)
1. `[RED]` `tests/ui/upload-form.test.tsx` 5개 상태 전이 테스트 작성 → 실패 확인
2. `[RED]` `tests/ui/question-results.test.tsx` 작성 → 실패 확인
3. `[GREEN]` `src/lib/engine-client.ts`
4. `[GREEN]` `src/components/UploadForm.tsx` (상태 머신)
5. `[GREEN]` `src/components/QuestionList.tsx` (카테고리 그룹핑)
6. `[GREEN]` `src/app/resume/page.tsx` (통합) → 테스트 Green

> **Iron Law**: UI 테스트 먼저(step 1-2) → 컴포넌트 구현(step 3-6) 순서 필수

### Phase 7: 통합 검증
1. 엔진 로컬 실행: `uvicorn app.main:app --reload`
2. lww 실행: `ENGINE_BASE_URL=http://localhost:8000 npm run dev`
3. `sample_resume.pdf`로 end-to-end 수동 테스트
4. `.ai.md` 전체 최신화

---

## 리스크

| 리스크 | 대응 |
|--------|------|
| `check_invariants.py` 경로 오류 | Phase 0에서 즉시 수정 |
| LLM JSON 파싱 실패 (prose/markdown 포함) | `output_parser.py`에서 strict 검증 + LLMError |
| multipart Content-Type 헤더 수동 설정 | FormData 그대로 전달, 헤더 미설정 |
| fixtures gitignored → CI 파서 테스트 "가짜 그린" | 필수 테스트는 synthetic fixture, 실제 PDF는 `@pytest.mark.external_fixture` |
| 이미지 전용 PDF 오탐 | 텍스트 0자 + 페이지 존재 → ImageOnlyPDFError |
| status code만으로 에러 키 매핑 불가 (400이 다중 원인) | `detail` 텍스트 파싱으로 키 특정, fallback은 `llmError` |
| CORS 필요 여부 | Next.js API route가 유일 caller (server-to-server) → CORS 불필요. 브라우저 직접 호출 시에만 추가 |
| `Meta.extractedLength` camelCase 매핑 오류 | 라우터에서 `Meta(extractedLength=parsed.extracted_length)` 명시적 키워드 매핑 |
| Phase 4/6 TDD Iron Law 위반 | 각 phase에서 테스트 먼저(RED) → 구현(GREEN) 순서 강제 (위 구현 순서 참고) |

---

## .ai.md 업데이트 목록

완료 후 필수:
- [ ] `engine/.ai.md`
- [ ] `engine/app/.ai.md`
- [x] `engine/app/parsers/.ai.md`
- [x] `engine/app/services/.ai.md`
- [ ] `engine/app/prompts/.ai.md`
- [x] `engine/app/routers/.ai.md`
- [ ] `services/lww/.ai.md`
- [ ] `scripts/check_invariants.py` 주석 업데이트

---

## 아키텍처 불변식 체크

- [ ] `engine/app/routers/`에 인증 로직 없음
- [ ] LLM 호출 → `engine/app/services/llm_service.py`에서만
- [ ] `services/lww/`에 `import anthropic` 없음
- [ ] `services/lww/`에 `import fitz` 없음
- [ ] ENGINE_BASE_URL HTTP 호출만으로 엔진 접근
- [ ] 모든 구현에 pytest/vitest 테스트 포함
- [ ] `scripts/check_invariants.py --check all` 통과
