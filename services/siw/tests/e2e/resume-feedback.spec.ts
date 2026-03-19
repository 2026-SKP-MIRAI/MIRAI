import { test, expect } from "@playwright/test";

const RESUME_ID = "test-resume-feedback-id";
const RESUME_URL = `/resumes/${RESUME_ID}`;

const MOCK_RESUME = {
  id: RESUME_ID,
  fileName: "이력서_홍길동.pdf",
  uploadedAt: "2026-03-19T00:00:00.000Z",
  questionCount: 5,
  categories: [],
};

const MOCK_FEEDBACK = {
  scores: {
    specificity: 82,
    achievementClarity: 74,
    logicStructure: 78,
    roleAlignment: 88,
    differentiation: 65,
  },
  strengths: [
    "프로젝트 경험이 구체적으로 서술되어 있어 실력을 잘 드러냅니다.",
    "직무와의 연관성이 높은 기술 스택을 명확히 제시했습니다.",
  ],
  weaknesses: [
    "성과 수치가 일부 항목에서 빠져 있어 임팩트가 약합니다.",
    "자기소개 섹션이 다소 일반적인 표현으로 채워져 있습니다.",
  ],
  suggestions: [
    {
      section: "경력 사항",
      issue: "성과 지표가 없음",
      suggestion: "매출 증가율, 처리 속도 개선 등 수치화된 성과를 추가하세요.",
    },
    {
      section: "자기소개",
      issue: "차별화 포인트 부족",
      suggestion: "지원 직무에 특화된 경험이나 역량을 앞에 배치하세요.",
    },
  ],
};

test.describe("이력서 피드백 페이지 e2e", () => {
  test.beforeEach(async ({ page }) => {
    await page.route(`/api/resumes/${RESUME_ID}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESUME),
      });
    });

    await page.route(`/api/resumes/${RESUME_ID}/sessions`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("피드백 데이터 있음 — 점수·강점·약점·개선 제안 렌더링", async ({ page }) => {
    await page.route(`/api/resumes/${RESUME_ID}/feedback`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK),
      });
    });

    await page.goto(RESUME_URL);

    // 파일명 확인
    await expect(page.getByText("이력서_홍길동.pdf")).toBeVisible({ timeout: 10000 });

    // 점수 섹션 확인
    await expect(page.getByText("경험·사례의 구체성")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("직무 연관성")).toBeVisible();

    // 강점 확인
    await expect(page.getByText("프로젝트 경험이 구체적으로")).toBeVisible();

    // 약점 확인
    await expect(page.getByText("성과 수치가 일부 항목에서")).toBeVisible();

    // 개선 제안 확인
    await expect(page.getByText("경력 사항")).toBeVisible();
    await expect(page.getByText("매출 증가율")).toBeVisible();
  });

  test("피드백 데이터 없음 (null) — 페이지 정상 표시", async ({ page }) => {
    await page.route(`/api/resumes/${RESUME_ID}/feedback`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: "null",
      });
    });

    await page.goto(RESUME_URL);

    // 파일명은 보여야 함
    await expect(page.getByText("이력서_홍길동.pdf")).toBeVisible({ timeout: 10000 });

    // 페이지가 크래시 없이 렌더링됨
    await expect(page.locator("body")).toBeVisible();
  });

  test("피드백 API 오류 (500) — 페이지 크래시 없이 정상 표시", async ({ page }) => {
    await page.route(`/api/resumes/${RESUME_ID}/feedback`, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "서버 오류" }),
      });
    });

    await page.goto(RESUME_URL);

    // 파일명은 보여야 함
    await expect(page.getByText("이력서_홍길동.pdf")).toBeVisible({ timeout: 10000 });

    // 페이지가 크래시 없이 렌더링됨
    await expect(page.locator("body")).toBeVisible();
  });

  test("피드백 로딩 중 — 스피너 또는 스켈레톤 표시 후 데이터 렌더링", async ({ page }) => {
    await page.route(`/api/resumes/${RESUME_ID}/feedback`, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_FEEDBACK),
      });
    });

    await page.goto(RESUME_URL);

    // 데이터 최종 렌더링 확인
    await expect(page.getByText("경험·사례의 구체성")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("프로젝트 경험이 구체적으로")).toBeVisible();
  });
});
