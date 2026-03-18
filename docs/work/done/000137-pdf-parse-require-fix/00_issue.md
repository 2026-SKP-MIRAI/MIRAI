# fix: pdf-parse 모듈 레벨 require로 인한 GET /api/resumes 500 오류 수정 (siw)

## 목적
pdf-parse를 모듈 최상위에서 require하면 DOMMatrix 오류로 route 모듈 전체가 죽어 GET /api/resumes도 500을 반환하는 문제 수정

## 배경
`src/lib/pdf-parser.ts`에서 `require("pdf-parse")`를 모듈 레벨에서 실행하면, Next.js가 route 모듈을 로딩하는 시점에 `DOMMatrix is not defined` 오류가 발생한다. 이로 인해 POST뿐만 아니라 pdf-parse와 무관한 GET /api/resumes까지 500을 반환한다.

## 완료 기준
- [x] GET /api/resumes 정상 응답 (200)
- [x] pdf-parse require를 parsePdf 함수 내부로 이동 (lazy loading)
- [x] 기존 테스트 통과 (vitest)

## 구현 플랜
1. `src/lib/pdf-parser.ts` — require를 모듈 레벨에서 함수 내부로 이동
2. 테스트 실행 확인
3. 배포 후 GET /api/resumes 응답 확인

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 1. pdf-parse require lazy loading 적용
- `src/lib/pdf-parser.ts` 모듈 레벨 require → `parsePdf` 함수 내부로 이동
- GET /api/resumes 500 오류 해결

### 2. DOMMatrix 폴리필 추가
- Docker alpine 환경에서 `@napi-rs/canvas` 미설치로 `DOMMatrix is not defined` 발생
- `pdf-parser.ts`에 최소 DOMMatrix 폴리필 추가 (임시 — #119 완료 시 제거 예정)
- POST /api/resumes PDF 업로드 422 오류 해결

### 3. WAF 설정
- `SizeRestrictions_BODY` → Count (PDF 업로드 크기 차단 방지)
- `CrossSiteScripting_BODY` → Count (PDF 바이너리 XSS 오탐 방지)

### 4. ENGINE_BASE_URL 환경변수 수정
- `~/.env.siw` ENGINE_BASE_URL을 `http://engine.mirainterview.com`으로 설정

### 5. E2E 배포 테스트 완료
- PDF 업로드 → 질문 생성 → 면접 시작 → 답변 제출 → 8축 리포트까지 전체 플로우 정상 동작 확인
- `siw.mirainterview.com` 배포 환경에서 검증 완료
