# LWW OAuth 설정 가이드

> 작성: 2026-03-22
> Supabase 프로젝트: `fcrwejqinsmyyqpisepv`

---

## 공통 개념

LWW는 Supabase Auth를 통해 OAuth를 처리한다. OAuth 흐름은 다음과 같다:

```
브라우저 → Supabase Auth → 카카오/구글 → 다시 Supabase → /auth/callback (Next.js)
```

따라서 카카오/구글 개발자 콘솔의 **Redirect URI**는 Next.js 주소가 아니라 **Supabase 내부 콜백 URL**을 써야 한다:

```
https://fcrwejqinsmyyqpisepv.supabase.co/auth/v1/callback
```

---

## 1. DB 마이그레이션

**Supabase SQL Editor**: `https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/sql/new`

`migrate.sql` 파일 전체 복사 → 붙여넣기 → Run

> ⚠️ `handle_new_user` 트리거 함수는 반드시 `set search_path = public` 포함해야 함.
> 없으면 "relation profiles does not exist" 오류 발생.

---

## 2. 카카오 OAuth

### 2-1. 카카오 개발자 콘솔 설정

1. `https://developers.kakao.com` → 내 애플리케이션 → 애플리케이션 추가
2. **앱 설정 → 플랫폼 → Web** → 사이트 도메인 추가:
   ```
   http://localhost:3000
   https://your-production-domain.com
   ```
3. **제품 설정 → 카카오 로그인** → 활성화 ON
4. **카카오 로그인 → Redirect URI** 추가:
   ```
   https://fcrwejqinsmyyqpisepv.supabase.co/auth/v1/callback
   ```
5. **카카오 로그인 → 보안** → Client Secret 코드 생성
   > 보안 탭이 안 보이면 카카오 로그인 활성화 먼저 확인
6. **앱 설정 → 앱 키** → REST API 키 복사

### 2-2. Supabase에 등록

`https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/auth/providers` → Kakao

| 항목 | 값 |
|------|-----|
| Client ID | 카카오 REST API 키 |
| Client Secret | 카카오 보안 탭의 Client Secret 코드 |

→ Save

---

## 3. 구글 OAuth

### 3-1. Google Cloud Console 설정

1. `https://console.cloud.google.com` → 프로젝트 선택 또는 생성
2. **APIs & Services → Credentials → + CREATE CREDENTIALS → OAuth client ID**
3. Application type: **Web application**
4. **Authorized redirect URIs** 추가:
   ```
   https://fcrwejqinsmyyqpisepv.supabase.co/auth/v1/callback
   ```
5. 생성 후 **Client ID**, **Client Secret** (클라이언트 보안 비밀번호) 복사

### 3-2. Supabase에 등록

`https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/auth/providers` → Google

| 항목 | 값 |
|------|-----|
| Client ID | Google OAuth Client ID |
| Client Secret | Google 클라이언트 보안 비밀번호 |

→ Save

---

## 4. 이메일 인증 설정

`https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/auth/settings`

- **Confirm email**: ON (프로덕션 필수)
- 로컬 테스트 시 OFF 하면 이메일 확인 없이 즉시 로그인 가능

---

## 5. 트러블슈팅

### "relation profiles does not exist"
- `handle_new_user` 함수에 `set search_path = public` 누락
- `migrate.sql`의 최신 버전으로 함수 재생성

### "Client Secret Code is required" (Supabase Kakao 설정)
- 카카오 보안 탭에서 Client Secret 생성 필수
- 카카오 로그인 활성화 후 보안 탭 노출됨

### OAuth 콜백 후 `/login?error=oauth` 리다이렉트
- Supabase Auth Logs 확인: `https://supabase.com/dashboard/project/fcrwejqinsmyyqpisepv/auth/logs`
- Redirect URI 불일치 여부 확인 (카카오/구글 콘솔과 Supabase URL 일치해야 함)
