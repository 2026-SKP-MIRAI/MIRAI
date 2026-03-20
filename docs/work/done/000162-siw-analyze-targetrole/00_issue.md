# feat: [siw] 직무 확인·수정 UI 추가 — engine /analyze 연동, targetRole 2-step 흐름 (#113 후속)

## 사용자 관점 목표
자소서 업로드 후 AI가 추론한 지원 직무를 확인·수정하고, 확정된 직무 기준으로 자소서 피드백과 면접 질문을 받을 수 있다.

## 배경
이슈 #113에서 engine에 `/api/resume/analyze`(PDF → resumeText + targetRole 동시 반환)가 추가됐으나, siw는 여전히 `/api/resume/parse`를 사용하고 있다.
현재 `POST /api/resumes`의 `targetRole`은 클라이언트에서 전달하지 않아 **모든 사용자의 피드백이 "소프트웨어 개발자" 고정**으로 호출되는 버그가 있다.
(`route.ts:61` — `formData.get("targetRole") ?? "소프트웨어 개발자"`)

## 완료 기준
- [x] `POST /api/resumes/analyze` 신규 라우트 — engine `/api/resume/analyze` 프록시, `{ resumeText, targetRole }` 반환
- [x] `POST /api/resumes` — `/parse` 호출 제거, 클라이언트가 formData로 `targetRole` 전달하는 기존 구조 활용
- [x] `UploadForm.tsx` 2-step 상태머신: `uploading(/analyze) → confirming(직무 확인·수정) → submitting(/resumes)`
- [x] targetRole `"미지정"` 반환 시 input placeholder로 직접 입력 유도, 빈 값도 허용 (engine이 "미지정 직무" fallback 처리)
- [x] `UploadState`에 `"confirming" | "submitting"` 추가
- [x] 테스트 포함 (API 라우트 + UploadForm UI)
- [x] `services/siw/.ai.md` 최신화

## 추가 완료 기준 (세션 중 발견·요청)
- [x] analyze route timeout 55s 증가 + TimeoutError → 504 처리
- [x] 직무 확인 UI 리디자인 — gradient card, 편집 가능 input (텍스트 길이 자동 조절), focus ring
- [x] "면접을 준비하고 있습니다" → "이력서를 분석하고 있습니다"
- [x] PDF 안내 문구 삭제
- [x] 면접관 소개 난이도 표시 제거 (`interview/new/page.tsx`)
- [x] 이력서 업로드 완료 후 `/resumes/${resumeId}` 리다이렉션 (기존 `/interview/new?resumeId=...`)
- [x] `resumes/[id]/page.tsx` 수정 버튼 삭제
- [x] `resumes/[id]/page.tsx` 희망 직무 badge 표시 (API + UI)
- [x] `handleStart` catch 블록 추가 — 네트워크 에러 시 `startError` 표시
- [x] dashboard LLM 운영 현황 카드 관리자 전용(`isAdmin`) 조건부 렌더링
- [x] engine `interview_hr_v2.md` — STAR 약어 `(S)(T)(A)(R)` 질문 출력 금지
- [x] engine `interview_service.py` — `question` 필드 dict 반환 시 방어 처리

## 구현 플랜

### 변경 파일 (4개)

| 파일 | 내용 |
|------|------|
| `src/app/api/resumes/analyze/route.ts` | **신규** — engine `/api/resume/analyze` 프록시 (multipart, timeout 35s) |
| `src/app/api/resumes/route.ts` | `/parse` 호출 블록 제거. formData의 `targetRole` 그대로 수신 (기존 코드 활용) |
| `src/components/UploadForm.tsx` | 2-step 상태머신 구현 |
| `src/lib/types.ts` | `UploadState`에 `"confirming" \| "submitting"` 추가 |

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
  → submitting     ("면접 준비 중...", POST /api/resumes with targetRole ~30s)
  → done           → onComplete(data) → router.push(/interview/new?resumeId=...)
```

### 구현 순서
1. `types.ts` — UploadState 타입 확장
2. `resumes/analyze/route.ts` 신규 생성 (engine /analyze 프록시)
3. `resumes/route.ts` — /parse 블록 제거 (targetRole formData 수신은 유지)
4. `UploadForm.tsx` — confirming 단계 UI + 상태머신 연결
5. 테스트 작성 (analyze route + UploadForm confirming 단계)
6. `.ai.md` 최신화

## 참고
- engine `/api/resume/analyze` 타임아웃: LLM 내부 15s → 클라이언트 fetch timeout **35s 이상** 권장
- targetRole `"미지정"` 반환 시 UX 막힘 없이 진행 가능 (engine `/feedback`이 optional 처리)
- `resumes/page.tsx`의 `onComplete` 시그니처 변경 불필요

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-20

**현황**: 7/7 완료 ✅

**완료된 항목**:
- `POST /api/resumes/analyze` 신규 라우트 — engine `/api/resume/analyze` 프록시, 35s timeout, withEventLogging('resume_analyze')
- `POST /api/resumes` — `/parse` 블록 완전 제거, `resumeText` formData 수신, `/questions`에 `targetRole` 추가 전달, `inferredTargetRole` DB 저장
- `UploadForm.tsx` 2-step 상태머신 — handleAnalyze(Step1) + handleConfirmSubmit(Step2), confirming UI, "지원 직무가 다르다면 수정해주세요" 안내
- targetRole `"미지정"` → value="" + placeholder 유도, 빈 값 제출 허용 (AC4)
- `UploadState`에 `"confirming" | "submitting"` 추가, `AnalyzeResult` 타입 추가
- 테스트 29/29 통과 (T1 신규 8케이스, T2 수정 2케이스 추가, T3 전면 수정 7케이스)
- `services/siw/.ai.md` 최신화

**변경 파일**: 5개 소스 + 3개 테스트
| 파일 | 변경 내용 |
|------|---------|
| `src/lib/types.ts` | UploadState 확장, AnalyzeResult 추가 |
| `src/lib/observability/event-logger.ts` | resume_analyze feature_type 추가 |
| `src/app/api/resumes/analyze/route.ts` | **신규** engine /analyze 프록시 |
| `src/app/api/resumes/route.ts` | /parse 블록 제거, resumeText formData 수신 |
| `src/components/UploadForm.tsx` | 2-step 상태머신 구현 |
| `tests/api/resumes-analyze-route.test.ts` | **신규** 8케이스 |
| `tests/api/resumes-route.test.ts` | /parse 미호출 + resumeText 전달 검증 추가 |
| `tests/ui/upload-form.test.tsx` | 2-step UX 반영 전면 수정 |

**구현 방식 (해결책 C)**:
- UploadForm이 `/analyze` 응답의 `resumeText`를 useState에 저장
- `/resumes` POST 시 `file + targetRole + resumeText` formData로 재전송
- route.ts stateless 유지, /parse 완전 제거

**추가 발견 사항 (플랜에서 누락됐던 것)**:
- `/questions` 호출에도 `targetRole` 추가 전달 (직무 맥락 반영)
- `inferredTargetRole` DB 저장 (Prisma 스키마 이미 준비됨)
- `event-logger.ts`에 `resume_analyze` feature_type 추가 필요
