# [#245] feat: [siw] 회원가입 이용약관 동의 페이지 — 구현 계획

> 작성: 2026-03-25
> Revision v6 — 최종 법적 검토 반영 (OAuth 거부 시 user 삭제, 국외이전 인지 강화, Anthropic 표현 완화)

---

## 완료 기준

- [ ] 회원가입 폼에 이용약관·개인정보처리방침 동의 체크박스가 있고, 체크하지 않으면 가입 불가
- [ ] 이용약관·개인정보처리방침 각각 별도 페이지에서 내용 확인 가능 (링크로 이동)
- [ ] 동의 시점(`terms_agreed_at`)이 Supabase user_metadata에 기록됨
- [ ] pytest/vitest 커버리지 — 체크 미동의 시 가입 차단 검증
- [ ] Google OAuth 첫 로그인(신규 가입) 시에도 약관 동의 후 서비스 진입

---

## 구현 계획

> Revision v5 — 법적 검토 기반 수정 (2026-03-25)
> 출처: 개인정보보호법(2023.9.15. 시행), 개인정보보호위원회 생성형 AI 안내서(2025.8.), 약관규제법, AI기본법(2025.1.21. 공포)

---

### 법적 배경 요약

#### 동의 분리 (이용약관 vs 개인정보처리방침)

개인정보보호법 제22조는 "동의 방식"을 규정하는 조문이며, 약관과 개인정보 동의를 반드시 분리해야 한다는 명시적 조문은 없다. 다만 KISA·PIPC 가이드라인에서 분리를 강력 권장하며, 실무 기준으로 굳어져 있다. 본 구현에서 2개로 분리하는 것은 **권장사항을 따른 안전한 선택**이다.

#### pre-checked 체크박스 금지

"명시적이고 자유로운 의사 표시" 요건에서 도출된 실무 기준으로, 판례·KISA 가이드라인·GDPR 영향으로 정착되었다. 기본값 체크 상태는 유효한 동의로 인정받지 못한다.

#### 국외이전 근거 (법 제28조의8)

미국은 한국 기준 동등성 인정 국가가 아니다. 따라서 Anthropic·AWS로의 국외이전 근거는:
- **정보주체 동의** (회원가입 시 개인정보처리방침 동의로 포함)
- 또는 **계약 이행에 필요한 경우** (엄격 조건, API 처리위탁의 경우 병행 적용)

→ 처리방침에서 "동등한 보호 수준 국가" 문구는 사용하지 않는다.

#### Anthropic API — 처리위탁 vs 제3자 제공

Anthropic Claude API는 사용자 입력 데이터를 모델 학습에 사용하지 않는다 (Anthropic API 이용약관 기준). 따라서 **처리위탁(법 제26조)에 해당**한다. 단, 계약(DPA) 상 이를 명시적으로 확인해야 하며, 처리방침에 "학습에 사용되지 않음"을 명시하면 이용자 신뢰도 향상 효과도 있다.

#### AI 자동화 의사결정 조항 (법 제37조의2)

자소서 피드백 서비스는 "권리·의무에 중대한 영향"을 주는 자동화 의사결정에 해당하지 않을 가능성이 높다. 그러나 해당 조항을 이용약관에 포함하는 것은 **안전한 선택**이며, "의무"가 아닌 "이용자 권리로서 행사 가능" 수준으로 기술한다.

---

### Scope Decisions

#### In Scope (이번 이슈에서 해결): Google OAuth 첫 로그인 동의 강제

로그인 페이지의 Google OAuth로 신규 가입이 발생하면, 개인정보(이메일·프로필)가 동의 없이 수집될 수 있다. 이는 개인정보보호법 제15조 위반 가능성이 있으므로 이번 이슈에서 해결한다.

**구현 방법**: OAuth 콜백(`auth/callback/route.ts`)에서 신규 사용자 여부를 확인하여, `terms_agreed_at`이 없으면 `/consent` 페이지로 리다이렉트한다. 이용자가 동의하면 `user_metadata`에 `terms_agreed_at`을 기록하고 `/dashboard`로 이동한다.

#### Out of Scope: 선택적 동의 항목 (마케팅 수신, 제3자 제공)

현재 MVP 단계에서 마케팅 발송·외부 제3자 제공 계획 없음. 추후 유료화·파트너십 시 추가한다.

---

### Task Flow (의존성 순서)

```
Step 1: schemas.ts 수정 — 2개 필수 동의 필드
    |
Step 2: 법적 내용 기반 terms/page.tsx, privacy/page.tsx 생성
    + consent/page.tsx 신규 생성 (OAuth 첫 로그인용)
    (Step 1과 독립, 병렬 가능)
    |
Step 3: signup/page.tsx 수정 (이메일 가입 경로)
    + auth/callback/route.ts 수정 (OAuth 콜백: 신규 판별 + 동의 리다이렉트)
    (Step 1, 2 의존)
    |
Step 4: signup.test.tsx 수정 + 신규 테스트 (Step 1, 3 의존)
    |
Step 5: .ai.md 최신화 + 검증
```

