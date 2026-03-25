import { test, expect } from "@playwright/test";

const FAKE_SESSION_ID = "e2e-anon-save-cta-test-0000-000000000001";
const FAKE_REPORT_ID = "e2e-anon-report-0000-000000000001";

test.describe("비로그인 면접 완료 → 로그인/가입 유도 CTA", () => {
  test.beforeEach(async ({ page }) => {
    // ── API mock ──────────────────────────────────────────────
    // /api/interview/start
    await page.route("**/api/interview/start", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessionId: FAKE_SESSION_ID,
          firstQuestion: { question: "자기소개를 해주세요.", persona: "hr" },
          questionsQueue: [],
        }),
      });
    });

    // /api/interview/answer — 4번째 답변에서 sessionComplete: true
    let answerCount = 0;
    await page.route("**/api/interview/answer", async (route) => {
      answerCount++;
      const isLast = answerCount >= 4;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          nextQuestion: isLast ? null : { question: `질문 ${answerCount + 1}`, persona: "hr" },
          updatedQueue: [],
          sessionComplete: isLast,
        }),
      });
    });

    // /api/interview/end — report 객체를 반환해야 자동 리다이렉트 동작
    await page.route("**/api/interview/end", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          report: {
            totalScore: 72,
            axisFeedbacks: [],
            summary: "E2E 테스트 리포트입니다.",
          },
        }),
      });
    });

    // report API (리포트 페이지에서 호출하는 경우 대비)
    await page.route("**/api/report/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalScore: 72,
          axisFeedbacks: [],
          summary: "E2E 테스트 리포트입니다.",
        }),
      });
    });
  });

  test("면접 완료 후 리포트 페이지에서 로그인 CTA 표시", async ({ page }) => {
    // 1. 온보딩 스킵
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_done", "true");
    });

    // 2. 직군 선택 → 면접 시작
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await page.locator("button").filter({ hasText: "IT/개발" }).click();
    await page.locator("button").filter({ hasText: "면접 준비 중" }).click();

    const startBtn = page.locator("button").filter({ hasText: "면접 시작" });
    await expect(startBtn).toBeEnabled({ timeout: 5000 });
    await startBtn.click();

    // 3. 면접 화면 진입
    await page.waitForURL(`**/interview/${FAKE_SESSION_ID}`, { timeout: 15000 });
    await expect(page.locator("text=자기소개를 해주세요.")).toBeVisible({ timeout: 10000 });

    // 4. 답변 4번 제출 → 4번째에서 sessionComplete: true → 자동 리다이렉트
    const textarea = page.locator("textarea");
    for (let i = 0; i < 4; i++) {
      await expect(textarea).toBeEnabled({ timeout: 10000 });
      await textarea.click();
      await textarea.fill(`테스트 답변 ${i + 1}입니다. 충분한 내용을 작성합니다.`);
      await textarea.press("Enter");
      if (i < 3) {
        // 다음 질문 렌더링 대기 (마지막 답변 전까지)
        await page.waitForTimeout(500);
      }
    }

    // 5. endInterview() 자동 리다이렉트 대기
    await page.waitForURL(`**/report/${FAKE_SESSION_ID}`, { timeout: 15000 });

    // 6. 비로그인 상태 → 로그인/가입 CTA 표시 확인
    await expect(
      page.locator("text=결과를 영구 저장하려면 로그인하세요")
    ).toBeVisible({ timeout: 10000 });

    // 7. CTA 링크가 /login 으로 향하는지 확인
    const loginLink = page.locator("a[href*='/login']");
    await expect(loginLink.first()).toBeVisible();
  });

  test("리포트 페이지 직접 접근 시 비로그인 CTA 표시", async ({ page }) => {
    // sessionStorage에 리포트 데이터 주입 (Client Component가 읽는 키)
    await page.addInitScript((sessionId) => {
      window.sessionStorage.setItem(`report_${sessionId}`, JSON.stringify({
        totalScore: 75,
        axisFeedbacks: [],
        summary: "테스트 리포트입니다.",
      }));
    }, FAKE_SESSION_ID);

    await page.goto(`/report/${FAKE_SESSION_ID}`);
    await page.waitForLoadState("networkidle");

    // 비로그인 상태 → SaveAccountCTA 렌더링 확인
    await expect(
      page.locator("text=결과를 영구 저장하려면 로그인하세요")
    ).toBeVisible({ timeout: 5000 });

    // 로그인 링크가 올바른 next 파라미터 포함하는지 확인
    const loginLink = page.locator(`a[href*='/login?next=/report/${FAKE_SESSION_ID}']`);
    await expect(loginLink).toBeVisible();
  });
});
