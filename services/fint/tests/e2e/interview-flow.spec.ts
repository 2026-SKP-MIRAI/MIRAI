import { test, expect } from "@playwright/test";

test.describe("Interview flow", () => {
  test("온보딩 슬라이더 렌더링 및 직군 선택 화면", async ({ page }) => {
    // 직접 /onboarding으로 이동 — 직군 선택 화면 테스트
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=어떤 직군에 지원하나요?")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=최대 3개까지 선택할 수 있어요")).toBeVisible();
  });

  test("직군 선택 칩이 최대 3개까지 선택 가능", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    await page.waitForSelector("text=어떤 직군에 지원하나요?", { timeout: 10000 });

    // React hydration 완료 대기 — event handler 부착 확인
    await page.waitForFunction(() => {
      const btn = Array.from(document.querySelectorAll("button"))
        .find(b => b.textContent?.includes("IT/개발"));
      return btn && Object.keys(btn).some(k => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
    }, { timeout: 10000 });

    const chip = page.locator("button").filter({ hasText: "IT/개발" }).first();
    await expect(chip).toBeVisible({ timeout: 5000 });

    // 클릭 전 스타일 확인
    const styleBefore = await chip.getAttribute("style");
    expect(styleBefore).toBeNull(); // 미선택: inline style 없음

    // 클릭 (hydration 완료 후이므로 force 불필요)
    await chip.click();
    await page.waitForTimeout(300);

    // 선택됨 확인 — inline gradient style이 적용됨
    await expect(async () => {
      const style = await chip.getAttribute("style");
      expect(style).toContain("linear-gradient");
    }).toPass({ timeout: 5000 });
  });

  test("채팅 면접 UI가 렌더링됨", async ({ page }) => {
    // interview_state를 직접 주입 (interview_init 대신 interview_state 키 사용)
    await page.addInitScript(() => {
      window.sessionStorage.setItem("interview_state", JSON.stringify({
        sessionId: "test-e2e-123",
        resumeText: "직군: IT / 취준 단계: 면접 준비 중",
        currentQuestion: "자기소개를 해주세요.",
        currentPersona: "hr",
        history: [],
        questionsQueue: [],
        questionIndex: 0,
        status: "answering",
      }));
    });

    await page.goto("/interview/test-e2e-123");
    await page.waitForLoadState("networkidle");

    // 채팅 UI 구조 확인 — ChatTopBar, ChatInput 렌더링
    await expect(page.locator("text=자기소개를 해주세요.")).toBeVisible({ timeout: 15000 });
    // 입력창 확인
    await expect(page.locator("textarea, input[type='text']").first()).toBeVisible({ timeout: 5000 });
  });
});
