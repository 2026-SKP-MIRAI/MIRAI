# TDD 테스트 전략 — 이슈 #140

> 완료: 2026-03-19

---

## 테스트 실행 결과 (최종)

### Unit/Integration (Vitest)

```
총 126개 테스트 통과 (기존 포함)
```

| 파일 | 케이스 수 | 결과 |
|------|----------|------|
| `tests/api/resume-feedback-route.test.ts` (신규) | 4 | ✅ 전부 통과 |
| `tests/api/resumes-route.test.ts` (기존 확장) | +4 추가 | ✅ 전부 통과 |

### E2E (Playwright)

| 파일 | 케이스 수 | 결과 |
|------|----------|------|
| `tests/e2e/resume-feedback.spec.ts` (mock) | 5 | ✅ 전부 통과 |
| `tests/e2e/resume-feedback-real.spec.ts` (실제 PDF) | 1 | ✅ 통과 (30초) |

---

## 기존 테스트 인프라 분석

### 테스트 프레임워크
- **Vitest** v2.x — `vitest run` (1회 실행), `vitest` (watch 모드)
- **환경**: `tests/api/**` → `node` 환경 (jsdom 아님)
- **alias**: `@/` → `./src/` (vitest.config.ts에서 path.resolve로 설정)
- **setup**: `./tests/setup.ts`

### 실행 명령
```bash
cd services/siw

# 전체 테스트
npm test

# 특정 파일만
npx vitest run tests/api/resume-feedback-route.test.ts
npx vitest run tests/api/resumes-route.test.ts

# e2e (mock)
npx playwright test tests/e2e/resume-feedback.spec.ts

# e2e (실제 PDF — 로컬 전용, CI 자동 skip)
npx playwright test tests/e2e/resume-feedback-real.spec.ts
```

### 기존 테스트의 공통 패턴

1. **import 순서**: `vitest` → global fetch stub → `next/headers` mock → `supabase/server` mock → repository mock → 기타 mock → helpers → beforeEach
2. **fetch mock**: `vi.stubGlobal("fetch", mockFetch)` — 모듈 최상단, `vi.fn()` 개별 변수로 선언
3. **auth mock 구조**:
   ```ts
   const mockGetUser = vi.fn();
   vi.mock("@/lib/supabase/server", () => ({
     createServerClient: vi.fn().mockReturnValue({
       auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
     }),
   }));
   ```
4. **repository mock 구조**:
   ```ts
   const mockCreate = vi.fn();
   vi.mock("@/lib/resume-repository", () => ({
     resumeRepository: {
       create: (...args: unknown[]) => mockCreate(...args),
     },
   }));
   ```
5. **handler import**: `beforeEach` 안에서 `vi.resetModules()` 후 `await import(...)` — 또는 `describe` 안에서 직접 dynamic import
6. **params**: Next.js 15 스타일 — `{ params: Promise.resolve({ id: "..." }) }`
7. **beforeEach**: `vi.clearAllMocks()` 또는 `vi.resetModules()` + env 세팅

---

## Unit/Integration 테스트

### 신규 파일: tests/api/resume-feedback-route.test.ts

> GET /api/resumes/[id]/feedback 라우트 테스트

| TC | 케이스 | RED 조건 | GREEN 구현 |
|----|--------|----------|------------|
| 1 | 200 — feedbackJson 있는 이력서 반환 | route.ts가 항상 null 반환 | `resume.feedbackJson ?? null` |
| 2 | 200+null — feedbackJson=null 이력서 | Prisma 스키마에 feedbackJson 없으면 빌드 실패 | 스키마 추가 후 migrate |
| 3 | 401 — 미인증 | import 오류 | 라우트 구현 |
| 4 | 404 — findDetailById throw | catch에서 null 반환 | catch → 404 변경 |

### 기존 파일 확장: tests/api/resumes-route.test.ts

> POST /api/resumes에 feedbackJson 저장 로직 추가 테스트

