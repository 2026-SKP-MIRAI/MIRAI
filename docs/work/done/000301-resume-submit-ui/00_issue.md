# feat: [seung] 합격 자소서 사용자 제출 UI + API

## 사용자 관점 목표

면접 준비 중 합격한 자소서가 있는 사용자가 직접 기여할 수 있어, 시간이 지날수록 서류 진단 RAG 품질이 향상된다.

## 배경

현재 `accepted_resume_embeddings`에 적재된 999건은 초기 seed 데이터(#294)로, 이후 데이터가 추가되지 않고 있다. 로그인 사용자가 본인의 합격 자소서를 자발적으로 제출하는 플로우를 추가하여 데이터를 지속적으로 확장한다.

제출된 자소서는 `resume_submissions` 테이블에 저장되며, #293 임베딩 파이프라인 DAG가 주기적으로 읽어 처리한다.

> **로그인 필수**: 익명 제출 불가. 어뷰징 방지 및 추후 크레딧 소급 지급을 위해 `userId` 저장.

## 완료 기준

- [x] Prisma 스키마: `ResumeSubmission` 모델 추가 및 마이그레이션
- [x] `POST /api/resume/submit-accepted` — 로그인 사용자만 접근 가능
- [x] 제출 UI — `jobRole`(자유 입력), PDF 업로드, `company`(선택), 동의 체크박스
- [x] 유효성 검증: `jobRole` 필수, PDF 5MB 이하, 추출 텍스트 200자 이상, 동의 체크 필수
- [x] 제출 완료 후 기여 임팩트 메시지 표시
- [x] 관리자 제출 내역 확인 및 삭제 기능 (어뷰징 대응)
- [x] 테스트: 미로그인 제출 거부, 유효성 검증, 정상 제출

## DB 스키마

```prisma
model ResumeSubmission {
  id          Int      @id @default(autoincrement())
  userId      String   // 로그인 사용자 ID — 어뷰징 추적 및 추후 크레딧 연동
  jobRole     String
  content     String
  company     String?
  processed   Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

## 기여 동기 설계

**현재 구현 (심리적 보상):**
- 제출 완료 후 "내 자소서가 다른 지원자의 서류 진단 품질 향상에 기여합니다" 메시지
- 전체 기여 건수 표시 ("현재까지 N건의 합격 자소서가 기여되었습니다")

**추후 크레딧/유료 시스템 도입 시:**
- 합격 자소서 제출 1건당 크레딧 소급 지급 (`createdAt` + `userId` 기반)
- 관리자 삭제 처리된 허위 제출은 크레딧 미지급

## 구현 플랜

### Step 1 — DB 스키마
`services/seung/prisma/schema.prisma`에 `ResumeSubmission` 모델 추가 후 마이그레이션

### Step 2 — API 엔드포인트
`services/seung/src/app/api/resume/submit-accepted/route.ts`
- 세션 확인 → 미로그인 시 401
- 입력 유효성 검증
- `prisma.resumeSubmission.create()`

### Step 3 — 제출 UI
서류 진단 페이지 하단 또는 `/contribute` 페이지
- 직군 select, 자소서 본문 textarea, 회사명 input
- 동의 문구 + 체크박스
- 제출 완료 후 기여 임팩트 메시지

### Step 4 — 관리자 기능
간단한 관리 페이지 또는 Supabase 대시보드 직접 활용
- 제출 목록 조회, 허위 제출 삭제

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (DB는 seung 서비스 소유, DAG는 readonly 접근)

---

## 작업 내역

### 2026-03-27

- `services/seung/prisma/schema.prisma` — `ResumeSubmission` 모델 추가 (마이그레이션: `npx prisma migrate dev --name add-resume-submission` 환경변수 설정 후 실행 필요)
- `services/seung/src/app/api/resume/submit-accepted/route.ts` — GET(건수)/POST(제출) 구현
- `services/seung/src/app/api/admin/resume-submissions/route.ts` — GET(목록)/DELETE(삭제) 관리자 API 구현
- `services/seung/src/middleware.ts` — `/contribute`, `/admin` 보호 라우트 추가
- `services/seung/src/app/contribute/page.tsx` — 합격 자소서 기여 UI 페이지 신규
- `services/seung/src/app/admin/submissions/page.tsx` — 관리자 제출 목록/삭제 페이지 신규
- `services/seung/src/app/dashboard/page.tsx` — "합격 자소서 기여" 버튼 추가
- `services/seung/tests/api/resume-submit-accepted.test.ts` — 9개 테스트 (전체 통과)
- `.ai.md` — `contribute/`, `api/resume/submit-accepted/`, `admin/`, `admin/submissions/` 최신화
- `services/seung/supabase/migrations/add_rls.sql` — `ResumeSubmission` RLS 정책 추가
- `services/seung/src/app/layout.tsx` — NavBar에 `isAdmin` prop 전달
- `services/seung/src/components/NavBar.tsx` — 관리자 버튼 추가

**설계 변경 사항 (이슈 원문 대비):**
- `jobRole`: select 드롭다운 → 자유 입력(text input) — 직군이 다양하여 주관식이 적합
- `content`: textarea 직접 입력 → PDF 업로드 후 엔진 텍스트 추출 — 실제 자소서 파일 제출 UX

**Airflow 연계 검증 완료 (2026-03-27):**
- `/contribute`에서 PDF 제출 → `ResumeSubmission` DB 저장 → `seung_resume_embed_dag` 수동 트리거 → 임베딩 생성 → `processed=true` 업데이트 확인
- RLS 문제 해결: `seung_readonly` 롤에 SELECT 정책 + GRANT 적용

### 잔여 작업
- 없음 (모든 AC 완료)

