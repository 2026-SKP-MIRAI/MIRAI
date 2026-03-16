# [#89] feat: 이력서 영속 저장 — Supabase Storage 업로드 + Resume Prisma 모델 + per-user 조회 (siw) — 구현 계획

> 작성: 2026-03-15
> 검토: 2026-03-15 (architect × security × code-reviewer 3-way 검토 완료)

---
지금 작업하다가 중간에 니가 꺼져서 npm run dev도 안돼 그리고 방금 대시보드에서 면접 결과 누를때마다 면접 리포트 생성하는거 이거 db에 저장하는 기능 구현하고 있었고 
바로 작업 후에 supabase prisma db push까지 하라고 했어 그리고 내 이력서 /resumes에서 성장 요약에서 이력서별 성장 요약 보기로 했고 
## 검토 결과 요약

### ❌ Must-Fix (구현 시 반드시 포함)

1. **GET /api/resumes/[id] 인증 가드 없음 (IDOR)** — 현재 `[id]/route.ts`에 `getUser()` 없음. ID만 알면 비로그인도 타인의 resumeText 열람 가능. `getUser()` + `userId` 필터 필수. (#88에서 다른 5개 라우트는 처리됐으나 이 라우트는 누락됨)

### ⚠️ 구현 시 인지 필요 (Should-Fix)

2. **GET /api/resumes 응답 필드명** — 현재 프론트엔드 3곳(`/resumes`, `/interview/new`, `/dashboard`)이 `uploadedAt` + `questionCount` 참조. 플랜 응답을 `createdAt`/`questionsCount`로 바꾸면 타입 에러. → API 응답에서 `uploadedAt`(=`createdAt` alias), `questionCount` 필드명 유지하거나 프론트 `ResumeItem` 타입 함께 수정.

3. **resume-repository.ts 전면 재작성** — 현재 4개 메서드 모두 `ResumeSession` 기반. `create()` 시그니처가 `(resumeText)` → `(userId, fileName, storageKey, resumeText, questions)` 5필드로 확장. 호출처 2곳 수정 필요.

4. **vitest — Supabase Storage mock 추가 필요** — `POST /api/resumes`는 Storage 업로드 포함. `supabaseClient.storage.from().upload()` mock 패턴 신규 추가 필요 (기존 테스트에 없음).

5. **ResumeSession 삭제 영향 파일 5개** — `schema.prisma`, 기존 migration SQL, `resume-repository.ts`, `GET /api/resumes route.ts` 주석, `resume-questions-route.test.ts` mock. 모두 정리 필요.

### ✅ 확인된 사항 (이슈 아님)

- **RLS 타입**: `auth.uid()::text = user_id` 패턴은 #88에서 확립됨 → Step 6 SQL도 동일 패턴 적용
- **SUPABASE_SERVICE_ROLE_KEY**: #88에서 클라이언트 번들 노출 감사 완료, API Route에서만 사용 확인됨
- **InterviewSession.resumeId**: nullable → 기존 세션 데이터 안전, 기존 코드 수정 불필요
- **아키텍처 불변식 5가지**: 위반 없음
- **UploadForm 연동**: URL 변경(`/api/resume/questions` → `/api/resumes`)만으로 응답 형태 호환 가능

---

## 완료 기준

- [x] `Resume` Prisma 모델 추가 + `prisma migrate dev`
- [x] `POST /api/resumes` — PDF → Supabase Storage 업로드 + DB 저장 (resumeText, questions, fileName, storageKey, userId)
- [x] `GET /api/resumes` — 로그인 유저의 이력서 목록 반환 (mock → 실 DB)
- [x] `GET /api/resumes/[id]` — 이력서 단건 조회 (resumeText + questions)
- [x] `/resumes` 페이지 — 실 DB 데이터 연결 (이슈 #87 mock → 실 데이터)
- [x] `/interview/new` 자소서 선택 — 저장된 이력서 목록 API 연동
- [x] `InterviewSession`에 `resumeId` 필드 추가 → Resume 모델 참조
- [x] RLS: `resumes` 테이블 (`auth.uid()::text = user_id`) SQL 마이그레이션 — #88 패턴 준수
- [x] vitest: `POST /api/resumes`, `GET /api/resumes`, `GET /api/resumes/[id]` 테스트
- [x] 테스트 코드 포함
- [x] `services/siw/.ai.md` 최신화 (Resume 모델, Storage 업로드 흐름 반영)
- [x] `SUPABASE_STORAGE_BUCKET` 환경변수 하드코딩 없음
- [x] `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 번들 노출 없음
- [x] 불변식 위반 없음
- [x] `ResumeSession` 모델 정리 (deprecated 처리 또는 삭제)

---

## 구현 계획

### Step 1 — `Resume` Prisma 모델 (`prisma/schema.prisma`)

- `Resume` 모델 추가: id, userId, fileName, storageKey, resumeText, questions(Json), createdAt
- `InterviewSession`에 `resumeId String? @db.Uuid` + relation 추가
- `ResumeSession` 모델 deprecated 처리 (데이터 없으면 삭제)
- `prisma migrate dev --name add-resume-model` 실행

### Step 2 — Supabase Storage 업로드 헬퍼 (`src/lib/resume-storage.ts`)

- `uploadResumePdf(userId, buffer, fileName)` → storageKey 반환
- 버킷명: `process.env.SUPABASE_STORAGE_BUCKET` (하드코딩 금지)
- 서버 경유 업로드 (service role key 사용, 클라이언트 번들 노출 금지)

### Step 3 — API Routes 개편

- `POST /api/resumes`: `getUser()` 인증 가드 → multipart → 엔진 호출 → Storage 업로드 → Prisma Resume 생성. `maxDuration = 60` 설정 (엔진 호출 + Storage 업로드 포함)
- `GET /api/resumes`: `getUser()` 인증 가드 → userId 기반 Resume.findMany. 응답 필드명 기존 프론트 타입과 맞춤 (`uploadedAt`, `questionCount`)
- `GET /api/resumes/[id]`: **❌ Must-Fix** `getUser()` 인증 가드 필수 → `Resume.findFirst({ where: { id, userId: user.id } })` (userId 필터 없으면 IDOR). 404: 미존재 or 타인 소유

### Step 4 — UploadForm 연동

- `POST /api/resumes` 응답에 `resumeId` 포함
- `UploadForm.tsx` → `QuestionsResponse.resumeId` 실제 값 사용

### Step 5 — `/resumes` 페이지 + `/interview/new` 실 데이터 연결

- `/resumes`: `GET /api/resumes` 실 호출 (mock 교체)
- `/interview/new` 자소서 선택: 동일 API 연동

### Step 6 — RLS SQL 마이그레이션

#88 패턴(`auth.uid()::text`) 준수. Prisma는 `auth.uid()` 컨텍스트 없이 직접 DB 연결하므로 리포지토리 레벨 userId 필터가 primary, RLS는 추가 방어층.

```sql
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_resumes"
  ON resumes FOR ALL
  USING (auth.uid()::text = user_id);
```

### Step 7 — vitest 테스트

- `tests/api/resumes-route.test.ts`: POST 200/400/401, GET 200/401, GET[id] 200/404

---

## 추가 작업 (2026-03-16 세션)

### Step 8 — 면접 리포트 DB 저장 캐시 (`reportJson`)

- `InterviewSession`에 `reportJson Json?` 컬럼 추가 (`migration: 20260316000001_add_report_json`)
- `interview-repository.ts`: `saveReport(id, userId, scores, totalScore, reportJson)` — `userId` 필터로 IDOR 방어
- `report/generate/route.ts`:
  - `findById(sessionId, user.id)` — DB 레벨 userId 필터 (fetch-then-check 패턴 제거)
  - 캐시 체크: `session.sessionComplete && session.reportJson` → 즉시 반환
  - 엔진 호출 후 best-effort `saveReport` (1회 재시도)
- `prisma db push` 완료

### Step 9 — `/resumes/[id]` 상세 페이지 신규 API Routes

- `GET /api/resumes/[id]/sessions` — 해당 이력서로 완료된 면접 목록 (scores 포함)
- `GET /api/resumes/[id]/download` — Supabase Storage signed URL (60초)
- `GET /api/resumes/[id]/feedback` — Resume feedback (현재 null 반환, 엔진 endpoint 추가 시 연동 예정)

### Step 10 — `/growth` 페이지 개선

- `/api/growth/sessions`: `axisFeedbacks` 포함 반환 (`reportJson.axisFeedbacks` 파싱)
- `GrowthSession` 타입에 `axisFeedbacks?: AxisFeedback[]` 추가
- "AI 개선 추천" 섹션 제거 (이력서별 개선점은 `/resumes/[id]`에서 확인)

### Step 11 — 사이드바 버튼 클리핑 수정

- 데스크탑 사이드바 wrapper에서 `overflow-hidden` 제거 → 접기 버튼(`-right-3.5`) 정상 표시

### Step 12 — 보안 수정 (code-reviewer 검토 결과)

- `findById(sessionId, user.id)`: DB 레벨 ownership 필터 적용
- `saveReport`: `userId` 파라미터 추가 + `where: { id, userId }` 적용
- 캐시 반환 조건에 `sessionComplete` 가드 추가
- feedback route: 불안전한 `as` 캐스트 제거, 명시적 `null` 반환

### Step 13 — 테스트 수정

- `tests/ui/resumes-detail-page.test.tsx`:
  - `lucide-react` mock에 `Download`, `TrendingUp`, `TrendingDown`, `Lightbulb` 추가
  - fetch mock을 URL별 응답 분기 (`/sessions` → `[]`, `/feedback` → `null`, 기본 → resume 데이터)
  - "8축 역량 평가 준비 중" → "이 이력서로 면접을 완료하면 역량 평가가 표시됩니다." 텍스트 수정
