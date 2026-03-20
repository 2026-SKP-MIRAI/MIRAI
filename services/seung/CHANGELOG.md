# seung Service Changelog

> seung 서비스 변경 이력. 담당자: seung

---

## 2026년 3월 16일 주차 (Mar 16~22)

### ✨ 새 기능
- **내 면접 기록 대시보드** ([#157](../../issues/157)): 로그인 후 자소서별 면접 기록을 카드로 조회하는 `/dashboard` 페이지 추가. `GET /api/dashboard`(Resume 목록 + 통계), `DELETE /api/resume/[id]`(cascade 삭제) 신규 API. `Resume.fileName` 필드 추가(Prisma 마이그레이션). "이 자소서로 다시 면접하기" 재사용 플로우 구현. OAuth 콜백 포함 모든 로그인 후 리다이렉트를 `/dashboard`로 통일. Vitest 14파일 122개, Playwright E2E 5케이스 추가.
- **Supabase Auth 연동 — 회원가입·로그인·보호 라우트** ([#151](../../issues/151)): `@supabase/ssr` 기반 인증 레이어 구축. `/login`, `/signup` 페이지와 미들웨어 보호 라우트 추가. `Resume`, `InterviewSession`, `Report` 테이블에 `userId` 컬럼 추가 및 모든 API 라우트에 401/403 인증·소유권 검증 적용.

---

## 2026년 3월 9일 주차 (Mar 9~15)

### ✨ 새 기능
- **MVP 01: 자소서 업로드 → 질문 생성 end-to-end** ([#38](../../issues/38), [#47](../../issues/47)): `POST /upload` 엔드포인트 구현. PDF를 엔진으로 전달해 면접 질문을 생성하고 반환하는 플로우 완성.
- **Phase 1: 패널 면접 + 꼬리질문 서비스 연동** ([#57](../../issues/57), [#60](../../issues/60)): 면접 세션 API와 꼬리질문 생성 기능이 연동되어 실전형 패널 면접 플로우를 지원합니다.

### 🔧 개선
- **경로별 CHANGELOG.md 체계 도입**: seung 서비스 변경 이력을 독립적으로 관리하고 `/update-changelog` 커맨드로 자동 업데이트할 수 있습니다.

---

## 2026년 3월 2일 주차 (Mar 2~8)

### 🔧 개선
- **모노레포 구조 정착** ([#23](../../issues/23)): 서브모듈에서 모노레포로 전환하여 seung 서비스 독립 개발 환경이 구성되었습니다.

### 📚 문서
- **.ai.md 체계 정비**: 서비스 목적·구조·역할 문서를 `.ai.md` 형식으로 통일했습니다.
