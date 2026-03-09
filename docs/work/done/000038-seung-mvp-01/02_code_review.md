# [#38] services/seung 코드 리뷰 — 전문가가 초심자에게 설명하는 식으로

> 작성: 2026-03-09  
> 대상: `services/seung` (자소서 기반 모의면접 MVP 01)

---

## 1. 이 서비스가 하는 일 (한 문장)

**"PDF 자소서를 올리면, MirAI 엔진이 분석해서 예상 면접 질문을 카테고리별로 만들어 주는 화면"**이다.  
화면은 **한 페이지**에서 **업로드 화면 → 결과 화면**으로만 전환된다.

---

## 2. 화면 구성 — 사용자가 보는 것

### 2-1. 전체 레이아웃

```
┌─────────────────────────────────────────────────────────┐
│  [헤더] MirAI — 면접 질문 생성                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [메인 영역]                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │  state ≠ 'done' 일 때 → 업로드 폼 박스            │   │
│  │  state === 'done' 일 때 → 질문 리스트 + 다시하기   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **헤더**: 항상 고정. "MirAI — 면접 질문 생성"만 표시.
- **메인**: `state`에 따라 **두 가지 화면 중 하나**만 보여 준다.
  - **업로드 화면**: PDF 선택 + "질문 생성" 버튼 + (에러 시) 에러 메시지
  - **결과 화면**: "예상 면접 질문 (N개)" + 카테고리별 질문 목록 + "다시 하기" 버튼

즉, **단일 페이지에서 상태(`state`)로 화면을 전환**하는 구조라고 보면 된다.

### 2-2. 업로드 화면 (state: idle / uploading / processing / error)

- **제목**: "자소서 분석"
- **설명**: "PDF 자소서를 업로드하면 예상 면접 질문을 카테고리별로 생성합니다."
- **PDF 파일 선택**: `<input type="file" accept=".pdf,application/pdf">` 하나.
- **선택한 파일명**: 파일을 고르면 작은 회색 글씨로 파일명 표시.
- **버튼**:
  - `idle` + 파일 선택됨 → "질문 생성"
  - `uploading` → "업로드 중..."
  - `processing` → "자소서를 분석하고 있습니다..."
  - 이때 버튼은 비활성화되고 스피너 아이콘 표시.
- **에러 시**: `state === 'error'`이면 `role="alert"` 빨간 박스로 한글 에러 메시지 표시.

### 2-3. 결과 화면 (state: done)

- **제목**: "예상 면접 질문 (N개)"
- **다시 하기**: 오른쪽 상단. 누르면 `state`가 `idle`로 돌아가 업로드 화면으로 복귀.
- **카테고리별 섹션**:  
  예) "직무역량", "인성" 같은 **카테고리 제목(파란색, 대문자)** 아래에 해당 질문들이 리스트로 나열된다.

---

## 3. 데이터·상태 흐름 — "누가 무엇을 알고 있는가"

### 3-1. 상태는 모두 `page.tsx`에 있음

```ts
const [state, setState] = useState<UploadState>('idle')       // 화면 단계
const [errorMessage, setErrorMessage] = useState<string>('')   // 에러 문구
const [result, setResult] = useState<QuestionsResponse | null>(null)  // 엔진 응답
```

- **state**: `'idle' | 'uploading' | 'processing' | 'done' | 'error'`  
  → "지금 어떤 단계인지"를 나타내고, 그에 따라 **어떤 UI를 보여 줄지**가 결정된다.
- **errorMessage**: 에러일 때 사용자에게 보여 줄 한글 메시지.
- **result**: 엔진에서 받은 `{ questions, meta }`. `done`일 때만 사용하고, `QuestionList`에 넘긴다.

자식 컴포넌트(`UploadForm`, `QuestionList`)는 **props만** 받고, 직접 상태를 가지지 않는다.  
즉, **단일 진실 공급원(Single Source of Truth)**이 `page.tsx` 한 곳에 있다고 보면 된다.

### 3-2. 사용자 액션 → 상태 변경

1. **파일 선택 후 "질문 생성" 클릭**
   - `UploadForm`이 `onSubmit(file)` 호출
   - `page.tsx`의 `handleSubmit(file)` 실행
   - `setState('uploading')` → 곧바로 `setState('processing')`  
     (실제로는 업로드와 처리 구분 없이 "진행 중" 하나로 보여 줌)
   - `fetch('/api/resume/questions', { method: 'POST', body: formData })` 호출

2. **API 성공 시**
   - `setResult(data)`, `setState('done')`  
   - 메인 영역이 `QuestionList`로 바뀌고, `result.questions`를 카테고리별로 그려 준다.

3. **API 실패 시**
   - `ERROR_MESSAGES[response.status]` 또는 `DEFAULT_ERROR_MESSAGE`로 메시지 설정
   - `setErrorMessage(...)`, `setState('error')`  
   - 업로드 폼이 그대로 보이면서 빨간 에러 박스만 나타난다.

4. **"다시 하기" 클릭**
   - `handleReset()`: `state → 'idle'`, `errorMessage → ''`, `result → null`  
   - 다시 업로드 폼만 보이는 처음 화면으로 돌아간다.

---

## 4. 파일별 역할 — "이 파일은 이렇게 쓰인다"

### 4-1. `src/app/page.tsx` — "화면의 뇌"

- **역할**:
  - 전체 **상태**(`state`, `errorMessage`, `result`) 보관
  - **이벤트 핸들러**(`handleSubmit`, `handleReset`) 정의
  - **조건부 렌더링**: `state !== 'done'`이면 업로드 블록, `state === 'done'`이면 `QuestionList`
- **특징**: `'use client'`로 클라이언트 컴포넌트. `useState`를 쓰기 위함.
- **설계**: 한 페이지에서 "업로드 → 결과"만 전환하므로, 별도 라우트 없이 상태만으로 화면을 나누는 구조다.

### 4-2. `src/app/layout.tsx` — "공통 껍데기"

- **역할**:
  - 모든 페이지에 공통 적용되는 **HTML/body**
  - **폰트**: Geist Sans / Geist Mono (Next.js `next/font`)
  - **메타**: title, description (현재는 기본 "Create Next App")
- **특징**: `page.tsx`는 이 레이아웃의 `children`으로 들어가서, 헤더/메인 구조는 `page.tsx` 안의 JSX가 담당한다.

### 4-3. `src/components/UploadForm.tsx` — "업로드 UI만 담당"

- **역할**:
  - PDF `<input>`, 선택된 파일명 표시, 제출 버튼, 에러 메시지 영역
  - **표시 상태**는 전부 **props**로 받음: `state`, `errorMessage`, `onSubmit`
- **내부 상태**:
  - `selectedFile`: 지금 선택된 File 객체
  - `inputRef`: `<input type="file">` 참조 (테스트/포커스용)
- **버튼 문구**: `state`가 `uploading` / `processing`이면 "업로드 중...", "자소서를 분석하고 있습니다..."로 바꾸고, 그때는 버튼 비활성화 + 스피너.
- **접근성**: `role="alert"`로 에러 메시지, `aria-label="PDF 파일"`로 파일 입력 필드 표시.

즉, "**어떤 단계인지, 어떤 에러인지**"는 부모가 정해 주고, **업로드 UI와 로딩/에러 표시**만 담당하는 **Presentational 컴포넌트**에 가깝다.

### 4-4. `src/components/QuestionList.tsx` — "결과만 보여 주기"

- **역할**:
  - `questions: Question[]`를 받아서 **카테고리별로 그룹**
  - 그룹별로 섹션(제목 + 리스트) 렌더
  - "다시 하기" 버튼 → `onReset()` 호출
- **로직**: `groupByCategory(questions)`로 `Record<카테고리명, Question[]>` 만들고, `Object.entries`로 순회하며 렌더.
- **특징**:
  - 데이터를 바꾸지 않고 "보여 주기만" 함
  - `key={idx}` 사용 (같은 카테고리 내에서만 사용하므로 실무에서는 `q.question` 등 안정된 key를 쓰는 편이 더 안전할 수 있음).

### 4-5. `src/app/api/resume/questions/route.ts` — "Next.js → 엔진 연결"

- **역할**:
  - 클라이언트가 `POST /api/resume/questions` + `FormData(file)` 로 보내면
  - 이 라우트가 **엔진** `ENGINE_BASE_URL/api/resume/questions` 로 **그대로 포워딩**
- **흐름**:
  1. `request.formData()` 로 body 파싱
  2. `file` 없으면 400
  3. `ENGINE_BASE_URL` 없으면 500
  4. 엔진에 `fetch(engineUrl + '/api/resume/questions', { method: 'POST', body: engineFormData })`
  5. 엔진 응답의 `status`와 `data`를 **그대로** `NextResponse.json(data, { status })` 로 클라이언트에 전달
- **에러 처리**:
  - formData 파싱 실패 → 400
  - fetch 자체 실패(네트워크 등) → 500
  - 나머지(400/422/500 등)는 엔진 status를 그대로 전달

즉, **서비스(Next.js)는 인증/세션만 담당하고, 실제 "PDF 파싱 + 질문 생성"은 엔진에 맡기는** 구조다. 레포 규칙의 "외부 AI/파서는 엔진에서만"에 맞게 동작한다.

### 4-6. `src/lib/types.ts` — "계약서"

- **Question**: `{ category, question }`
- **QuestionsResponse**: `{ questions: Question[], meta: { extractedLength, categoriesUsed } }`
- **UploadState**: `'idle' | 'uploading' | 'processing' | 'done' | 'error'`
- **ERROR_MESSAGES**: 400/413/422/500에 대응하는 **한글 메시지**  
  → 클라이언트와 API 라우트 모두 "같은 의미의 메시지"를 쓰기 위한 상수.

엔진 응답 형태와 화면 상태를 타입으로 고정해 두어, **엔진–API–프론트** 사이의 계약이 한 곳에 정의되어 있다.

### 4-7. `src/app/globals.css` — "전역 스타일"

- Tailwind v4 `@import "tailwindcss"`
- `:root` 에 `--background`, `--foreground`
- `@theme inline` 로 Tailwind에 `--color-background`, `--color-foreground`, 폰트 변수 연결
- 다크 모드 시 변수만 바꾸고, 실제 페이지는 주로 Tailwind 유틸 클래스(`bg-gray-50`, `text-gray-900` 등)로 스타일링.

---

## 5. 테스트 전략 — "무엇을 어떻게 검증하는가"

### 5-1. API 라우트 (`tests/api/questions.test.ts`)

- **도구**: Vitest, `NextRequest` 모킹.
- **대상**: `POST /api/resume/questions` **핸들러만** (실제 HTTP 서버 부트 없이 `POST` 함수 직접 호출).
- **검증**:
  - 파일 없음 → 400
  - 엔진 200 → 200 그대로, body에 `questions`
  - 엔진 400/422/500 → 같은 status 그대로
  - `fetch` 예외(네트워크 오류) → 500
- **의미**: "Next 앱이 엔진을 어떻게 호출하고, 상태 코드를 어떻게 전달하는지"를 단위 테스트로 보장.

### 5-2. 컴포넌트 테스트 (Vitest + Testing Library)

- **UploadForm**:  
  - state별 버튼 문구, 비활성화, 에러 메시지 표시, `onSubmit` 호출 여부 등.
- **QuestionList**:  
  - 질문 개수 표시, 카테고리 그룹핑, "다시 하기" 시 `onReset` 호출 등.
- **의미**: "props에 따라 UI가 올바르게 바뀌는지"를 검증. E2E보다 빠르고 안정적.

### 5-3. E2E (`tests/e2e/upload-flow.spec.ts`, Playwright)

- **실제 브라우저**에서 `/` 접속.
- **API는 모킹**: `page.route('**/api/resume/questions', ...)` 로 200/422/500 응답을 가짜로 주고, **엔진 없이** 전체 플로우만 검증.
- **시나리오**:
  - 성공: PDF 선택 → 질문 생성 → "예상 면접 질문 (3개)" + 카테고리 + 질문 텍스트 노출
  - 422: 에러 메시지 "텍스트를 읽을 수 없는 PDF입니다."
  - 500: "서버 오류가 발생했습니다."
  - 다시 하기: 결과 화면에서 "다시 하기" 클릭 후 업로드 폼 복귀
- **의미**: "사용자가 겪는 전체 경로"가 설계대로 동작하는지 확인.

### 5-4. 실제 엔진 연동 E2E (`tests/e2e/real-flow.spec.ts`, Playwright)

- **실제 브라우저 + 실제 엔진**: 엔진 서버(`http://localhost:8000`)가 실행 중인 상태에서 진행.
- **API 모킹 없음**: 실제 PDF를 업로드해 LLM이 질문을 생성하는 end-to-end 흐름 전체 검증.
- **영상 녹화**: `playwright.config.ts`의 `video: 'on'`으로 항상 녹화 — `test-results/` 에 `.webm` 저장.
- **타임아웃**: LLM 응답 대기를 고려해 60초로 설정.
- **시나리오**: PDF 선택 → "질문 생성" → "예상 면접 질문" 표시 → 질문 1개 이상 렌더 확인.
- **의미**: "실제 사용자 환경과 동일하게, 엔진이 진짜 질문을 만들어 화면에 뜨는지"를 검증. 통합 테스트 역할.

---

## 6. 정리 — "초심자에게 전달하고 싶은 포인트"

| 구분 | 설명 |
|------|------|
| **화면** | 한 페이지에서 "업로드 폼 ↔ 결과(질문 리스트)"만 전환되고, 전환 기준은 `state` 하나. |
| **상태** | 모든 상태는 `page.tsx`에만 있고, 자식은 props로 받아서 "보여 주기/이벤트 전달"만 함. |
| **역할 분리** | UploadForm = 업로드 UI, QuestionList = 결과 UI, API route = 엔진 프록시, types = 공통 계약. |
| **에러** | 상태 코드별 한글 메시지를 `types.ts`에 두고, 클라이언트와 API가 같은 메시지를 사용. |
| **테스트** | API 단위 → 컴포넌트 단위 → E2E(API 모킹) 순으로, "엔진 없이도" 전체 플로우를 검증 가능. |

이렇게 구성되어 있어서, **화면은 단순하지만 상태 흐름이 명확하고**, **엔진과의 역할 분리(레포 불변식)**도 지키면서, **테스트로 동작을 보장**하는 구조라고 보면 된다.
