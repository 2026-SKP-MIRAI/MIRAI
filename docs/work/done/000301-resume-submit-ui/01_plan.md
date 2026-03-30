# [#301] feat: [seung] 합격 자소서 사용자 제출 UI + API — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] Prisma 스키마: `ResumeSubmission` 모델 추가 및 마이그레이션
- [x] `POST /api/resume/submit-accepted` — 로그인 사용자만 접근 가능
- [x] 제출 UI — `jobRole`(자유 입력), PDF 업로드, `company`(선택), 동의 체크박스 (설계 변경: select→자유입력, textarea→PDF)
- [x] 유효성 검증: `jobRole` 필수, PDF 5MB 이하, 추출 텍스트 200자 이상, 동의 체크 필수, Rate limit 10건/24h
- [x] 제출 완료 후 기여 임팩트 메시지 표시
- [x] 관리자 제출 내역 확인 및 삭제 기능 (어뷰징 대응)
- [x] 테스트: 미로그인 제출 거부, 유효성 검증, 정상 제출
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (DB는 seung 서비스 소유, DAG는 readonly 접근)

---

## 구현 계획

### Step 1 — Prisma 스키마 추가 및 마이그레이션

**파일**: `services/seung/prisma/schema.prisma`

이슈에 정의된 모델 그대로 추가:

```prisma
model ResumeSubmission {
  id        Int      @id @default(autoincrement())
  userId    String   // 로그인 사용자 ID — 어뷰징 추적 및 추후 크레딧 연동
  jobRole   String
  content   String
  company   String?
  processed Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

마이그레이션 실행:
```bash
cd services/seung
npx prisma migrate dev --name add-resume-submission
```

---

### Step 2 — API: `POST /api/resume/submit-accepted` + `GET /api/resume/submit-accepted`

**파일**: `services/seung/src/app/api/resume/submit-accepted/route.ts`

기존 API 패턴(`createClient` → `supabase.auth.getUser()`) 그대로 따름.

**POST** 처리 흐름:
1. `supabase.auth.getUser()` → user 없으면 **401**
2. `request.json()` → `{ jobRole, content, company?, consent }`
3. 유효성 검증:
   - `jobRole` 없으면 **400** (`"직군을 선택해주세요."`)
   - `content.length < 200` → **400** (`"자소서 본문은 200자 이상이어야 합니다."`)
   - `!consent` → **400** (`"동의가 필요합니다."`)
4. `prisma.resumeSubmission.create({ data: { userId: user.id, jobRole, content, company } })`
5. 성공 시 **201** + `{ id, createdAt }`

**GET** 처리 흐름 (인증 불필요, 공개):
- `prisma.resumeSubmission.count()` → `{ count: N }` 반환
- `/contribute` 페이지에서 "현재까지 N건 기여" 표시에 사용

---

### Step 3 — 관리자 API

**파일**: `services/seung/src/app/api/admin/resume-submissions/route.ts`

- `GET` — 전체 제출 목록 반환 (최신순, `processed` 필터 지원)
- `DELETE ?id={id}` — 특정 제출 삭제 (어뷰징 처리)

관리자 인증: `ADMIN_EMAIL` 환경변수와 로그인 이메일 비교. 일치하지 않으면 **403**.

```
ADMIN_EMAIL=admin@mirai.com  (services/seung/.env.local에 추가)
```

---

### Step 3-b — middleware.ts 보호 라우트 추가

**파일**: `services/seung/src/middleware.ts`

`isProtectedPage` 조건에 `/contribute`, `/admin` 추가:
```ts
pathname.startsWith('/contribute') ||
pathname.startsWith('/admin')
```
→ 미로그인 시 `/login?redirectTo=...`으로 리디렉트

---

### Step 4 — 제출 UI

**파일**: `services/seung/src/app/contribute/page.tsx` (신규 페이지)

레이아웃: 기존 resume/page.tsx 디자인 시스템 일관성 유지 (`#4361ee`, `#1a1a2e`, rounded-2xl 카드)

UI 구성:
```
┌─────────────────────────────────────────┐
│  합격 자소서 기여하기                     │
│  현재까지 N건의 합격 자소서가 기여됨       │
│                                         │
│  직군 선택* [select ▼]                  │
│  회사명    [input - 선택]                │
│  자소서 본문* [textarea, min 200자]      │
│  ─────────────────────────────────────  │
│  □ 제출한 자소서는 서류 진단 품질 향상을  │
│    위해 익명으로 활용됩니다. 동의합니다.  │
│                                         │
│  [제출하기]                              │
└─────────────────────────────────────────┘
```

`직군 select` 옵션 (하드코딩):
```
백엔드 개발자, 프론트엔드 개발자, 풀스택 개발자,
데이터 엔지니어, AI/ML 엔지니어, DevOps/인프라,
기획자(PM), 디자이너, 마케터, 경영/전략, 기타
```

제출 완료 후: 폼 숨기고 임팩트 메시지 표시
```
✓ 감사합니다! 내 자소서가 다른 지원자의 서류 진단 품질 향상에 기여합니다.
```

미로그인 접근 시: 로그인 페이지로 리디렉트 (클라이언트에서 Supabase 세션 확인)

대시보드 링크 추가: `services/seung/src/app/dashboard/page.tsx`에 "합격 자소서 기여하기" 버튼/링크 추가

---

### Step 5 — 관리자 UI

**파일**: `services/seung/src/app/admin/submissions/page.tsx` (신규 페이지)

- 서버 컴포넌트로 구현 (Next.js App Router)
- 제출 목록 테이블: id, userId, jobRole, company, content(앞 100자), createdAt, processed
- 삭제 버튼: `DELETE /api/admin/resume-submissions?id={id}` 호출
- 관리자 인증: API 레벨에서 처리, UI는 단순하게

---

### Step 6 — 테스트

**파일**: `services/seung/tests/api/resume-submit-accepted.test.ts`

기존 테스트 패턴(vitest + vi.mock) 그대로 따름.

테스트 케이스:
| 케이스 | 기대 결과 |
|--------|----------|
| 미로그인 제출 | 401 |
| `jobRole` 없음 | 400 |
| `content` 200자 미만 | 400 |
| `consent` false | 400 |
| 정상 제출 | 201 + `{ id, createdAt }` |
| DB 오류 | 500 |

Mock 대상: `@/lib/prisma`, `@/lib/supabase/server`

---

### Step 7 — `.ai.md` 최신화

작업 완료 후 업데이트 대상:
- `services/seung/src/app/api/resume/.ai.md` — `submit-accepted` 엔드포인트 추가
- `services/seung/src/app/contribute/` — 신규 디렉토리이므로 `.ai.md` 생성
- `services/seung/src/app/admin/submissions/` — 신규 디렉토리이므로 `.ai.md` 생성

---

## 주의사항

- **불변식 준수**: `ResumeSubmission` 테이블은 seung 서비스 소유. DAG(#293)는 `processed=false` 레코드를 읽기 전용으로 조회 후 `processed=true`로 업데이트 — seung DB 직접 접근 구조이므로 별도 API 불필요
- **userId 타입**: 기존 `Resume.userId`는 `String?`이지만 `ResumeSubmission.userId`는 `String` (non-nullable) — 로그인 필수이므로 항상 존재
- **기여 건수 표시**: `/contribute` 페이지 진입 시 `GET /api/resume/submit-accepted` (또는 별도 엔드포인트)로 전체 건수 조회. 간단히 `prisma.resumeSubmission.count()`로 구현
