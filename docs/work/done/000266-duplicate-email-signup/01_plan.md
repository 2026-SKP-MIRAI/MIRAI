# [#266] fix: 중복 이메일 회원가입 시 에러 안내 부재 수정 — 구현 계획

> 작성: 2026-03-26

---

## 배경

Supabase `auth.signUp()`은 이미 가입된(인증 완료된) 이메일에 대해 `error`를 반환하지 않고, 인증 메일을 재발송한 뒤 성공 응답을 반환한다. `signup/page.tsx`에서 `authError`만 체크하므로 기존 계정 사용자도 "이메일을 확인해주세요" 성공 화면을 보게 된다.

Supabase 공식 패턴: 이미 가입된 이메일은 `data.user?.identities` 배열이 비어있다.

## 완료 기준

- [x] 이미 가입된 이메일로 가입 시도 시 성공 화면 대신 에러 메시지("이미 가입된 이메일입니다. 로그인해주세요.")와 로그인 페이지 링크가 표시된다
- [x] 실제 신규 가입자(최초 이메일 가입)에게는 기존과 동일하게 성공 화면이 표시된다
- [x] Google OAuth 가입 경로에는 영향 없다

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(auth)/signup/page.tsx` | signUp 응답 data 수신, identities 체크, 에러 메시지 링크 |
| `services/siw/tests/ui/signup.test.tsx` | mockSignUp 응답 업데이트, 중복 이메일 테스트 추가 |
| `services/siw/src/app/(auth)/.ai.md` | 중복 이메일 감지 로직 기술 |

### 구현 상세

**signup/page.tsx 변경:**
```tsx
// 기존
const { error: authError } = await supabase.auth.signUp({...})
if (authError) { setError("..."); return }
setSuccess(true)

// 변경
const { data, error: authError } = await supabase.auth.signUp({...})
if (authError) { setError("..."); return }
if (data.user?.identities?.length === 0) {
  setError("이미 가입된 이메일입니다. 로그인해주세요.")
  return
}
setSuccess(true)
```

**에러 메시지 링크:**
```tsx
{error.includes("이미 가입된") && (
  <> <Link href="/login" className="underline font-semibold text-violet-600">
    로그인 페이지로 이동
  </Link></>
)}
```

### 테스트 전략
- `identities: []` → 에러 메시지 + 로그인 링크 확인
- `identities: [{ id: "1" }]` → 성공 화면 확인
- Google OAuth(`provider: "google"`) → identities 체크 미적용 확인
