# fix: [siw] 이용약관·개인정보처리방침 뒤로가기 — 랜딩페이지 진입 시 /로 리다이렉션

## 완료 기준
- [x] 랜딩페이지 푸터 링크에 `?from=landing` 쿼리 파라미터 추가
- [x] terms/page.tsx, privacy/page.tsx에서 `from` 파라미터를 읽어 뒤로가기 href 동적 결정
- [x] 회원가입 페이지에서 진입한 경우 기존처럼 /signup으로 돌아감

---

## 작업 내역

