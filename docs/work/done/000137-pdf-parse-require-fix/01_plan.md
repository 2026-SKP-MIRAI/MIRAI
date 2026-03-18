# [#137] fix: siw Docker 배포 E2E 완통 — pdf-parse 호환, WAF 설정, 엔진 연동 — 구현 계획

> 작성: 2026-03-18

---

## 완료 기준

- [x] GET /api/resumes 정상 응답 (200)
- [x] POST /api/resumes PDF 업로드 정상 동작
- [x] 기존 테스트 통과 (vitest)
- [x] `siw.mirainterview.com` E2E 전체 플로우 (PDF 업로드 → 면접 → 8축 리포트) 검증 완료

---

## 구현 계획

### 1. `services/siw/src/lib/pdf-parser.ts` — require lazy loading ✅

**문제**: `require("pdf-parse")`를 모듈 최상위에서 실행하면 Next.js가 route 모듈을 로딩하는 시점에 `DOMMatrix is not defined` 오류 발생. pdf-parse와 무관한 GET /api/resumes까지 500 반환.

**해결**: `require("pdf-parse")`를 `parsePdf` 함수 내부로 이동 (lazy loading). 모듈 로딩 시점에 실행되지 않아 GET 핸들러가 정상 동작.

### 2. `services/siw/src/lib/pdf-parser.ts` — DOMMatrix 폴리필 추가 ✅

**문제**: Docker alpine(`node:20-alpine`) 환경에서 `@napi-rs/canvas`가 네이티브 빌드 도구 부재로 설치 실패. `pdf-parse` v2는 PDF 좌표 변환에 `DOMMatrix`를 사용하는데, `@napi-rs/canvas` 없이는 폴리필 불가 → `DOMMatrix is not defined` 오류로 POST /api/resumes 422 반환.

**로컬 vs Docker 차이**: 로컬 환경에서는 `npm install` 시 `@napi-rs/canvas`가 optional dependency로 정상 설치됨. Docker alpine에서는 gcc·python 등 빌드 도구 부재로 설치 실패.

**해결**: `pdf-parser.ts`에 최소 DOMMatrix 스텁 폴리필 추가. PDF 텍스트 추출에 필요한 기본 인터페이스(translate, scale, multiply 등)만 구현.

**임시 조치**: #119(siw pdf-parse 완전 제거, 엔진에서 resumeText 수신)에서 근본 해결 예정. 아키텍처 불변식상 PDF 파싱은 engine에서만 해야 하므로 siw의 pdf-parse 의존성 자체가 위반.

### 3. AWS WAF 설정 — `CreatedByALB-mirai-siw-service-ALB` ✅

**문제 1**: `SizeRestrictions_BODY` BLOCK — PDF 파일(multipart/form-data)이 WAF body 크기 제한에 걸려 업로드 차단.

**문제 2**: `CrossSiteScripting_BODY` BLOCK — PDF 바이너리 데이터 안에 WAF가 XSS 패턴으로 오탐하는 문자열 포함. 실제 공격이 아닌 false positive.

**해결**: 두 규칙 모두 Count로 변경. Block → Count는 실제 차단 없이 로그만 남김.

### 4. `ENGINE_BASE_URL` 환경변수 설정 ✅

**문제**: `~/.env.siw`에 `ENGINE_BASE_URL`이 누락되어 기본값 `http://localhost:8000`으로 동작. 컨테이너 내부에서 localhost:8000은 존재하지 않아 fetch failed 발생.

**해결**: `~/.env.siw`에 `ENGINE_BASE_URL=http://engine.mirainterview.com` 추가 후 컨테이너 재생성 (`docker stop → docker rm → docker run`).

참고: `docker restart`는 env 파일을 재로딩하지 않으므로 반드시 컨테이너 재생성 필요.

### 5. E2E 배포 검증 ✅

`siw.mirainterview.com`에서 전체 플로우 정상 동작 확인:
- PDF 업로드 → 질문 생성
- 면접 시작 → 패널 면접 진행 → 답변 제출
- 면접 종료 → 8축 역량 평가 리포트 생성
