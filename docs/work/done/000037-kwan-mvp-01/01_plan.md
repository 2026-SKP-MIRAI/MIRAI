# [#37] feat: kwan 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end — 구현 계획

> 작성: 2026-03-09

---

## 완료 기준

- [x] `services/kwan/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [x] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [x] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [x] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [x] 에러 처리: 400/422/500 한국어 안내
- [x] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트) — 15/15 통과
- [x] `services/kwan/.ai.md` 최신화 (구조·진행 상태 반영)
- [x] 불변식 준수: `services/kwan/`에 `import anthropic` / `import fitz` 없음

---

## 구현 계획

### 디렉토리 구조 (DDD)

```
services/kwan/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                          ← UploadForm + QuestionList 조합
│   │   └── api/resume/questions/route.ts     ← 엔진 HTTP 포워딩 라우트
│   ├── domain/interview/
│   │   └── types.ts                          ← Category, Question, GenerateResult, UploadState
│   ├── components/
│   │   ├── UploadForm.tsx                    ← idle→uploading→processing 상태 처리
│   │   └── QuestionList.tsx                  ← 카테고리별 그룹핑, "다시 하기" 버튼
│   └── lib/
│       └── engine-client.ts                  ← ENGINE_BASE_URL fetch 래퍼 (30s timeout)
├── tests/
│   ├── setup.ts
│   ├── api/resume-questions.test.ts          ← route.ts 단위 테스트 (fetch mock)
│   └── components/
│       ├── UploadForm.test.tsx
│       └── QuestionList.test.tsx
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── next.config.ts
└── .env.local                                ← ENGINE_BASE_URL=http://localhost:8000 (커밋 제외)
```

### 구현 순서 (TDD: Red → Green → Refactor)

1. **Step 1**: Next.js 프로젝트 초기화 (`create-next-app`) + Vitest 설치
2. **Step 2**: 타입 정의 (`domain/interview/types.ts`)
3. **Step 3**: 엔진 HTTP 클라이언트 (`lib/engine-client.ts`)
4. **Step 4**: API 라우트 TDD → `tests/api/resume-questions.test.ts` 작성 → `route.ts` 구현
5. **Step 5**: UploadForm TDD → `tests/components/UploadForm.test.tsx` → `UploadForm.tsx`
6. **Step 6**: QuestionList TDD → `tests/components/QuestionList.test.tsx` → `QuestionList.tsx`
7. **Step 7**: 메인 페이지 연결 (`app/page.tsx`)
8. **Step 8**: `.ai.md` 최신화

### 검증

```bash
pnpm test           # 15/15 통과
grep -r "anthropic|fitz" src/  # 결과 없음
```