---

### Step 1: signupSchema에 약관 동의 필드 2개 추가

**File:** `services/siw/src/lib/auth/schemas.ts`

이용약관 동의와 개인정보처리방침 동의를 별도 필드로 분리한다 (KISA·PIPC 실무 권장).

```ts
export const signupSchema = z.object({
  name: ...,
  email: ...,
  password: passwordSchema,
  confirmPassword: z.string(),
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: "이용약관에 동의해주세요" }),
  }),
  agreeToPrivacy: z.literal(true, {
    errorMap: () => ({ message: "개인정보처리방침에 동의해주세요" }),
  }),
}).refine(...)
```

**AC:**
- `agreeToTerms: false` → 실패, 에러 "이용약관에 동의해주세요"
- `agreeToPrivacy: false` → 실패, 에러 "개인정보처리방침에 동의해주세요"
- 둘 다 `true` → 기존 검증 정상 통과

**consent 전용 스키마** (OAuth 첫 로그인용):
```ts
export const consentSchema = z.object({
  agreeToTerms: z.literal(true, {
    errorMap: () => ({ message: "이용약관에 동의해주세요" }),
  }),
  agreeToPrivacy: z.literal(true, {
    errorMap: () => ({ message: "개인정보처리방침에 동의해주세요" }),
  }),
})
```

---

### Step 2: 약관 페이지 생성 (실제 법적 내용)

**Files:**
- `services/siw/src/app/(auth)/terms/page.tsx` (신규)
- `services/siw/src/app/(auth)/privacy/page.tsx` (신규)
- `services/siw/src/app/(auth)/consent/page.tsx` (신규 — OAuth 첫 로그인용)

- 서버 컴포넌트 (terms, privacy) / 클라이언트 컴포넌트 (consent)
- `(auth)` 레이아웃 재사용, `(auth)/layout.tsx`는 수정하지 않음
- 자체 스크롤 컨테이너 (`overflow-y-auto`, `max-h-[80vh]`)

---

#### 2-A: 이용약관 (`terms/page.tsx`) 포함 내용

법적 근거: 약관규제법 제3조, 전자상거래법 제13조, AI기본법 제22조

| 조항 | 내용 |
|------|------|
| 제1조 목적 | 서비스 목적 및 약관 적용 범위 |
| 제2조 정의 | 이용자, 서비스, AI 분석 결과물 |
| 제3조 서비스 내용 | AI 면접 코칭, 자소서·이력서 분석·피드백 (AI기본법 제22조: AI 서비스임을 명시) |
| 제4조 AI 서비스 특성 및 책임 한계 | "AI 분석 결과는 참고용이며 채용 결과를 보장하지 않음" / 고의·중과실 없는 한 책임 제한 (약관규제법 제7조 범위 내) |
| 제5조 자동화 의사결정 이의제기 | 이용자는 AI 분석 결과에 대해 설명 요구 및 이의제기 가능 (법 제37조의2 적용 가능성 — 이용자 권리로서 행사 가능) |
| 제6조 이용자 의무 | 허위정보 업로드 금지, 타인 자소서 도용 금지 |
| 제7조 저작권 | AI 생성 피드백은 개인 참고 목적 제공, 상업적 재배포 금지 |
| 제8조 서비스 변경·중단 | 사전 7일 이상 공지 |
| 제9조 연령 제한 | 만 14세 미만 이용 제한 (법 제22조의2) |
| 제10조 준거법 및 분쟁 해결 | 대한민국 법률 적용 |

---

#### 2-B: 개인정보처리방침 (`privacy/page.tsx`) 포함 내용

법적 근거: 개인정보보호법 제30조 제1항 (2023.9.15. 시행)

**1. 수집하는 개인정보 항목 및 수집 목적**

| 구분 | 수집 항목 | 수집 목적 | 법적 처리 근거 |
|------|----------|----------|--------------|
| 필수 | 이름, 이메일, 비밀번호 | 회원가입·본인확인·서비스 제공 | 계약 이행 (법 제15조①4호) |
| 서비스 이용 | 자기소개서, 이력서 내용 | AI 면접 코칭 분석·피드백 생성 | 계약 이행 (법 제15조①4호) |
| 자동 수집 | 접속 IP, 쿠키, 서비스 이용 기록 | 서비스 보안·통계·오류 분석 | 정당한 이익 (법 제15조①6호) |

