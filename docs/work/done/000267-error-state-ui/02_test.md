# 테스트 결과 — #267

## 테스트 환경
- vitest (services/siw)
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 케이스 | 결과 |
|------|--------|------|
| tests/ui/resumes-page.test.tsx | API 실패 시 에러 메시지와 새로고침 버튼이 표시된다 | ✅ PASS |
| tests/ui/resumes-page.test.tsx | API 5xx 응답 시 에러 메시지가 표시된다 | ✅ PASS |
| tests/ui/resumes-page.test.tsx | API가 배열이 아닌 응답을 반환하면 에러 메시지가 표시된다 | ✅ PASS |
| tests/ui/resumes-page.test.tsx | 에러 상태에서 새로고침 버튼 클릭 시 재요청한다 | ✅ PASS |
| tests/ui/resumes-page.test.tsx | 정상 응답 시 이력서 목록이 표시된다 | ✅ PASS |
| tests/ui/resumes-page.test.tsx | 빈 배열 응답 시 빈 상태 메시지가 표시된다 | ✅ PASS |
| tests/api/resumes-route.test.ts | 400: PDF 아닌 파일 — 'PDF 파일만 업로드 가능합니다.' 메시지 반환 | ✅ PASS |

## 통합/수동 검증
- [x] `/resumes` 페이지에서 API 실패(네트워크 오류/5xx) 시 에러 메시지와 새로고침 버튼이 표시된다: error state 추가, fetch 실패 및 비배열 응답 감지, 에러 배너 + 새로고침 버튼 렌더링
- [x] PDF 아닌 파일 업로드 시 "PDF 파일만 업로드 가능합니다." 메시지가 표시된다: `api/resumes/route.ts` file.type 검증 시 메시지 수정
- [x] 정상 케이스(이력서 있음/없음)는 기존과 동일하게 동작한다: 정상 응답 및 빈 배열 테스트 통과

## 테스트 커버리지
신규 추가 테스트: 7개 (resumes-page.test.tsx 6개, resumes-route.test.ts PDF 에러 메시지 1개)
