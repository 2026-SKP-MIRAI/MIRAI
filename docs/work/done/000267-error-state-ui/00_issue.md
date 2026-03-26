# fix: [siw] 에러 상태 UI 미처리 수정 — API 실패 빈 화면 + 잘못된 업로드 에러 메시지

Issue #267

## 배경
API 실패(네트워크 오류/5xx) 시 이력서 목록 페이지가 빈 화면을 보여줬다. 또한 PDF가 아닌 파일 업로드 시 에러 메시지가 부정확했다.

## 완료 기준
- [x] `/resumes` 페이지에서 API 실패(네트워크 오류/5xx) 시 에러 메시지와 새로고침 버튼이 표시된다
- [x] PDF 아닌 파일 업로드 시 "PDF 파일만 업로드 가능합니다." 메시지가 표시된다
- [x] 정상 케이스(이력서 있음/없음)는 기존과 동일하게 동작한다

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `loadResumes` 함수로 분리해 `useEffect` + 새로고침 버튼 양쪽에서 재사용 — 중복 없음
- `!Array.isArray(data)` 체크 추가 — API가 예상과 다른 형태를 반환할 때도 빈 화면 방지
- `!error` 조건을 이력서 목록 렌더링에 추가 — 에러 상태와 목록이 동시에 보이는 버그 방지

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/resumes/page.tsx` | `error` 상태 추가, `loadResumes` 함수 분리, 에러 배너+새로고침 버튼 렌더링, fetch 실패/비배열 응답 처리 |
| `services/siw/src/app/api/resumes/route.ts` | `file.type !== "application/pdf"` 분기에 "PDF 파일만 업로드 가능합니다." 메시지 적용 |
| `services/siw/src/app/api/resumes/analyze/route.ts` | 동일하게 `file.type !== "application/pdf"` 분기에 "PDF 파일만 업로드 가능합니다." 메시지 적용 |
| `services/siw/src/app/(app)/resumes/.ai.md` | error 상태·에러 배너 구조 기술 업데이트 |

### 구현 상세
기존 인라인 `useEffect` fetch를 `loadResumes` 함수로 분리하고, `r.ok` 체크 및 `Array.isArray(data)` 검증을 추가했다. 실패 시 `error` 상태를 설정하고 에러 배너와 새로고침 버튼을 렌더링한다. 이력서 목록은 `!error` 조건이 추가되어 에러 상태에서는 표시되지 않는다.
