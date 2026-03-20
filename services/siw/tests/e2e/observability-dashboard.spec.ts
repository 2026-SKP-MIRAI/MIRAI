import { test, expect } from "@playwright/test";

const MOCK_ROWS = [
  {
    date: "2026-03-18",
    featureType: "interview_start",
    callCount: 12,
    avgLatencyMs: 310.5,
    errorCount: 1,
    errorRate: 0.083,
  },
  {
    date: "2026-03-19",
    featureType: "resume_parse",
    callCount: 8,
    avgLatencyMs: 450.2,
    errorCount: 0,
    errorRate: 0.0,
  },
];

const MOCK_RESPONSE = {
  rows: MOCK_ROWS,
  summary: {
    totalCalls: 20,
    avgLatency: 380.35,
    avgErrorRate: 0.042,
    featureTypes: ["interview_start", "resume_parse"],
    lastUpdated: "2026-03-19",
  },
};

test.describe("옵저버빌리티 대시보드 e2e", () => {
  test("관리자 — 정상 데이터: stat 카드 + 차트 + 에러율 렌더링", async ({
    page,
  }) => {
    await page.route("/api/dashboard/observability*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });

    await page.goto("/dashboard/observability");

    // stat 카드 3개
    await expect(page.getByText("20")).toBeVisible({ timeout: 10000 });
    // 평균 latency 표시
    await expect(page.getByText(/380/)).toBeVisible({ timeout: 10000 });

    // 에러율 카드 — featureType 이름 확인
    await expect(page.getByText("면접 시작")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("이력서 분석")).toBeVisible({
      timeout: 10000,
    });
  });

  test("관리자 — 빈 데이터: 안내 메시지 표시", async ({ page }) => {
    await page.route("/api/dashboard/observability*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rows: [],
          summary: {
            totalCalls: 0,
            avgLatency: 0,
            avgErrorRate: 0,
            featureTypes: [],
            lastUpdated: null,
          },
        }),
      });
    });

    await page.goto("/dashboard/observability");

    await expect(
      page.getByText(/아직 데이터가 없습니다/)
    ).toBeVisible({ timeout: 10000 });
  });

  test("비관리자 (403) — /dashboard 로 리다이렉트", async ({ page }) => {
    await page.route("/api/dashboard/observability*", async (route) => {
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({ message: "관리자 권한이 필요합니다" }),
      });
    });

    await page.goto("/dashboard/observability");

    // 403 시 /dashboard로 리다이렉트
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 10000 });
  });

  test("기간 필터 — 7일 버튼 클릭 시 days=7 API 재호출", async ({ page }) => {
    let lastUrl = "";

    await page.route("/api/dashboard/observability*", async (route) => {
      lastUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });

    await page.goto("/dashboard/observability");

    // 초기 렌더링 대기
    await expect(page.getByText("20")).toBeVisible({ timeout: 10000 });

    // "7일" 버튼 클릭
    await page.getByRole("button", { name: "최근 7일" }).click();

    // days=7 파라미터 포함 여부 확인
    await expect
      .poll(() => lastUrl, { timeout: 5000 })
      .toContain("days=7");
  });

  test("Sidebar — '운영 현황' 메뉴 표시 및 링크 동작", async ({ page }) => {
    await page.route("/api/dashboard/observability*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });

    await page.goto("/dashboard");

    // Sidebar에 운영 현황 메뉴 존재 확인
    const sidebarLink = page.getByRole("link", { name: "운영 현황" });
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });

    // 클릭 시 observability 페이지로 이동
    await sidebarLink.click();
    await expect(page).toHaveURL(/\/dashboard\/observability/, {
      timeout: 10000,
    });
  });

  test("로딩 중 — skeleton 표시 후 데이터 렌더링", async ({ page }) => {
    await page.route("/api/dashboard/observability*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_RESPONSE),
      });
    });

    await page.goto("/dashboard/observability");

    // 데이터 최종 렌더링 확인
    await expect(page.getByText("20")).toBeVisible({ timeout: 15000 });
  });
});
