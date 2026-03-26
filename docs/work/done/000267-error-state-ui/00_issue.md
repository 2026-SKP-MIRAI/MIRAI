# chore: [siw] 에러 상태 UI 미처리 수정 — API 실패 빈 화면 + 잘못된 업로드 에러 메시지

## 목적
API 실패 또는 잘못된 파일 업로드 시 사용자가 상황을 인지할 수 있도록 에러 피드백을 정확하게 표시한다.

## 완료 기준
- [x] `/resumes` 페이지에서 API 실패(네트워크 오류/5xx) 시 에러 메시지와 새로고침 버튼이 표시된다
- [x] PDF 아닌 파일 업로드 시 "PDF 파일만 업로드 가능합니다." 메시지가 표시된다
- [x] 정상 케이스(이력서 있음/없음)는 기존과 동일하게 동작한다

---

## 작업 내역

1. `resumes/page.tsx` — error 상태 추가, fetch 실패 및 비배열 응답 감지, 에러 배너 + 새로고침 버튼 렌더링
2. `api/resumes/route.ts` — file.type 검증 시 ENGINE_ERROR_MESSAGES.noFile 대신 "PDF 파일만 업로드 가능합니다." 메시지 반환
3. 테스트 추가: resumes-page.test.tsx (UI 에러 상태 6개 테스트), resumes-route.test.ts (에러 메시지 검증 보강)
