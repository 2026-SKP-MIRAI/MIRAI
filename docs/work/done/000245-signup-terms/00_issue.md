# feat: [siw] 회원가입 이용약관 동의 페이지

## 사용자 관점 목표
실제 사용자가 서비스를 이용하기 전에 이용약관과 개인정보처리방침에 명시적으로 동의하여, 법적 요건을 충족하고 사용자가 안심하고 가입할 수 있다.

## 배경
현재 회원가입 폼에 이용약관 동의 절차가 없어, 실제 사용자 대상 서비스 운영 시 법적 요건(개인정보보호법, 정보통신망법)을 충족하지 못한다. 회원가입 폼에 체크박스를 추가하고, 약관 내용은 별도 페이지 링크로 제공한다.

## 완료 기준
- [x] 회원가입 폼에 이용약관·개인정보처리방침 동의 체크박스가 있고, 체크하지 않으면 가입 불가
- [x] 이용약관·개인정보처리방침 각각 별도 페이지에서 내용 확인 가능 (링크로 이동)
- [x] 동의 시점(`terms_agreed_at`)이 Supabase user_metadata에 기록됨
- [x] pytest/vitest 커버리지 — 체크 미동의 시 가입 차단 검증

## 구현 플랜

**1단계: 이용약관·개인정보처리방침 콘텐츠 페이지 생성**
- `services/siw/src/app/(auth)/terms/page.tsx` — 이용약관
- `services/siw/src/app/(auth)/privacy/page.tsx` — 개인정보처리방침

**2단계: 회원가입 폼에 체크박스 추가**
- `services/siw/src/app/(auth)/signup/page.tsx` — 약관 동의 체크박스 (링크로 약관 페이지 열기)
- `services/siw/src/lib/auth/schemas.ts` — `agreeToTerms: z.literal(true)` 검증 추가

**3단계: Supabase user_metadata에 동의 시점 기록**
- `signUp` 호출 시 `options.data`에 `terms_agreed_at: new Date().toISOString()` 저장

**4단계: 테스트**
- `services/siw/tests/ui/signup.test.tsx` 업데이트 — 체크 안 하면 가입 불가 검증

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `services/siw/src/app/(auth)/terms/page.tsx` | 신규 생성 — 이용약관 페이지 |
| `services/siw/src/app/(auth)/privacy/page.tsx` | 신규 생성 — 개인정보처리방침 페이지 |
| `services/siw/src/app/(auth)/signup/page.tsx` | 동의 체크박스 추가 |
| `services/siw/src/lib/auth/schemas.ts` | `agreeToTerms` 검증 추가 |
| `services/siw/tests/ui/signup.test.tsx` | 동의 미체크 시 가입 차단 테스트 |

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 2026-03-25 — 구현 완료 (4/4)

**schemas.ts** — `signupSchema`에 `agreeToTerms`, `agreeToPrivacy` 필드를 `z.boolean().refine()` 패턴으로 추가 (Zod v4 호환). `consentFields` 공유 상수로 `consentSchema`와 중복 제거. 기존 비밀번호 검증 로직 영향 없음.

**signup/page.tsx** — 체크박스 2개 (이용약관·개인정보처리방침) 추가, `signupSchema.safeParse`에 동의 필드 포함. 미체크 시 `fieldErrors`로 각각 에러 표시. `signUp options.data`에 `terms_agreed_at: new Date().toISOString()` 추가. `handleGoogleSignup`도 미동의 시 즉시 return하여 OAuth 시작 차단.

**terms/page.tsx, privacy/page.tsx** — 신규 서버 컴포넌트. AI기본법·개인정보보호법 기반 실제 약관 내용 포함. 자체 스크롤 컨테이너(`overflow-y-auto max-h-[80vh]`). 개인정보처리방침에 Anthropic 국외이전(미국) 명시.

**callback/route.ts** — `exchangeCodeForSession` 반환 user로 신규 가입 여부(`!terms_agreed_at`) 판별 → `updateUser({ data: { terms_agreed_at } })` 직접 저장 후 대시보드 이동. 별도 consent 페이지 없이 처리.

**api/auth/delete/route.ts** — 서비스 내 회원탈퇴용 API. `supabaseAdmin.auth.admin.deleteUser(userId)` 사용 (service role key 서버에서만 사용).

**signup.test.tsx** — `fillForm` 헬퍼에 `checkTerms`, `checkPrivacy` 파라미터 추가. 기존 4개 테스트 통과 유지. 신규 테스트 2개: "이용약관 미동의 시 가입 차단", "개인정보처리방침 미동의 시 가입 차단" (6/6 통과).

**변경 파일**: 7개 수정·4개 신규

---

### 추가 수정 (커밋 후 법적 검토 반영)

**terms/page.tsx** — 제5조 문의 경로: "서비스 내 문의하기/고객센터" → `[운영팀 이메일]로 이메일 문의`로 교체 (미구현 기능 기술 제거). 제8조: "7일 이상 사전 공지" → "사전 공지를 원칙으로 하며, 불가피한 사유 시 사후 공지 가능"으로 완화 (이행 불가 조항 제거).

**privacy/page.tsx** — 처리위탁 Anthropic 항목: "위탁 계약 기준으로 처리됩니다" → "Anthropic API 이용약관에 따라 처리됩니다" (미체결 DPA 계약 표현 제거).

**consent/page.tsx 삭제** — OAuth 흐름 단순화. Google 로그인 전 signup 페이지 체크박스 2개 필수 확인으로 충분. callback에서 직접 `updateUser`로 처리.

**변경 파일 최종**: 7개 수정·4개 신규

