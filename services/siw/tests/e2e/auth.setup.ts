import { test as setup } from "@playwright/test";
import path from "path";

export const AUTH_FILE = path.resolve("tests/e2e/.auth/user.json");

setup("로그인 상태 저장", async ({ page }) => {
  const email = process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.PLAYWRIGHT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "PLAYWRIGHT_EMAIL, PLAYWRIGHT_PASSWORD 환경변수를 .env.local에 설정해주세요."
    );
  }

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();

  // 로그인 후 dashboard로 이동 확인
  await page.waitForURL(/\/(dashboard|resumes)/, { timeout: 15000 });

  await page.context().storageState({ path: AUTH_FILE });
});
