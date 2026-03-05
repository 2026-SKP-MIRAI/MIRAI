# engine 공개 계약 (Public Interface)

> 서비스 개발자가 엔진 내부 코드를 보지 않고 이 파일만으로 엔진을 쓸 수 있어야 한다.
> 계약 변경 시 → 멘토와 합의 후 이 파일 먼저 수정.

---

## 불변식 (서비스 개발자 필독)

```
PDF 파싱   → engine/parsers/  에서만 (직접 pdf-parse 호출 금지)
LLM 호출   → engine/services/ 에서만 (직접 Anthropic SDK 호출 금지)
```

서비스에서는 아래 함수만 import한다.

---

## 타입 정의

```typescript
// ─── 카테고리 ────────────────────────────────────────────────────────────────

export type Category =
  | '직무 역량'
  | '경험의 구체성'
  | '성과 근거'
  | '기술 역량'

// ─── parsers ─────────────────────────────────────────────────────────────────

export interface ParseResult {
  text: string          // 추출된 전체 텍스트
  pageCount: number     // PDF 페이지 수
  characterCount: number
}

// ─── services ────────────────────────────────────────────────────────────────

export interface Question {
  category: Category
  question: string
}

export interface GenerateOptions {
  maxQuestions?: number     // 기본값: 20  (카테고리당 2~5개)
  categories?: Category[]   // 기본값: 4개 전체
}

export interface GenerateResult {
  questions: Question[]
  meta: {
    extractedLength: number      // 전달된 텍스트 글자 수
    categoriesUsed: Category[]
  }
}

// ─── 에러 ─────────────────────────────────────────────────────────────────────

export class ParseError extends Error {}      // PDF 파싱 실패 (손상·암호화 등)
export class FileSizeError extends Error {}   // 5 MB 초과
export class PageLimitError extends Error {}  // 10 페이지 초과
export class LLMError extends Error {}        // Claude API 오류
```

---

## parsers API

### `parseResumePDF(buffer: Buffer): Promise<ParseResult>`

PDF Buffer를 받아 텍스트를 추출한다.

| 조건 | 동작 |
|------|------|
| 파일 크기 > 5 MB | `FileSizeError` throw |
| 페이지 수 > 10 | `PageLimitError` throw |
| 손상·암호화 PDF | `ParseError` throw |

```typescript
import { parseResumePDF } from '@/engine/parsers'

const result = await parseResumePDF(buffer)
// result.text         → 자소서 전문
// result.pageCount    → 3
// result.characterCount → 4200
```

---

## services API

### `generateInterviewQuestions(text: string, options?: GenerateOptions): Promise<GenerateResult>`

자소서 텍스트를 받아 카테고리별 맞춤 예상 질문을 생성한다.

| 조건 | 동작 |
|------|------|
| Claude API 오류 | `LLMError` throw |
| text가 빈 문자열 | `LLMError` throw |
| text > 16,000자 | 내부에서 자동 잘라서 사용 (서비스 측 처리 불필요) |

```typescript
import { generateInterviewQuestions } from '@/engine/services'

const result = await generateInterviewQuestions(text)
// result.questions → [{ category: '직무 역량', question: '...' }, ...]
// result.meta      → { extractedLength: 4200, categoriesUsed: [...] }

// 카테고리 제한 예시
const result2 = await generateInterviewQuestions(text, {
  categories: ['직무 역량', '기술 역량'],
  maxQuestions: 10,
})
```

---

## 서비스에서의 전형적인 사용 패턴

```typescript
// services/siw/app/api/resume/questions/route.ts (예시)

import { parseResumePDF, ParseError, FileSizeError, PageLimitError } from '@/engine/parsers'
import { generateInterviewQuestions, LLMError } from '@/engine/services'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  const buffer = Buffer.from(await file.arrayBuffer())

  let parsed
  try {
    parsed = await parseResumePDF(buffer)
  } catch (e) {
    if (e instanceof FileSizeError) return Response.json({ error: '5MB 이하 파일만 업로드 가능합니다.' }, { status: 400 })
    if (e instanceof PageLimitError) return Response.json({ error: '10페이지 이하 PDF만 지원합니다.' }, { status: 400 })
    if (e instanceof ParseError) return Response.json({ error: 'PDF를 읽을 수 없습니다.' }, { status: 400 })
    throw e
  }

  try {
    const result = await generateInterviewQuestions(parsed.text)
    return Response.json(result)
  } catch (e) {
    if (e instanceof LLMError) return Response.json({ error: '질문 생성 중 오류가 발생했습니다.' }, { status: 500 })
    throw e
  }
}
```

---

## import 경로

```
engine/parsers/index.ts  → import from '@/engine/parsers'
engine/services/index.ts → import from '@/engine/services'
```

> `@/` alias는 각 서비스 `tsconfig.json`의 `paths` 설정 기준.
> 설정이 없으면 멘토에게 확인.

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|-----------|
| 2026-03-01 | 초안 작성 (MVP 범위: PDF 파싱 + 질문 생성) |
