# [#282] [siw] 서비스 pre-existing 테스트 버그 수정 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] `cd services/siw && npm run test` 전체 통과 — 51 files, 303 tests
- [x] 5개 테스트 파일 수정: `growth-sessions-route.test.ts`, `route.test.ts`, `upload-form.test.tsx`, `growth-page.test.tsx`, `landing-page.test.tsx`
- [ ] `deploy-siw.yml` CI test-siw job 통과 확인 (PR 머지 후)

---

## 구현 계획

> Planner → Architect → Critic 컨센서스 완료 (2026-03-27)

### Principles
1. **테스트는 구현에 동기화** — 구현체가 truth, 테스트를 구현에 맞춘다 (구현 변경 금지)
2. **최소 변경** — 테스트 파일만 수정, 구현 코드/타입 변경 없음
3. **mock 격리** — 각 테스트는 독립적이어야 하며, mock 오염이 없어야 함
4. **실제 텍스트 기준** — assertion은 실제 렌더링되는 텍스트와 정확히 일치해야 함

---

### Step 1: 테스트 실행 → 현재 실패 상태 확인
- `cd services/siw && npm run test` 실행
- 실패 테스트 목록과 에러 메시지를 기록 (특히 `route.test.ts` 실패 여부 확인)

---

### Step 2: API 테스트 수정 (2개 파일)

**2a. `tests/api/growth-sessions-route.test.ts`**

mock 구조 변경 (flat `resumeText` → nested `resume.fileName`):
- `resumeText: "A".repeat(35)` → `resume: { fileName: "A".repeat(35), inferredTargetRole: null }`
- `resumeText: "짧은 이력서"` → `resume: { fileName: "짧은 이력서", inferredTargetRole: null }`
- `resumeText: "가".repeat(35)` → `resume: { fileName: "가".repeat(35), inferredTargetRole: null }`

assertion 변경:
- 모든 `data[N].resumeLabel` → `data[N].resumeFileName`
- `endsWith("…")` truncation assertion 제거, `fileName` 값 직접 비교로 변경 (route가 fileName 그대로 반환)

**2b. `src/app/api/resumes/[id]/__tests__/route.test.ts`**
- Step 1 실행 결과에서 실제 실패 여부 확인 (파일에 이미 `vi.clearAllMocks()` 존재)
- 실패 시: mock을 `mockReturnValueOnce`로 명시적 설정

---

### Step 3: UI 테스트 수정 (3개 파일)

**3a. `tests/ui/upload-form.test.tsx`**
- L41, L92: `"지원 직무가 확인됐어요"` → `"지원 직무 확인"` (UploadForm.tsx:86 기준)
- L74: `placeholder` assertion `"지원 직무를 입력하세요"` → `"직무 미지정"` (UploadForm.tsx:93 기준)

**3b. `tests/ui/growth-page.test.tsx`**
- L52: `resumeLabel: "테스트 이력서 A"` → `resumeFileName: "테스트 이력서 A"`
- L68: `resumeLabel: "테스트 이력서 B"` → `resumeFileName: "테스트 이력서 B"`

**3c. `tests/ui/landing-page.test.tsx`**
- L2(기존 import 바로 다음): `import React from "react"` 추가

---

### Step 4: 전체 테스트 통과 확인
- `cd services/siw && npm run test` 실행
- 0 failures 확인
