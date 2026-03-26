# 테스트 결과 — #260

## 테스트 환경
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 결과 | 비고 |
|------|------|------|
| services/siw/src/app/(auth)/__tests__/layout.test.tsx | PASS | 로고 렌더링 및 링크 href 검증 |

## 통합/수동 검증
- [x] `(auth)/layout.tsx`에 MirAI 로고 좌상단 추가: `gradient-text` 클래스 + `next/link` href="/" 적용
- [x] 로고 클릭 시 랜딩페이지(`/`)로 이동
- [x] 로그인, 회원가입 페이지 모두에서 공통 레이아웃을 통해 로고 표시됨
- [x] `(auth)/.ai.md` 신규 작성으로 디렉토리 목적·구조 문서화 완료

## 변경 내용 요약
`(auth)/layout.tsx`에 `next/link`로 감싼 MirAI 로고 텍스트를 좌상단(`absolute top-6 left-6`)에 추가했다. `gradient-text` 클래스를 적용해 기존 앱 내 로고와 동일한 스타일을 유지하며, 클릭 시 랜딩페이지(`/`)로 이동한다. 레이아웃 테스트(`layout.test.tsx`)를 신규 작성해 로고 렌더링 및 링크 동작을 검증했다.
