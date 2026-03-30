# [#326] feat: [seung] 인증 전반 개선 — 회원가입 폼 강화 + 법적 페이지 + Google OAuth — 테스트 결과

> 작성: 2026-03-30

---

## 최종 테스트 결과

### Vitest 단위 테스트 (services/seung/tests/lib/auth-schema.test.ts)

```
9 passed in 5ms
```

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/lib/auth-schema.test.ts` | 9 | ✅ 전체 통과 | signupSchema 유효성 검증 케이스 |

**테스트 케이스 상세:**

| 테스트 | 결과 |
|--------|------|
| 정상 입력 → parse 성공 | ✅ |
| name 1자 → 에러 | ✅ |
| name 51자 → 에러 | ✅ |
| name 앞뒤 공백 → trim 후 parse 성공 | ✅ |
| email 형식 오류 → 에러 | ✅ |
| password 7자 → 에러 | ✅ |
| confirmPassword 불일치 → 에러 | ✅ |
| termsAgreed false → 에러 | ✅ |
| privacyAgreed false → 에러 | ✅ |

> **수정 사항**: `z.literal(true, { errorMap })` 방식이 Vitest v4 환경에서 커스텀 메시지를 반환하지 않는 문제 확인 → `z.boolean().refine(v => v === true, { message })` 방식으로 수정 후 통과.

---

### 수동 테스트 — 회원가입 플로우

| 항목 | 결과 | 비고 |
|------|------|------|
| 이름 1자 입력 시 에러 메시지 표시 | ✅ | "이름은 2자 이상이어야 합니다" |
| 비밀번호 7자 입력 시 에러 메시지 표시 | ✅ | "비밀번호는 8자 이상이어야 합니다" |
| 비밀번호 불일치 시 에러 메시지 표시 | ✅ | "비밀번호가 일치하지 않습니다" |
| 동의 체크박스 미체크 시 버튼 비활성 | ✅ | 두 체크박스 모두 체크해야 활성화 |
| 이용약관 링크 클릭 → /terms 페이지 이동 | ✅ | 새 탭으로 열림 |
| 개인정보처리방침 링크 클릭 → /privacy 페이지 이동 | ✅ | 새 탭으로 열림 |
| 정상 입력 후 회원가입 → 이메일 인증 안내 화면 | ✅ | Supabase 인증 메일 발송 확인 |

### 수동 테스트 — Google OAuth

| 항목 | 결과 | 비고 |
|------|------|------|
| /signup Google 버튼 클릭 → Google 계정 선택 화면 | ✅ | |
| Google 계정 선택 → /dashboard 리다이렉트 | ✅ | /auth/callback 경유 |
| /login Google 버튼 클릭 → 동일 플로우 동작 | ✅ | |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `services/seung/src/lib/schemas/auth.ts` | signupSchema Zod 정의 | ✅ |
| `services/seung/tests/lib/auth-schema.test.ts` | signupSchema 단위 테스트 9개 | ✅ |
| `services/seung/src/app/terms/page.tsx` | 이용약관 정적 페이지 | ✅ |
| `services/seung/src/app/privacy/page.tsx` | 개인정보처리방침 정적 페이지 | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `services/seung/src/app/signup/page.tsx` | name·confirmPassword 필드, Zod 검증, 동의 체크박스, GoogleOAuthButton 컴포넌트 적용 | ✅ |
| `services/seung/src/app/login/page.tsx` | GoogleOAuthButton 컴포넌트 추가 | ✅ |
| `services/seung/src/components/GoogleOAuthButton.tsx` | Google OAuth 공통 컴포넌트 (자체 loading, onError 콜백) | ✅ |
| `services/seung/.ai.md` | 법적 페이지·스키마 위치·OAuth 흐름 문서화 | ✅ |
| `services/seung/package.json` | zod 의존성 추가 | ✅ |

---

## 인프라 작업 (코드 외)

| 항목 | 결과 | 비고 |
|------|------|------|
| Google Cloud Console OAuth 2.0 Client ID 생성 | ✅ | Redirect URI: `https://rwocoqfqhgzleukzopyt.supabase.co/auth/v1/callback` |
| Supabase Dashboard Google Provider 활성화 | ✅ | Client ID / Secret 등록 완료 |
| Supabase Redirect URL 추가 | ✅ | `http://localhost:3000/auth/callback` |
| Supabase 비밀번호 최소 길이 8자 설정 | ✅ | Authentication → Sign In / Providers → Email → Minimum password length |
