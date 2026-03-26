# 테스트 결과 — #259

## 테스트 환경
- Node.js / vitest + @testing-library/react
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 결과 | 비고 |
|------|------|------|
| `tests/ui/terms-back.test.tsx` | PASS | from=landing 파라미터 기반 뒤로가기 동적 처리 테스트 |
| `tests/ui/landing-page.test.tsx` | PASS | 랜딩페이지 푸터 링크 ?from=landing 파라미터 포함 확인 |

## 통합/수동 검증
- [x] 랜딩페이지 푸터 링크에 `?from=landing` 쿼리 파라미터 추가: `(landing)/page.tsx` 푸터 링크 수정 확인
- [x] `terms/page.tsx`, `privacy/page.tsx`에서 `from` 파라미터 읽어 뒤로가기 href 동적 결정: `searchParams.from === 'landing'`이면 `/`로, 그 외 `/signup`으로 이동 확인
- [x] 회원가입 페이지에서 진입 시 `/signup`으로 복귀: `from` 파라미터 없을 때 기존 동작 유지 확인

## 테스트 커버리지
- `terms-back.test.tsx`: `?from=landing` 및 `?from=signup`(또는 파라미터 없음) 두 케이스에 대한 뒤로가기 href 검증
- `landing-page.test.tsx`: 이용약관/개인정보처리방침 링크에 `?from=landing` 파라미터 포함 여부 확인
