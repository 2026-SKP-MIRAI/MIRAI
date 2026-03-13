import { test, expect } from "@playwright/test";

const SESSION_ID = "test-session-abc123";
const REPORT_URL = `/interview/${SESSION_ID}/report`;

const MOCK_REPORT = {
  scores: {
    communication: 80,
    problemSolving: 75,
    logicalThinking: 70,
    jobExpertise: 85,
    cultureFit: 65,
    leadership: 72,
    creativity: 68,
    sincerity: 90,
  },
  totalScore: 76,
  summary: "전반적으로 우수한 면접 역량을 보여주었습니다.",
  axisFeedbacks: [
    { axis: "communication", axisLabel: "의사소통", score: 80, type: "strength", feedback: "명확한 의사소통" },
    { axis: "problemSolving", axisLabel: "문제해결", score: 75, type: "strength", feedback: "구조적 문제 접근" },
    { axis: "logicalThinking", axisLabel: "논리적 사고", score: 70, type: "improvement", feedback: "논리 보강 필요" },
    { axis: "jobExpertise", axisLabel: "직무 전문성", score: 85, type: "strength", feedback: "전문성 우수" },
    { axis: "cultureFit", axisLabel: "조직 적합성", score: 65, type: "improvement", feedback: "협업 사례 보강" },
    { axis: "leadership", axisLabel: "리더십", score: 72, type: "improvement", feedback: "리더십 경험 추가" },
    { axis: "creativity", axisLabel: "창의성", score: 68, type: "improvement", feedback: "창의적 접근 필요" },
    { axis: "sincerity", axisLabel: "성실성", score: 90, type: "strength", feedback: "성실한 답변" },
  ],
  growthCurve: null,
};

test.describe("리포트 페이지 e2e", () => {
  test("로딩 스피너 — 분석 중 텍스트 표시", async ({ page }) => {
    // API 응답을 지연시켜 로딩 상태를 관찰
    await page.route("/api/report/generate", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_REPORT),
      });
    });

    await page.goto(REPORT_URL);

    await expect(
      page.getByText("역량 리포트를 분석 중입니다")
    ).toBeVisible({ timeout: 5000 });
  });

  test("422 에러 — 질문 부족 안내 + 면접으로 돌아가기 링크", async ({ page }) => {
    await page.route("/api/report/generate", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          message: "질문을 더 진행해 주세요 (최소 5개 필요합니다).",
        }),
      });
    });

    await page.goto(REPORT_URL);

    await expect(
      page.getByText("질문을 더 진행해 주세요")
    ).toBeVisible({ timeout: 10000 });

    const backLink = page.getByRole("link", { name: "면접으로 돌아가기" });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute(
      "href",
      `/interview/${SESSION_ID}`
    );
  });

  test("500 에러 — 실패 메시지 + 다시 시도 버튼", async ({ page }) => {
    await page.route("/api/report/generate", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Internal Server Error" }),
      });
    });

    await page.goto(REPORT_URL);

    await expect(
      page.getByText("리포트 생성에 실패했습니다")
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByRole("button", { name: "다시 시도" })
    ).toBeVisible();
  });

  test("성공 — 총점·요약·축 레이블 표시", async ({ page }) => {
    await page.route("/api/report/generate", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_REPORT),
      });
    });

    await page.goto(REPORT_URL);

    // 로딩 완료 대기
    await expect(page.getByText("역량 리포트를 분석 중입니다")).not.toBeVisible({
      timeout: 15000,
    });

    // 총점 확인
    await expect(page.getByText("76")).toBeVisible({ timeout: 10000 });

    // 요약 텍스트 확인
    await expect(page.getByText("전반적으로")).toBeVisible();

    // 축 레이블 확인
    await expect(page.getByText("의사소통")).toBeVisible();
    await expect(page.getByText("문제해결")).toBeVisible();
  });
});
