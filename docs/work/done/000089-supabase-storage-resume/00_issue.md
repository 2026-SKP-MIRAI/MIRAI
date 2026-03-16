# feat: 이력서 영속 저장 — Supabase Storage 업로드 + Resume Prisma 모델 + per-user 조회 (siw)

## 사용자 관점 목표

자소서 PDF를 업로드하면 Supabase Storage에 저장되고, 이후 언제든 "내 이력서" 탭에서 목록을 조회·선택해 면접을 다시 시작할 수 있다.

## 배경

- 현재: PDF를 업로드하면 서버 메모리에서 파싱 후 `resumeText`를 `InterviewSession`에 저장 — 세션과 자소서가 분리되지 않아 이력서 재사용 불가
- `ResumeSession` 모델이 Prisma 스키마에 존재하나 미사용 — `Resume` 모델로 대체 또는 확장 필요
- `services/siw/.ai.md`: Supabase Storage 서버 경유 업로드, `SUPABASE_STORAGE_BUCKET` 환경변수 사용, 하드코딩 금지
- 이슈 #88(Auth) 완료 후 진행 — userId 기반 per-user 저장이 전제

## 완료 기준

- [x] `Resume` Prisma 모델 추가 + `prisma migrate dev`
- [x] `POST /api/resumes` — PDF → Supabase Storage 업로드 + DB 저장 (resumeText, questions, fileName, storageKey, userId)
- [x] `GET /api/resumes` — 로그인 유저의 이력서 목록 반환 (mock → 실 DB)
- [x] `GET /api/resumes/[id]` — 이력서 단건 조회 (resumeText + questions)
- [x] `/resumes` 페이지 — 실 DB 데이터 연결 (이슈 #87 mock → 실 데이터)
- [x] `/interview/new` 자소서 선택 — 저장된 이력서 목록 API 연동
- [x] `InterviewSession`에 `resumeId` 필드 추가 → Resume 모델 참조
- [x] RLS: `resumes` 테이블 (user_id = auth.uid()) SQL 마이그레이션
- [x] vitest: `POST /api/resumes`, `GET /api/resumes`, `GET /api/resumes/[id]` 테스트

## 구현 플랜

### Step 1 — `Resume` Prisma 모델 (`prisma/schema.prisma`)

```prisma
model Resume {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String
  fileName    String
  storageKey  String              // Supabase Storage 경로 (userId/uuid.pdf)
  resumeText  String
  questions   Json     @default("[]")  // QuestionItem[] — 기능01 결과 캐시
  createdAt   DateTime @default(now())

  interviewSessions InterviewSession[]

  @@map("resumes")
}

// InterviewSession 업데이트
model InterviewSession {
  // ... 기존 필드 유지
  resumeId    String?  @db.Uuid
  resume      Resume?  @relation(fields: [resumeId], references: [id])
}
```

> `ResumeSession` 모델은 이 이슈에서 deprecated — 데이터 없으면 삭제, 있으면 마이그레이션 후 삭제

### Step 2 — Supabase Storage 업로드 헬퍼 (`src/lib/resume-repository.ts` 확장)

```ts
// 업로드: userId/uuid.pdf 경로로 service client 경유 업로드
// 다운로드 URL: signed URL (필요 시) 또는 storageKey 저장만
// 삭제: resume 삭제 시 Storage 파일도 함께 삭제
```

- 버킷명: `process.env.SUPABASE_STORAGE_BUCKET` (하드코딩 금지)
- 서버 경유 업로드 (WAF 보호 유지) — 클라이언트에서 직접 Storage 접근 금지

### Step 3 — API Routes

**`POST /api/resumes`** (`src/app/api/resumes/route.ts` 개편)
```
multipart/form-data (file: PDF)
  1. createServerClient → getUser() → userId 확인
  2. 엔진 POST /api/resume/questions 호출 → resumeText + questions
  3. Supabase Storage 업로드 (userId/uuid.pdf)
  4. Prisma Resume 생성 (userId, fileName, storageKey, resumeText, questions)
  5. 응답: { resumeId, questions, meta }
```

**`GET /api/resumes`** (`src/app/api/resumes/route.ts`)
```
getUser() → Prisma Resume.findMany({ where: { userId } })
응답: Resume[] (id, fileName, createdAt, questionsCount)
```

**`GET /api/resumes/[id]`** (`src/app/api/resumes/[id]/route.ts` 신규)
```
getUser() → Prisma Resume.findFirst({ where: { id, userId } })
응답: { id, fileName, resumeText, questions, createdAt }
404: 존재하지 않거나 타인 소유
```

### Step 4 — UploadForm 연동

- 현재: `POST /api/resume/questions` (엔진 직접 프록시)
- 변경: `POST /api/resumes` (Storage 업로드 + DB 저장 + 엔진 호출 통합)
- `UploadForm.tsx` → 응답에 `resumeId` 포함 → `QuestionsResponse.resumeId` 실제 값 사용

### Step 5 — `/resumes` 페이지 + `/interview/new` 실 데이터 연결

- `/resumes` 페이지: `GET /api/resumes` 실 호출 (이슈 #87 mock 교체)
- `/interview/new` 자소서 선택 섹션: 동일 API 연동
- 이력서 카드 클릭: `GET /api/resumes/[id]` → questions 표시

### Step 6 — RLS SQL 마이그레이션

```sql
ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can access own resumes"
  ON resumes FOR ALL
  USING (user_id = auth.uid());
```

### Step 7 — 테스트

- `tests/api/resumes-route.test.ts`: POST 200/400/401, GET 200/401, GET [id] 200/404
- `tests/ui/resumes-page.test.tsx`: 실 데이터 기반 카드 렌더링 + 빈 상태 UI

## 의존성

- **이슈 #88 (Auth)** 완료 필수 — userId 없으면 per-user 저장 불가
- **이슈 #87 (내비게이션)** — `/resumes` 페이지·`/interview/new` 자소서 선택 UI가 이 이슈에서 실 데이터로 교체됨

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] `services/siw/.ai.md` 최신화 (Resume 모델, Storage 업로드 흐름 반영)
- [x] `SUPABASE_STORAGE_BUCKET` 환경변수 하드코딩 없음
- [x] `SUPABASE_SERVICE_ROLE_KEY` 클라이언트 번들 노출 없음
- [x] 불변식 위반 없음
- [x] `ResumeSession` 모델 정리 (deprecated 처리 또는 삭제)

---

## 작업 내역

### 2026-03-15

**현황**: 9/9 완료 🎉

**완료된 항목**:
- `Resume` Prisma 모델 추가 + migration (`20260315000002_add_resume_model`)
- `POST /api/resumes` — PDF 검증 + 엔진 호출 + Storage 업로드 + DB 저장 (maxDuration=60)
- `GET /api/resumes` — userId 기반 Resume.listByUserId (uploadedAt/questionCount 필드명 유지)
- `GET /api/resumes/[id]` — 인증 가드 + userId 필터 (IDOR Must-Fix 적용)
- `/resumes` 페이지 — 실 DB 연결
- `/interview/new` 자소서 선택 — GET /api/resumes 연동
- `InterviewSession.resumeId String? @db.Uuid` 추가
- RLS migration (`20260315000001_rls_resumes`): `auth.uid()::text = "userId"` 패턴
- vitest 8케이스 신규 (POST 200/401/400, GET 200/401, GET[id] 200/401/404)

**미완료 항목**:
- (없음)

**변경 파일**: 14개
- `prisma/schema.prisma`, `resume-repository.ts`, `resume-storage.ts`(신규)
- `api/resumes/route.ts`, `api/resumes/[id]/route.ts`, `api/resume/questions/route.ts`
- `interview-service.ts`, `UploadForm.tsx`
- migration SQL 2개, `tests/api/resumes-route.test.ts`(신규), `.ai.md`

**검증**: TypeScript 0 errors, 114 tests passed (24 files)

### 2026-03-16

**현황**: 9/9 완료

**완료된 항목**:
- 전체 AC 완료 (2026-03-15 구현 완료)

**미완료 항목**:
- (없음)

**변경 파일**: 22개 (미커밋 상태 — 커밋 대기 중)

