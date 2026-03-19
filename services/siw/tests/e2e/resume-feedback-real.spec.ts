import { test, expect } from "@playwright/test";
import fs from "fs";

// 로컬 개발 전용: PLAYWRIGHT_PDF_PATH 환경변수 또는 기본값 경로 사용
// CI에서는 파일이 없으면 자동 skip
const PDF_PATH =
  process.env.PLAYWRIGHT_PDF_PATH ??
  "D:\\project\\T아카데미\\python\\mirai\\포폴,이력서자료\\mirai_포폴,이력서,자소서\\자소서_004_개발자.pdf";

test("실제 PDF 업로드 → 이력서 피드백 페이지 렌더링", async ({ page }) => {
  test.skip(!fs.existsSync(PDF_PATH), `PDF 파일 없음 (CI skip): ${PDF_PATH}`);
  // 이력서 목록 페이지 이동
  await page.goto("/resumes");
  await page.waitForLoadState("networkidle");

  // "새 이력서 추가" 또는 빈 상태 업로드 버튼 클릭
  const addBtn = page.locator("button").filter({ hasText: /새 이력서 추가|이력서 업로드/ }).first();
  await addBtn.click();

  // 파일 input에 PDF 설정
  await page.locator('input[type="file"]').setInputFiles(PDF_PATH);

  // 파일 선택 확인
  await expect(page.getByText("파일이 선택됐습니다")).toBeVisible({ timeout: 5000 });

  // POST /api/resumes 응답 캡처
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/resumes") && res.request().method() === "POST",
      { timeout: 60000 }
    ),
    page.getByRole("button", { name: "이력서 분석" }).click(),
  ]);

  const data = await response.json();
  if (response.status() !== 200) {
    console.error("Upload failed:", response.status(), JSON.stringify(data));
  }
  expect(response.status()).toBe(200);
  const resumeId: string = data.resumeId;
  expect(resumeId).toBeTruthy();

  // 피드백 페이지로 직접 이동
  await page.goto(`/resumes/${resumeId}`);
  await page.waitForLoadState("networkidle");

  // 파일명 표시 확인
  await expect(page.getByText("자소서_004_개발자.pdf")).toBeVisible({ timeout: 10000 });

  // 피드백 섹션 확인 (있으면 점수, 없으면 분석 중 메시지)
  const hasFeedback = await page.getByText("경험·사례의 구체성").isVisible().catch(() => false);
  if (hasFeedback) {
    // 피드백 전체 렌더링 확인
    await expect(page.getByText("경험·사례의 구체성")).toBeVisible();
    await expect(page.getByText("직무 연관성")).toBeVisible();
    console.log("✅ 피드백 데이터 렌더링 완료");
  } else {
    // 엔진 미실행 시 페이지가 크래시 없이 렌더링만 확인
    await expect(page.locator("body")).toBeVisible();
    console.log("ℹ️ 피드백 없음 (엔진 미실행 또는 분석 중)");
  }
});
