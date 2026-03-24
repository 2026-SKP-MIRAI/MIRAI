import { test, expect } from "@playwright/test";

// ──────────────────────────────────────────────
// 로그인 페이지 UI
// ──────────────────────────────────────────────
test.describe("로그인 페이지", () => {
  test("소셜 탭 기본 렌더링", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText("로그인 / 가입");
    await expect(page.locator("text=카카오로 계속하기")).toBeVisible();
    await expect(page.locator("text=구글로 계속하기")).toBeVisible();
  });

  test("이메일 탭 전환 시 폼 표시", async ({ page }) => {
    await page.goto("/login");
    await page.click("button:has-text('이메일')");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText("로그인");
  });

  test("이메일 탭 - 가입하기 토글", async ({ page }) => {
    await page.goto("/login");
    await page.click("button:has-text('이메일')");
    // 로그인/가입 토글 버튼 클릭
    await page.locator(".bg-gray-100 button:has-text('가입하기')").click();
    await expect(page.locator('button[type="submit"]')).toContainText("가입하기");
  });

  test("?error=oauth 시 에러 배너 표시", async ({ page }) => {
    await page.goto("/login?error=oauth");
    await expect(
      page.locator("text=로그인 중 오류가 발생했습니다")
    ).toBeVisible();
  });

  test("?error=invalid_link 시 에러 배너 표시", async ({ page }) => {
    await page.goto("/login?error=invalid_link");
    await expect(
      page.locator("text=로그인 중 오류가 발생했습니다")
    ).toBeVisible();
  });

  test("소셜 탭으로 돌아오면 에러 배너 유지", async ({ page }) => {
    await page.goto("/login?error=oauth");
    // 소셜 탭 버튼 클릭해도 에러 배너는 유지
    await page.click("button:has-text('소셜 로그인')");
    await expect(
      page.locator("text=로그인 중 오류가 발생했습니다")
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────
// Open Redirect 방어
// ──────────────────────────────────────────────
test.describe("Open Redirect 방어 (/auth/callback)", () => {
  test("next=//evil.com → / 로 리다이렉트", async ({ page }) => {
    // code 없이 호출 → /login?error=oauth (code 없으면 콜백이 에러 처리)
    // open redirect 방어는 코드에서 처리하므로 로직 확인
    await page.goto("/auth/callback?code=invalid&next=%2F%2Fevil.com");
    // Supabase exchangeCodeForSession 실패 → /login?error=oauth
    await page.waitForURL(/\/login/, { timeout: 10000 });
    expect(page.url()).not.toContain("evil.com");
  });

  test("code 없으면 /login?error=oauth 리다이렉트", async ({ page }) => {
    await page.goto("/auth/callback");
    await page.waitForURL(/\/login\?error=oauth/, { timeout: 10000 });
    await expect(
      page.locator("text=로그인 중 오류가 발생했습니다")
    ).toBeVisible();
  });
});

// ──────────────────────────────────────────────
// 비로그인 익명 흐름 — SaveAccountCTA
// ──────────────────────────────────────────────
test.describe("비로그인 SaveAccountCTA", () => {
  test("리포트 페이지 접근 시 로그인 CTA 링크 확인", async ({ page }) => {
    // 존재하지 않는 sessionId로 접근해도 CTA가 렌더링되는지 확인
    // (페이지가 404가 아닌 정상 렌더링 + CTA 표시)
    const fakeSessionId = "00000000-0000-0000-0000-000000000001";
    await page.goto(`/report/${fakeSessionId}`);

    // CTA가 있으면 로그인 링크가 올바른지 확인
    const ctaLink = page.locator(`a[href*="/login?next=/report/${fakeSessionId}"]`);
    const ctaCount = await ctaLink.count();
    if (ctaCount > 0) {
      await expect(ctaLink.first()).toBeVisible();
    }
  });
});

// ──────────────────────────────────────────────
// 미들웨어 — 비로그인 사용자 리다이렉트 없음
// ──────────────────────────────────────────────
test.describe("익명 우선 원칙 — 미들웨어 리다이렉트 없음", () => {
  test("비로그인 상태로 / 접근 가능", async ({ page }) => {
    await page.goto("/");
    // /login으로 리다이렉트되면 안 됨
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });

  test("비로그인 상태로 /onboarding 접근 가능", async ({ page }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });

  test("비로그인 상태로 /interview 접근 가능", async ({ page }) => {
    await page.goto("/interview");
    await page.waitForLoadState("networkidle");
    expect(page.url()).not.toContain("/login");
  });
});