| TC | 케이스 | RED 조건 | GREEN 구현 |
|----|--------|----------|------------|
| 5 | /feedback URL 호출 검증 | feedback fetch 없음 | Promise.all에 feedback 추가 |
| 6 | create()에 feedbackJson 포함 | create()에 feedbackJson 없음 | create() 파라미터 확장 |
| 7 | feedback reject → null, 200 | Promise.all 전체 reject → 500 | `.catch(() => null)` 추가 |
| 8 | targetRole 전달 검증 | body에 targetRole 없음 | FormData에서 읽어 전달 |

---

## E2E 테스트 (Playwright)

### 설정

**playwright.config.ts:**
```ts
import fs from "fs";
import path from "path";

// .env 파일 수동 로딩 (dotenv 패키지 없이)
const envFile = path.resolve(__dirname, ".env");
if (fs.existsSync(envFile)) {
  // key=value 파싱하여 process.env에 주입
}

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 180_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: !!process.env.CI,
    video: process.env.CI ? "retain-on-failure" : "on",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { storageState: "tests/e2e/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
```

**auth.setup.ts:**
- `PLAYWRIGHT_EMAIL`, `PLAYWRIGHT_PASSWORD` 환경변수에서 읽기
- `/login` 페이지에서 로그인 후 `storageState` 저장
- 저장 경로: `tests/e2e/.auth/user.json` (.gitignore 처리)

### tests/e2e/resume-feedback.spec.ts (Mock 기반)

> `page.route()`로 API 응답 모킹 — 엔진 없이도 실행 가능

| TC | 케이스 | 검증 내용 |
|----|--------|----------|
| 1 | 피드백 데이터 있음 | 점수·강점·약점·개선 제안 렌더링 확인 |
| 2 | 피드백 없음 (null) | 페이지 크래시 없이 정상 표시 |
| 3 | 피드백 API 오류 (500) | 페이지 크래시 없이 정상 표시 |
| 4 | 피드백 로딩 중 | 1.5초 지연 후 데이터 렌더링 확인 |

**실행 결과:** 5/5 통과 (auth setup 포함)
**영상 저장:** `test-results/resume-feedback-*/video.webm`

### tests/e2e/resume-feedback-real.spec.ts (실제 PDF 통합)

> 실제 서버(포트 3000) + 실제 엔진(포트 8000) + 실제 DB 연동

**테스트 플로우:**
1. `/resumes` 페이지 이동
2. "새 이력서 추가" 클릭 → UploadForm 표시
3. `input[type="file"]`에 PDF 설정
4. "이력서 분석" 버튼 클릭
5. `POST /api/resumes` 응답에서 `resumeId` 추출
6. `/resumes/{resumeId}` 이동
7. 파일명 확인 → 피드백 렌더링 확인

**CI 처리:**
```ts
const PDF_PATH = process.env.PLAYWRIGHT_PDF_PATH ?? "D:\\...\\자소서_004_개발자.pdf";
test.skip(!fs.existsSync(PDF_PATH), `PDF 파일 없음 (CI skip): ${PDF_PATH}`);
```
- 파일 존재 시: 전체 플로우 실행
- 파일 없음(CI): 자동 skip

**실행 결과:** 통과 (29.9초, `자소서_004_개발자.pdf`)
- `✅ 피드백 데이터 렌더링 완료` 로그 출력

---

## TDD 사이클 가이드

### Iron Law
**프로덕션 코드는 반드시 실패하는 테스트가 먼저 존재해야 작성할 수 있다.**

### 권장 실행 순서

```
TC-3 (401) → TC-4 (404) → TC-1 (200 with data) → TC-2 (200 null)
TC-5 (fetch called) → TC-7 (fetch reject) → TC-6 (feedbackJson in create) → TC-8 (targetRole)
```

인증·에러 경계 테스트를 먼저 통과시킨 후 핵심 기능으로 진행하는 것이 안전하다.
