# [#88] Supabase Auth 연동 — 테스트 결과

> 테스트 일시: 2026-03-15
> 테스트 환경: `http://localhost:3000` (npm run dev)

---

## 1. 미들웨어 — 보호 라우트 리다이렉트

미인증 상태에서 보호 경로 접근 시 `/login?redirectTo=<경로>` 로 307 리다이렉트되는지 확인.

| 경로 | 기대 결과 | 실제 결과 | 상태 |
|------|-----------|-----------|------|
| `GET /dashboard` | 307 → `/login?redirectTo=%2Fdashboard` | 307 → `/login?redirectTo=%2Fdashboard` | ✅ |
| `GET /resumes` | 307 → `/login?redirectTo=%2Fresumes` | 307 → `/login?redirectTo=%2Fresumes` | ✅ |
| `GET /interview/new` | 307 → `/login?redirectTo=%2Finterview%2Fnew` | 307 → `/login?redirectTo=%2Finterview%2Fnew` | ✅ |
| `GET /growth` | 307 → `/login?redirectTo=%2Fgrowth` | 307 → `/login?redirectTo=%2Fgrowth` | ✅ |

---

## 2. 공개 페이지 접근

인증 없이 접근 가능한 공개 페이지 200 응답 확인.

| 경로 | 기대 결과 | 실제 결과 | 상태 |
|------|-----------|-----------|------|
| `GET /` | 200 | 200 | ✅ |
| `GET /login` | 200 | 200 | ✅ |
| `GET /signup` | 200 | 200 | ✅ |

---

## 3. Open Redirect 방어

외부 URL로의 리다이렉트 시도가 차단되는지 확인.

| 시도 | 기대 결과 | 실제 결과 | 상태 |
|------|-----------|-----------|------|
| `GET /auth/callback?next=https://evil.com` | `/dashboard` 로 강제 이동 | 307 → `/dashboard` | ✅ |
| 미들웨어 `redirectTo` 파라미터 | `/`로 시작하는 경로만 허용 | 내부 경로만 설정됨 | ✅ |

---

## 4. OAuth 콜백 에러 처리

| 시나리오 | 기대 결과 | 실제 결과 | 상태 |
|----------|-----------|-----------|------|
| `GET /auth/callback?code=invalid_code` | `/login?error=oauth` 리다이렉트 | 307 → `/login?error=oauth` | ✅ |

---

## 5. Interview Start API — userId 처리

| 시나리오 | 기대 결과 | 실제 결과 | 상태 |
|----------|-----------|-----------|------|
| `POST /api/interview/start` 빈 바디 | 400 Bad Request | 400 | ✅ |
| `POST /api/interview/start` 유효 바디 (엔진 미실행) | 500 (engine 미실행) | 500 | ✅ (엔진 문제, auth 아님) |

---

## 6. vitest 단위/통합 테스트

```
Test Files  21 passed (21)
Tests       90 passed (90)
```

| 테스트 파일 | 케이스 수 | 결과 |
|-------------|-----------|------|
| `tests/unit/middleware.test.ts` | 4 | ✅ |
| `tests/ui/login.test.tsx` | 3 | ✅ |
| `tests/ui/signup.test.tsx` | 4 | ✅ |
| `tests/api/interview-start-route.test.ts` | 3 | ✅ |
| 기존 테스트 17개 파일 | 76 | ✅ (회귀 없음) |

---

## 7. 브라우저 직접 테스트 필요 항목

아래 항목은 Supabase 클라이언트 SDK가 브라우저에서 동작하므로 **직접 브라우저에서 확인 필요**.

### 7-1. 회원가입 (`/signup`)
- [ ] 유효한 이메일 + 비밀번호(8자+영문+숫자) 입력 후 회원가입 버튼 클릭
  - 기대: "이메일을 확인해주세요" 안내 화면 표시
- [ ] 비밀번호 7자 입력
  - 기대: "8자 이상 입력해주세요" 에러 표시
