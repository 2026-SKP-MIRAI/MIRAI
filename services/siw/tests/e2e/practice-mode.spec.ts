import { test, expect } from "@playwright/test";

test.describe("연습 모드 e2e", () => {
  test(
    "기존 이력서 선택 → 연습 모드 → 답변 → AI 피드백 → 다시 답변하기 → 재피드백 → 다음 질문",
    async ({ page }) => {
      // 1. 이력서 목록 페이지 접속
      await page.goto("/resumes");

      // 2. 이미 업로드된 이력서의 "이 이력서로 면접" 클릭
      await expect(page.getByRole("link", { name: /이 이력서로 면접/ }).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole("link", { name: /이 이력서로 면접/ }).first().click();

      // 3. /interview/new 페이지 진입 확인
      await expect(page).toHaveURL(/\/interview\/new/, { timeout: 10_000 });

      // 4. 연습 모드 선택
      await expect(page.getByTestId("mode-practice")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("mode-practice").click();

      // 5. 면접 시작 (LLM 호출로 첫 질문 생성, 최대 60초)
      await page.getByTestId("start-interview").click();

      // 8. 면접 세션 페이지 진입 확인
      await expect(page).toHaveURL(/\/interview\/.+/, { timeout: 30_000 });

      // 9. 첫 질문 표시 대기
      await expect(page.getByTestId("chat-message").first()).toBeVisible({
        timeout: 30_000,
      });

      // 10. 첫 답변 입력
      const answerInput = page.getByTestId("answer-input");
      await expect(answerInput).toBeVisible({ timeout: 10_000 });
      await answerInput.fill(
        "저는 팀 프로젝트에서 데이터 분석을 담당했습니다. " +
        "Python을 활용하여 데이터를 정제하고 시각화하였으며, " +
        "이를 통해 팀의 의사결정을 지원했습니다."
      );
      await page.getByTestId("submit-answer").click();

      // 11. AI 피드백 카드 표시 대기 (LLM 호출)
      await expect(page.getByTestId("feedback-score")).toBeVisible({
        timeout: 60_000,
      });

      // 12. 내 답변 버블 표시 확인
      await expect(page.locator("text=내 답변")).toBeVisible();

      // 13. 피드백 good/improve 표시 확인
      await expect(page.getByTestId("feedback-good")).toBeVisible();
      await expect(page.getByTestId("feedback-improve")).toBeVisible();

      // 14. 다시 답변하기 클릭
      await page.getByTestId("btn-retry").click();

      // 15. 피드백이 유지된 채 입력창 다시 표시 확인
      await expect(page.getByTestId("feedback-score")).toBeVisible();
      await expect(page.getByTestId("answer-input")).toBeVisible();

      // 16. 개선된 답변 입력
      await page.getByTestId("answer-input").fill(
        "저는 팀 프로젝트에서 데이터 분석 리더를 맡았습니다. " +
        "Python pandas와 matplotlib을 활용하여 매출 데이터 5만 건을 분석하고, " +
        "주간 리포트를 자동화하여 팀 업무 효율을 30% 향상시켰습니다. " +
        "그 결과 팀장으로부터 우수 기여자로 선정됐습니다."
      );
      await page.getByTestId("submit-answer").click();

      // 17. 재답변 피드백 + comparisonDelta 표시 대기
      await expect(page.getByTestId("feedback-score")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("feedback-delta")).toBeVisible({
        timeout: 60_000,
      });

      // 18. 다음 질문으로 이동
      await page.getByTestId("btn-next-question").click();

      // 19. 피드백 카드가 사라지고 다음 질문 표시 확인
      await expect(page.getByTestId("feedback-score")).not.toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("answer-input")).toBeVisible({
        timeout: 15_000,
      });
    },
    { timeout: 300_000 }
  );
});
