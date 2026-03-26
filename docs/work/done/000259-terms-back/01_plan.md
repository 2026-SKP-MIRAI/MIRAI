# [#259] fix: 이용약관·개인정보처리방침 뒤로가기 — 랜딩페이지 진입 시 / 리다이렉션 — 구현 계획

> 작성: 2026-03-26

---

## 배경

랜딩페이지 푸터에서 이용약관·개인정보처리방침 링크를 클릭하면 해당 페이지의 뒤로가기 버튼이 항상 `/signup`으로 이동한다. 랜딩페이지에서 진입한 경우 `/`로 돌아가야 한다.

## 완료 기준

- [x] 랜딩페이지 푸터 링크에 `?from=landing` 쿼리 파라미터 추가
- [x] terms/page.tsx, privacy/page.tsx에서 `from` 파라미터를 읽어 뒤로가기 href 동적 결정
- [x] 회원가입 페이지에서 진입한 경우 기존처럼 `/signup`으로 돌아감

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(landing)/page.tsx` | 푸터 Link에 `?from=landing` 추가 |
| `services/siw/src/app/(auth)/terms/page.tsx` | async function, searchParams.from 기반 뒤로가기 |
| `services/siw/src/app/(auth)/privacy/page.tsx` | 동일 처리 |
| `services/siw/tests/ui/terms-back.test.tsx` | 신규 테스트 |

### 구현 상세

**landing/page.tsx:**
```tsx
// 기존
<Link href="/terms">이용약관</Link>
// 변경
<Link href="/terms?from=landing">이용약관</Link>
<Link href="/privacy?from=landing">개인정보처리방침</Link>
```

**terms/page.tsx 로직:**
```tsx
export default async function TermsPage({ searchParams }) {
  const from = (await searchParams).from;
  const backHref = from === "landing" ? "/" : "/signup";
  const backLabel = from === "landing" ? "돌아가기" : "회원가입으로 돌아가기";
  // ...
}
```

browser history 대신 명시적 쿼리 파라미터 방식 선택 — SSR 호환, Next.js App Router searchParams Promise 패턴 사용.

### 테스트 전략
- 랜딩 푸터 링크에 `?from=landing` 파라미터 포함 확인
- terms/privacy: `from=landing` → href=`/`, 미지정 → href=`/signup`
