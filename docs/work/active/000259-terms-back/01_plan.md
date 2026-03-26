# [#259] fix: 이용약관·개인정보처리방침 뒤로가기 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [x] 랜딩페이지 링크에 ?from=landing 추가
- [x] terms/privacy 페이지에서 from 파라미터 기반 동적 뒤로가기
- [x] 테스트 코드 포함

---

## 구현 계획

1. `(landing)/page.tsx` 푸터 링크에 `?from=landing` 추가
2. `(auth)/terms/page.tsx` — `searchParams.from` 읽어 뒤로가기 href 동적 처리
3. `(auth)/privacy/page.tsx` — 동일 처리
4. 테스트 추가
