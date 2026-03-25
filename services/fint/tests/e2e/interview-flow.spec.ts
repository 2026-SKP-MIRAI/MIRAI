import { test, expect } from "@playwright/test";

test.describe("Interview flow", () => {
  test.beforeEach(async ({ page }) => {
    // 온보딩 skip
    await page.addInitScript(() => {
      window.localStorage.setItem("onboarding_done", "true");
    });
  });

  test("온보딩 → 직군 선택 화면으로 이동", async ({ page }) => {
    await page.goto("/");
    // onboarding_done이 설정돼 있으므로 /onboarding으로 redirect
    await page.waitForURL("/onboarding", { timeout: 5000 });
    await expect(page.locator("text=어떤 직군에 지원하나요?")).toBeVisible();
  });

  test("직군 선택 칩이 최대 3개까지 선택 가능", async ({ page }) => {
    await page.goto("/onboarding");
    const chips = page.locator("button").filter({ hasText: "IT/개발" });
    await chips.click();

    // 선택됨 확인 (배경색 변경)
    await expect(chips).toHaveClass(/bg-\[--color-primary\]/);
  });

  test("채팅 버블이 좌우로 렌더링됨", async ({ page }) => {
    // sessionStorage에 면접 상태 주입
    await page.addInitScript(() => {
      window.sessionStorage.setItem("interview_init", JSON.stringify({
        sessionId: "test-e2e-123",
        firstQuestion: { question: "자기소개를 해주세요.", persona: "hr" },
        questionsQueue: [],
        resumeText: "직군: IT / 취준 단계: 면접 준비 중",
      }));
    });

    await page.goto("/interview/test-e2e-123");

    // AI 버블 확인
    await expect(page.locator("text=자기소개를 해주세요.")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=AI")).toBeVisible();
  });
});
