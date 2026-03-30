# feat: [seung] 인증 전반 개선 — 회원가입 폼 강화 + 법적 페이지 + Google OAuth

## 사용자 관점 목표
처음 방문한 사용자가 신뢰할 수 있는 서비스라는 인상을 받으며, 간편하게 가입하고 로그인할 수 있다.

## 배경
현재 signup 폼은 이메일+비밀번호(6자)만 입력받고, 이름·비밀번호 확인·Zod 검증·동의 체크박스가 없다.
이용약관/개인정보처리방침 페이지가 존재하지 않아 법적 공백이 있으며, Google OAuth도 미구현 상태다.

## 완료 기준
- [x] `/terms`, `/privacy` 정적 페이지 존재하고 서비스 이름·수집 항목 등 기본 내용 포함
- [x] 회원가입 폼에 이름 필드, 비밀번호 확인, Zod 클라이언트 검증, 이용약관·개인정보 동의 체크박스(필수) 추가
- [x] 동의 체크박스 미체크 시 제출 불가 (버튼 비활성 또는 에러 메시지)
- [x] Google OAuth 버튼이 `/signup`, `/login` 양쪽에서 동작 (Supabase signInWithOAuth)

## 구현 플랜
1. **법적 페이지**: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx` 정적 페이지 생성
2. **회원가입 폼 강화**:
   - `src/app/signup/page.tsx`에 `name`, `confirmPassword` 필드 추가
   - Zod 스키마 정의 (email / password 8자 이상 / name 2자 이상 / confirmPassword 일치)
   - terms·privacy 동의 체크박스 + 각 페이지 링크 연결
3. **Google OAuth**:
   - `src/lib/supabase/browser.ts`의 `signInWithOAuth` 활용
   - OAuth 콜백은 기존 `/auth/callback` 재사용
   - signup·login 양쪽 폼에 구분선 + Google 버튼 추가

## 개발 체크리스트
- [x] 테스트 코드 포함 (Zod 스키마 단위 테스트 최소 포함)
- [x] 해당 디렉토리 `.ai.md` 최신화
- [x] 불변식 위반 없음 (인증은 서비스 레이어에서만 처리)

---

## 작업 내역

### 신규 파일

- **`src/lib/schemas/auth.ts`**: signupSchema Zod 정의. name(2자↑) / email / password(8자↑) / confirmPassword(일치) / termsAgreed·privacyAgreed(boolean refine). `z.literal(true, errorMap)` 방식이 Vitest v4 환경에서 커스텀 메시지를 반환하지 않는 문제를 확인하여 `z.boolean().refine()` 방식으로 구현.
- **`tests/lib/auth-schema.test.ts`**: signupSchema 단위 테스트 7개 (정상 입력, name/email/password/confirmPassword/termsAgreed/privacyAgreed 각 에러 케이스). 전체 통과.
- **`src/app/terms/page.tsx`**: 이용약관 정적 페이지. 서비스명 MirAI, 목적·금지행위·면책·준거법 기본 항목 포함. 미들웨어 보호 대상 미포함 — 비로그인 접근 가능.
- **`src/app/privacy/page.tsx`**: 개인정보처리방침 정적 페이지. 수집 항목(이메일·이름), 수집 목적, 보유 기간, 제3자 미제공, 이용자 권리 포함.
- **`src/components/GoogleOAuthButton.tsx`**: Google OAuth 버튼 공통 컴포넌트. `onError` 콜백으로 에러 처리 위임, 자체 loading 상태 관리. signup·login 양쪽에서 재사용.

### 수정 파일

- **`src/app/signup/page.tsx`**: name·confirmPassword 필드 추가, Zod `safeParse`로 필드별 에러 표시, 이용약관·개인정보 동의 체크박스 추가(미체크 시 버튼 비활성), GoogleOAuthButton 컴포넌트 적용. `signUp` options에 `data: { name }` 추가하여 Supabase user_metadata에 이름 저장.
- **`src/app/login/page.tsx`**: GoogleOAuthButton 컴포넌트 추가. 기존 이메일/비밀번호 로직 미변경.
- **`services/seung/.ai.md`**: 법적 페이지 위치, Zod 스키마 위치, Google OAuth 흐름, 인프라 주의사항 문서화.
- **`package.json` / `package-lock.json`**: zod `^4.3.6` 의존성 추가.

### 인프라 작업 (코드 외)

Google Cloud Console에서 OAuth 2.0 Client ID 생성, Supabase Dashboard에서 Google Provider 활성화 및 Redirect URL 등록 완료.

