import { test, expect } from "@playwright/test";
import path from "path";

const FIXTURE_PDF = path.join(__dirname, "fixtures", "sample_resume.pdf");

test("실제_LLM_연동_PDF_업로드_질문_생성", async ({ page }) => {
  await page.goto("/resume");

  await page.setInputFiles("input[type=file]", FIXTURE_PDF);

  await page.getByRole("button", { name: "질문 생성" }).click();

  // 실제 LLM 응답 대기 (최대 60초)
  await expect(page.getByTestId("question-item").first()).toBeVisible({
    timeout: 60000,
  });

  const questions = page.getByTestId("question-item");
  const count = await questions.count();
  expect(count).toBeGreaterThanOrEqual(8);

  console.log(`생성된 질문 수: ${count}`);
});