- [ ] 영문 없는 비밀번호 입력
  - 기대: "영문과 숫자를 포함해야 합니다" 에러 표시
- [ ] 비밀번호 불일치 입력
  - 기대: "비밀번호가 일치하지 않습니다" 에러 표시

### 7-2. 로그인 (`/login`)
- [ ] 가입된 이메일 + 올바른 비밀번호 입력 후 로그인
  - 기대: `/dashboard` 이동
- [ ] 잘못된 비밀번호 입력
  - 기대: "이메일 또는 비밀번호가 올바르지 않습니다" 에러 (원인 구분 없음)
- [ ] 로그인 후 `/dashboard` 직접 접근
  - 기대: 리다이렉트 없이 정상 접근
- [ ] `?redirectTo=/interview/new` 파라미터 포함된 URL에서 로그인
  - 기대: 로그인 성공 후 `/interview/new` 이동

### 7-3. Google OAuth (`/login`)
- [ ] "Google로 계속하기" 버튼 클릭
  - 기대: Google 계정 선택 화면으로 이동
- [ ] Google 계정 선택 후 인증 완료
  - 기대: `/auth/callback` 거쳐 `/dashboard` 이동
- [ ] Sidebar에 Google 계정 이메일 표시 확인

### 7-4. Sidebar + 로그아웃
- [ ] 로그인 후 Sidebar 하단에 실제 이메일 표시 확인
  - 기대: `user@example.com` 하드코딩 대신 실제 로그인 이메일
- [ ] 로그아웃 버튼 클릭
  - 기대: 랜딩(`/`) 이동, 다시 `/dashboard` 접근 시 `/login` 리다이렉트

### 7-5. 랜딩 페이지 CTA
- [ ] 미인증 상태에서 "시작하기" 버튼 클릭
  - 기대: `/login` 이동
- [ ] 로그인 상태에서 "시작하기" 버튼 클릭
  - 기대: `/dashboard` 이동
- [ ] NAV "로그인" 링크 클릭
  - 기대: `/login` 이동

### 7-6. 기존 인터뷰 흐름 회귀 확인
- [ ] 로그인 후 이력서 업로드 → 면접 시작 → 답변 → 리포트 흐름 정상 동작
- [ ] 면접 세션 생성 시 DB `interview_sessions.userId` 실제 저장 확인
  - Supabase Dashboard → Table Editor → `interview_sessions` → userId 컬럼 확인

---

## 8. 미확인 항목 (수동 설정 완료 후 테스트 필요)

| 항목 | 이유 | 확인 방법 |
|------|------|-----------|
| Google OAuth 실제 로그인 | Google Cloud Console + Supabase 설정 완료 후 가능 | 브라우저에서 직접 |
| RLS 정책 적용 | SQL 실행 완료 여부 확인 필요 | Supabase → Authentication → Policies |
| `interview_sessions.userId` DB 저장 | 실제 로그인 후 면접 세션 생성 필요 | Supabase → Table Editor |

---

## 3차 테스트 — 보안 패치 후 자동화 테스트

### 테스트 실행 결과
```
Test Files  21 passed (21)
Tests       90 passed (90)
Start at    19:24:05
Duration    4.84s
```

### 보안 이슈 수정 검증
| 이슈 | 수정 내용 | 검증 방법 |
|------|---------|----------|
| P0-1 IDOR | answer/followup/complete/report에 auth guard 추가 | 미인증 요청 → 401 |
| P0-3 start 미인증 | user null 시 401 리턴 | 미인증 → 401 |
| P1-1 resumes 전체 노출 | userId 필터 추가 | 내 이력서만 조회 |
| P1-2 callback code 없음 | code 없을 시 /login?error=oauth | 에러 페이지 이동 |
| P2-1 Open Redirect | // 차단 | //evil.com → 차단 |
| P2-2 growth 401 | 미인증 시 401 | 401 응답 |
