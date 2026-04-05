# feat: [lww] Phase 1 — 자소서 업로드 → Supabase Storage 저장 + 면접 맞춤 질문 연동

## 사용자 관점 목표

취준생이 자신의 자소서를 업로드하면, 이후 면접 시 AI가 자소서 내용을 바탕으로 맞춤 질문을 생성해 더 실전 같은 모의면접을 경험할 수 있다.

## 배경

현재 `/resume` 페이지에서 PDF를 업로드하면 예상 질문을 미리 볼 수 있지만, 파일이 저장되지 않아 면접 시작 시 자소서 기반 맞춤 질문 생성이 불가능하다. Supabase Storage에 파일을 저장하고 면접 시작 흐름에 resumeText를 주입하면 personalization이 완성된다.

## 완료 기준

- [x] 로그인 유저가 PDF 업로드 시 Supabase Storage에 저장됨 (`resumes` 버킷, RLS 본인만 접근)
- [x] 면접 시작 시 업로드된 자소서가 있으면 resumeText를 엔진에 전달해 맞춤 질문 생성
- [x] 자소서 없을 경우 기존 직군 기반 질문 생성 동작 유지 (하위 호환)
- [x] 파일 크기 5MB 이하, PDF만 허용 (엔진 제약 동일)
- [x] `/resume` 페이지에서 현재 업로드된 자소서 표시 및 교체 가능

## 구현 플랜

1. Supabase Storage 버킷 설정 — `resumes` 버킷 생성, RLS: 본인(`auth.uid()`)만 읽기·쓰기
2. `/api/resume/upload` 라우트 — PDF 수신 → Storage 저장 (`{user_id}/{uuid}.pdf`) → 파일 경로 DB 저장
3. `profiles` 또는 별도 `resumes` 테이블에 최근 업로드 경로·resumeText 캐시
4. 온보딩→면접 시작(`/api/interview/start`) 시 저장된 resumeText 있으면 엔진에 전달, 없으면 기존 직군 기반 동작

## 의존성

- 소셜 로그인 #179 ✅ 완료 (merged)
- 엔진 API: `POST /api/resume/questions`, `POST /api/interview/start` (기존 계약 그대로)
- 환경변수: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] `services/fint/.ai.md` 최신화
- [x] 불변식 위반 없음 (PDF 파싱·LLM 호출은 엔진에서만)

---

## 작업 내역

### 2026-03-25

**현황**: 0/5 완료

**완료된 항목**:
- 없음

**미완료 항목**:
- [ ] 로그인 유저가 PDF 업로드 시 Supabase Storage에 저장됨
- [ ] 면접 시작 시 resumeText를 엔진에 전달해 맞춤 질문 생성
- [ ] 자소서 없을 경우 기존 직군 기반 질문 생성 동작 유지
- [ ] 파일 크기 5MB 이하, PDF만 허용
- [ ] `/resume` 페이지에서 현재 업로드된 자소서 표시 및 교체 가능

**변경 파일**: 0개 (01_plan.md 작성 완료 — 구현 미시작)

### 2026-03-28

**현황**: 5/5 완료

**완료된 항목**:
- [x] 로그인 유저가 PDF 업로드 시 Supabase Storage에 저장됨
- [x] 면접 시작 시 resumeText를 엔진에 전달해 맞춤 질문 생성
- [x] 자소서 없을 경우 기존 직군 기반 질문 생성 동작 유지
- [x] 파일 크기 5MB 이하, PDF만 허용
- [x] `/resume` 페이지에서 현재 업로드된 자소서 표시 및 교체 가능

**미완료 항목**:
- 없음

**변경 파일**: 11개 (구현 완료 — 미커밋)

### 2026-04-05

**현황**: 5/5 완료

**완료된 항목**:
- [x] 로그인 유저가 PDF 업로드 시 Supabase Storage에 저장됨
- [x] 면접 시작 시 resumeText를 엔진에 전달해 맞춤 질문 생성
- [x] 자소서 없을 경우 기존 직군 기반 질문 생성 동작 유지
- [x] 파일 크기 5MB 이하, PDF만 허용
- [x] `/resume` 페이지에서 현재 업로드된 자소서 표시 및 교체 가능

**미완료 항목**:
- 없음

**변경 파일**: 11개 (구현 완료 — 미커밋, 커밋 후 /fi 실행 필요)

