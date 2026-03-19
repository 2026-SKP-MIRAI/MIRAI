# feat: [siw] 이력서 피드백 기능 실데이터 연동 — engine /resume/feedback + inferredTargetRole 저장 (#90·#113 기반)

## 사용자 관점 목표
이력서 업로드 시 자동으로 5개 항목 피드백(강점·약점·개선 제안)을 받아 이력서 상세 페이지에서 바로 확인한다.

## 배경
engine #90(POST /api/resume/feedback)과 #113(inferredTargetRole 자동 추론)이 구현됨에 따라 siw에서 실데이터 연동이 필요하다.

현재 siw 구현 상태:
- `/resumes/[id]/page.tsx` 피드백 UI — **완성** (점수 바·강점·약점·개선 제안 모두 렌더링 코드 존재)
- `GET /api/resumes/[id]/feedback` 라우트 — **플레이스홀더** (항상 null 반환, 엔진 연동 주석 있음)
- `ResumeFeedback` 타입 — page.tsx 내 로컬 정의 (types.ts로 이동 필요)
- Resume Prisma 모델 `feedbackJson` 컬럼 — **없음**
- `inferredTargetRole` 컬럼 — **없음**
- 업로드 시 피드백 저장 — **없음**

## 완료 기준
- [ ] `Resume` 모델에 `feedbackJson Json?`, `inferredTargetRole String?` 컬럼 추가 + 마이그레이션 SQL
- [ ] `POST /api/resumes`: 업로드 후 엔진 `/api/resume/feedback` 호출 → `feedbackJson` DB 저장 (inferredTargetRole → targetRole 자동 사용, #113 머지 후 적용)
- [ ] `GET /api/resumes/[id]/feedback`: 저장된 `feedbackJson` 반환 (현재 null 고정 → 실데이터)
- [ ] `ResumeFeedback`, `ResumeFeedbackScores`, `SuggestionItem` 타입을 `src/lib/types.ts`로 이동 (page.tsx 로컬 정의 제거)
- [ ] 기존 응답 형식 유지 (UI 변경 없음 — 이미 완성된 UI 그대로 동작)
- [ ] 테스트 추가 (feedback route GET 200/401/404, POST /api/resumes feedback 저장 검증)
- [ ] `services/siw/.ai.md` 최신화

## 구현 플랜

### 수정 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `prisma/schema.prisma` | Resume 모델에 `feedbackJson Json?`, `inferredTargetRole String?` 추가 |
| `prisma/migrations/` | 신규 마이그레이션 SQL |
| `src/lib/resume-repository.ts` | `create()` feedbackJson·inferredTargetRole 저장, `findDetailById()` feedbackJson 포함 반환 |
| `src/app/api/resumes/route.ts` | POST: 엔진 `/resume/feedback` 호출 추가 (best-effort, 실패해도 업로드 성공 처리) |
| `src/app/api/resumes/[id]/feedback/route.ts` | GET: null 고정 → DB feedbackJson 반환 |
| `src/lib/types.ts` | ResumeFeedback, ResumeFeedbackScores, SuggestionItem 타입 이동 |
| `src/app/(app)/resumes/[id]/page.tsx` | 로컬 타입 정의 제거 → types.ts import |

### 단계별 순서

1. Prisma 스키마 + 마이그레이션
2. `resume-repository.ts` create/findDetailById 수정
3. `POST /api/resumes`: parse → questions(+inferredTargetRole) → `Promise.all([uploadResumePdf, feedback])` → DB 저장
4. `GET /api/resumes/[id]/feedback`: feedbackJson 반환
5. types.ts 타입 이동 + page.tsx import 정리
6. 테스트 + `.ai.md` 최신화

### 의존 관계
- `#119` 머지 후 착수 (engine /parse 연동 — resumeText 획득 방식 변경)
- `#113` 머지 후 inferredTargetRole 저장 가능 (그 전까지는 targetRole을 빈 문자열 또는 "미지정" fallback)

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM·파서 직접 호출 금지, engine만 호출)

---

## 작업 내역

### 2026-03-19

**현황**: 0/7 완료

**완료된 항목**:
- 없음

**미완료 항목**:
- Resume 모델 feedbackJson/inferredTargetRole 컬럼 추가 + 마이그레이션
- POST /api/resumes feedback 호출 → DB 저장
- GET /api/resumes/[id]/feedback 실데이터 반환
- ResumeFeedback 타입 types.ts 이동
- 기존 응답 형식 유지
- 테스트 추가
- services/siw/.ai.md 최신화

**변경 파일**: 0개 (구현 대기 — 세션 재시작)