※ 장애·보훈·종교 등 민감정보는 수집하지 않습니다.

**2. 개인정보 처리 및 보유 기간**

| 항목 | 보유기간 |
|------|---------|
| 회원 정보 | 회원 탈퇴 시까지 |
| 자기소개서·이력서 | 사용자 삭제 또는 탈퇴 시까지 |
| AI 분석 피드백 | 서비스 제공 목적 달성 시까지 (탈퇴 시 파기) |
| 접속 로그·IP | 3개월 (통신비밀보호법 제15조의2) |

**3. 개인정보 처리위탁 (법 제26조)**

| 수탁자 | 위탁 업무 | 위탁 항목 | 비고 |
|--------|---------|---------|-----|
| Anthropic, PBC | AI 기반 자기소개서·이력서 분석 및 피드백 생성 | 사용자 업로드 자기소개서·이력서 내용 | API 정책상 입력 데이터는 모델 학습에 사용되지 않는 것으로 안내되어 있으며, 위탁 계약(DPA) 기준으로 처리됩니다 |
| Amazon Web Services, Inc. | 서버 운영 및 데이터 저장 | 서비스 전반 데이터 | — |

**4. 개인정보의 국외 이전 (법 제28조의8)**

| 이전 대상국 | 수령자 | 이전 항목 | 이전 목적 | 이전 근거 |
|-----------|------|---------|---------|---------|
| 미국 | Anthropic, PBC | 자기소개서·이력서 내용 | AI 분석 | 정보주체 동의 (본 개인정보처리방침 동의 포함) |
| 미국 | Amazon Web Services, Inc. | 서비스 전반 데이터 | 서버 운영 | 정보주체 동의 (본 개인정보처리방침 동의 포함) |

**5. 정보주체의 권리·의무 및 행사방법 (법 제35조~제37조의2)**

이메일 요청 시 10일 이내 처리:
- 개인정보 열람 요구권 (법 제35조)
- 개인정보 정정·삭제 요구권 (법 제36조)
- 개인정보 처리 정지 요구권 (법 제37조)
- AI 분석 결과에 대한 설명 요구 및 이의제기 가능 (법 제37조의2 적용 가능성)

**6. 쿠키 및 자동 수집 장치 운영 (법 제30조①7호)**

- 쿠키: 세션 유지, 서비스 설정 저장 목적으로 사용
- 브라우저 설정에서 쿠키 거부 가능하나, 일부 서비스 기능 제한될 수 있음

**7. 개인정보 파기 절차 및 방법 (법 제21조)**

- 전자파일: 복구 불가한 방법으로 영구 삭제
- 보유기간 종료 후 5일 이내 파기

**8. 개인정보 보호책임자**

| 항목 | 내용 |
|------|------|
| 성명 | [담당자 이름] |
| 연락처 | [이메일] |

**9. 개인정보처리방침 변경 고지**

변경 시 시행일 7일 전 서비스 내 공지.

---

#### 2-C: OAuth 동의 페이지 (`consent/page.tsx`)

**목적**: Google OAuth로 신규 가입한 이용자가 약관 동의 없이 서비스에 진입하지 않도록 하는 중간 동의 화면.

**구조**:
- 클라이언트 컴포넌트
- consentSchema로 두 체크박스 검증
- 동의 완료 시 → Supabase `updateUser({ data: { terms_agreed_at: new Date().toISOString() } })` → `/dashboard` 리다이렉트
- 동의 거부(거부 버튼) 시 → **`supabase.auth.admin.deleteUser(user.id)`로 계정 삭제** → `supabase.auth.signOut()` → `/login`
  - 이유: OAuth 콜백 시점에 이미 개인정보(이메일 등)가 Supabase에 수집됨. 동의 거부 시 즉시 삭제해야 법 제21조 파기 의무 충족
  - `admin.deleteUser`는 service role key 필요 → Server Action 또는 `/api/auth/delete` API Route로 구현 (클라이언트에 service key 노출 금지)

```
[필수] 이용약관에 동의합니다 □  → /terms 링크 (새 탭)
[필수] 개인정보처리방침에 동의합니다 □  → /privacy 링크 (새 탭)

[동의하고 시작하기] 버튼
```

---

### Step 3: signup/page.tsx + auth/callback/route.ts 수정

**Files:**
- `services/siw/src/app/(auth)/signup/page.tsx`
- `services/siw/src/app/auth/callback/route.ts`

#### 3-A: 이메일 가입 경로 (signup/page.tsx)

UI 구조:
```
[필수] 이용약관에 동의합니다 □  → /terms 링크
[필수] 개인정보처리방침에 동의합니다 (국외이전 포함) □  → /privacy 링크

※ 각 항목을 직접 체크해야 가입이 가능합니다.
```

