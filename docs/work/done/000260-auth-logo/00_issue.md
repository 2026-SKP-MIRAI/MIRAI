# feat: [siw] 회원가입·로그인 페이지 좌상단 MirAI 로고 추가 (클릭 시 랜딩페이지 이동)

Issue #260

## 배경
인증 페이지(로그인·회원가입)에서 브랜드 로고가 없어 사용자가 서비스 이름을 인지하기 어렵고, 랜딩페이지로 돌아가는 경로가 없었다.

## 완료 기준
- [x] 회원가입·로그인 페이지 좌상단에 MirAI 로고가 표시된다
- [x] 로고 클릭 시 랜딩페이지(/)로 이동한다
- [x] 로고에 gradient-text 스타일이 적용된다
- [x] 테스트 추가

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `layout.tsx`에 `Link` import 추가 후 절대 위치(`absolute top-6 left-6`) 로고 삽입 — 기존 children 레이아웃에 영향 없음
- `gradient-text hover:opacity-80 transition-opacity` — 디자인 시스템 일관성 유지
- `__tests__/layout.test.tsx` 3개 케이스: 로고 존재, href="/", className 확인

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(auth)/layout.tsx` | `Link` import 추가, 좌상단 MirAI 로고 삽입 |
| `services/siw/src/app/(auth)/__tests__/layout.test.tsx` | 로고 렌더링·href·className 테스트 3개 추가 |
| `services/siw/src/app/(auth)/.ai.md` | 신규 생성 — 레이아웃 구조 기술 |

### 구현 상세
`(auth)/layout.tsx`의 최외곽 `div` 안에 `absolute top-6 left-6 z-20` 위치의 `<Link href="/">` 로고를 추가했다. 기존 배경 orbs와 children 정렬 구조에 변경 없이 레이아웃 레이어 위에 독립적으로 배치된다.
