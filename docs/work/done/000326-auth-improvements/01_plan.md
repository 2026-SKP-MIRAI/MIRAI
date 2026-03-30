# [#326] feat: [seung] 인증 전반 개선 — 회원가입 폼 강화 + 법적 페이지 + Google OAuth — 구현 계획

> 작성: 2026-03-30

---

## 완료 기준

- [x] `/terms`, `/privacy` 정적 페이지 존재하고 서비스 이름·수집 항목 등 기본 내용 포함
- [x] 회원가입 폼에 이름 필드, 비밀번호 확인, Zod 클라이언트 검증, 이용약관·개인정보 동의 체크박스(필수) 추가
- [x] 동의 체크박스 미체크 시 제출 불가 (버튼 비활성 또는 에러 메시지)
- [x] Google OAuth 버튼이 `/signup`, `/login` 양쪽에서 동작 (Supabase signInWithOAuth)

---

## 현재 상태 파악

- `services/seung/src/app/signup/page.tsx` — 이메일+비밀번호(minLength=6)만 수집
- `services/seung/src/app/login/page.tsx` — 이메일+비밀번호, redirectTo 안전 처리 있음
- `services/seung/src/lib/supabase/browser.ts` — `createBrowserClient` 래퍼 존재
- `services/seung/src/app/auth/callback/route.ts` — OAuth 콜백 라우트 이미 존재 → 재사용 가능
- Zod 미설치, Vitest(`^4.0.18`) 사용 중
- 기존 테스트 위치: `services/seung/tests/`

---

## 구현 계획

### Step 1 — Zod 설치

```bash
cd services/seung && npm install zod
```

- 의존: 없음. 이후 모든 단계의 전제 조건.

---

### Step 2 — Zod 스키마 정의

**파일**: `services/seung/src/lib/schemas/auth.ts` (신규)

```
signupSchema:
  - name: string, min 2자 ("이름은 2자 이상이어야 합니다")
  - email: string, email 형식
  - password: string, min 8자 ("비밀번호는 8자 이상이어야 합니다")
  - confirmPassword: string
  - termsAgreed: literal(true) ("이용약관 동의가 필요합니다")
  - privacyAgreed: literal(true) ("개인정보처리방침 동의가 필요합니다")
  + superRefine: password === confirmPassword 검증
```

- 의존: Step 1 (zod 설치)

---

### Step 3 — Zod 스키마 단위 테스트

**파일**: `services/seung/tests/lib/auth-schema.test.ts` (신규)

커버할 케이스:
- 정상 입력 → parse 성공
- name 1자 → 에러
- password 7자 → 에러
- confirmPassword 불일치 → 에러
- termsAgreed false → 에러
- privacyAgreed false → 에러
- email 형식 오류 → 에러

- 의존: Step 2

---

### Step 4 — 법적 정적 페이지 생성

**파일 2개 신규**:

1. `services/seung/src/app/terms/page.tsx`
   - 이용약관 내용 (서비스명 MirAI, 목적, 금지 행위, 면책, 준거법 등 기본 항목)

2. `services/seung/src/app/privacy/page.tsx`
   - 개인정보처리방침 (수집 항목: 이메일·이름, 수집 목적, 보유 기간, 제3자 제공 없음, 문의처)

- 의존: 없음. Step 2와 병렬 진행 가능.

---

### Step 5 — 회원가입 폼 강화

**파일**: `services/seung/src/app/signup/page.tsx` (수정)

변경 내용:
1. `react-hook-form` 없이 useState로 관리 (기존 패턴 유지)
2. 필드 추가: `name`, `confirmPassword`, `termsAgreed`, `privacyAgreed`
3. `handleSubmit` 내 `signupSchema.safeParse()` 호출 → 실패 시 필드별 에러 표시
4. 비밀번호 minLength 6 → 8로 변경 (스키마와 일치)
5. 동의 체크박스 미체크 시 제출 버튼 `disabled` 처리
   - `termsAgreed && privacyAgreed`가 false이면 버튼 비활성
6. 체크박스 레이블에 `/terms`, `/privacy` 링크 연결
7. 구분선 + Google OAuth 버튼 추가 (Step 6와 통합)

- 의존: Step 2, Step 4

---

### Step 6 — Google OAuth 버튼 추가 (signup + login)

**공통 로직**: `createClient().auth.signInWithOAuth`

```ts
const { error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${window.location.origin}/auth/callback` },
})
```

**파일 수정**:
- `services/seung/src/app/signup/page.tsx` — 폼 상단 또는 하단에 구분선 + Google 버튼
- `services/seung/src/app/login/page.tsx` — 동일 패턴

UI 패턴:
```
[이메일 폼]
─────── 또는 ───────
[Google로 계속하기 버튼]
```

- 의존: Step 2(signup), 없음(login)
- 기존 `/auth/callback` 라우트 재사용 → 별도 라우트 신규 생성 불필요

---

### Step 7 — `.ai.md` 최신화

`services/seung/src/app/` 또는 `services/seung/` 의 `.ai.md`에 아래 항목 추가:
- `/terms`, `/privacy` 정적 페이지 존재
- signup 폼 Zod 검증 스키마 위치: `src/lib/schemas/auth.ts`
- Google OAuth 흐름: signup·login → `/auth/callback` 재사용

- 의존: Step 4~6 완료 후

---

## 작업 순서 요약

```
Step 1 (zod 설치)
  └→ Step 2 (스키마 정의)
       ├→ Step 3 (단위 테스트)
       └→ Step 5 (signup 폼 강화)
            └→ Step 6 (OAuth, signup 측)

Step 4 (법적 페이지) — 병렬 진행 가능

Step 6 (login OAuth) — Step 4·5와 무관, 독립 진행 가능

Step 7 (.ai.md) — 마지막
```

---

## 주의사항 / 엣지 케이스

- **OAuth 에러 처리**: `signInWithOAuth` 실패 시 에러 메시지 표시 (팝업 차단 등)
- **Supabase Dashboard 설정**: Google OAuth Provider 활성화 및 Redirect URL 등록은 인프라 작업 — 코드 외 필요 (별도 확인 요청)
- **불변식**: 인증 로직은 `services/seung`(Next.js 서비스)에만 위치 — 엔진 레이어 미접촉
- **zod import**: 서버 컴포넌트/클라이언트 컴포넌트 양쪽에서 사용 가능하나 스키마는 `src/lib/schemas/`에 분리하여 재사용성 확보