> 국외이전 인지 강화: 체크박스 라벨에 "(국외이전 포함)"을 명시하여 이용자가 개인정보처리방침 동의 시 국외이전(Anthropic·AWS 미국 서버)을 인지했음을 명확히 한다. 개인정보처리방침 본문에도 강조 문구 추가: "귀하의 자기소개서·이력서는 AI 분석을 위해 미국에 위치한 Anthropic 서버로 전송됩니다."

- `agreeToTerms`, `agreeToPrivacy` state 추가 (`useState(false)`)
- **기본값 `false`** — pre-checked 금지
- `signupSchema.safeParse`에 두 필드 포함
- `signUp` 호출 시 `options.data`에 `terms_agreed_at: new Date().toISOString()` 추가

#### 3-B: Google OAuth 경로 (signup/page.tsx)

- `handleGoogleSignup`에서 `agreeToTerms === false || agreeToPrivacy === false`이면 각 에러 메시지 표시 후 return
- 체크 상태에서만 `signInWithOAuth` 호출

#### 3-C: OAuth 콜백 (auth/callback/route.ts)

`exchangeCodeForSession` 직후:

```ts
const { data: { user } } = await supabase.auth.getUser()

// 신규 사용자 판별: terms_agreed_at 없으면 동의 페이지로
if (user && !user.user_metadata?.terms_agreed_at) {
  return NextResponse.redirect(new URL('/consent', requestUrl.origin))
}
```

- 기존 사용자(이미 terms_agreed_at 있음) → `/dashboard` 정상 이동
- 신규 사용자(terms_agreed_at 없음) → `/consent`로 리다이렉트
- `/consent`에서 동의 완료 시 `updateUser`로 기록

---

### Step 4: 테스트 수정 및 추가

**File:** `services/siw/tests/ui/signup.test.tsx`

#### 4-A: fillForm 헬퍼 수정

```ts
const fillForm = (password: string, confirmPassword: string) => {
  // 기존 필드 (name, email, password, confirmPassword)
  fireEvent.click(screen.getByRole('checkbox', { name: /이용약관/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /개인정보처리방침/ }))
  fireEvent.submit(screen.getByRole("button", { name: /가입하고 시작하기/ }))
}
```

#### 4-B: 기존 테스트 보강

- "유효한 입력 시 signUp 호출": `options.data`에 `terms_agreed_at` 포함 검증 추가

#### 4-C: 신규 테스트 케이스

1. **이용약관 미동의 시 차단**
   - 개인정보처리방침만 체크, 이용약관 미체크
   - "이용약관에 동의해주세요" 에러 확인, mockSignUp 미호출

2. **개인정보처리방침 미동의 시 차단**
   - 이용약관만 체크, 개인정보처리방침 미체크
   - "개인정보처리방침에 동의해주세요" 에러 확인, mockSignUp 미호출

---

### Step 5: .ai.md 최신화 + 검증

- `services/siw/.ai.md`: terms, privacy, consent 페이지 추가, 법적 준수 항목 반영
- `vitest run` 전체 테스트 통과 확인

---

### 수정 파일 목록

| 파일 | 변경 |
|------|------|
| `services/siw/src/lib/auth/schemas.ts` | `agreeToTerms` + `agreeToPrivacy` + `consentSchema` 추가 |
| `services/siw/src/app/(auth)/terms/page.tsx` | 신규 — 실제 법적 이용약관 |
| `services/siw/src/app/(auth)/privacy/page.tsx` | 신규 — 실제 법적 개인정보처리방침 |
| `services/siw/src/app/(auth)/consent/page.tsx` | 신규 — OAuth 첫 로그인 동의 화면 |
| `services/siw/src/app/(auth)/signup/page.tsx` | 체크박스 2개 UI + OAuth 차단 |
| `services/siw/src/app/auth/callback/route.ts` | 신규 사용자 판별 + /consent 리다이렉트 |
| `services/siw/tests/ui/signup.test.tsx` | fillForm 헬퍼 + 신규 테스트 2개 |
| `services/siw/.ai.md` | 구조 최신화 |

---

### 법적 출처

- 국가법령정보센터 — 개인정보보호법 제15조·제22조·제26조·제28조의8·제30조·제37조의2
- 국가법령정보센터 — 약관규제법 제3조·제7조, 전자상거래법 제13조
- 국가법령정보센터 — AI기본법 제22조 (2025.1.21. 공포)
- 개인정보보호위원회 — 생성형 AI 개발·활용을 위한 개인정보 처리 안내서 (2025.8.)
- Anthropic — API 이용약관 (API 입력 데이터 학습 미사용 정책)
- 잡코리아·원티드 개인정보처리방침 (업계 참고 사례)
