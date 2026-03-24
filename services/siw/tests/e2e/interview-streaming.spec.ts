import { test, expect } from "@playwright/test";

/**
 * SSE 스트리밍 e2e 테스트
 * - Next.js: localhost:3000  (실제 서버)
 * - Engine:  localhost:8000  (실제 서버)
 *
 * 전략:
 *   1. 실제 엔진 호출 → text/event-stream 확인
 *   2. /api/interview/answer 를 mock으로 인터셉트 → token 이벤트 주입
 *      → MutationObserver로 streaming-text 버블의 순간 출현 감지
 */

async function startInterviewSession(page: import("@playwright/test").Page) {
  await page.goto("/interview/new");
  await page.waitForLoadState("networkidle", { timeout: 10_000 });

  const resumeList = page.locator('.space-y-2 button').first();
  await expect(resumeList).toBeVisible({ timeout: 8_000 });
  await resumeList.click();

  await page.getByTestId("mode-real").click();
  await page.getByTestId("start-interview").click();
  await expect(page).toHaveURL(/\/interview\/.+/, { timeout: 30_000 });
  await expect(page.getByTestId("chat-message").first()).toBeVisible({ timeout: 30_000 });
}

// ──────────────────────────────────────────────────────────────────────────────
// 테스트 1: 실제 엔진 — text/event-stream 응답 확인
// ──────────────────────────────────────────────────────────────────────────────
test("실제 엔진 응답이 text/event-stream인지 확인", async ({ page }) => {
  await startInterviewSession(page);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/interview/answer"),
    { timeout: 90_000 }
  );

  await page.getByTestId("answer-input").fill("테스트 답변입니다.");
  await page.getByTestId("submit-answer").click();

  const response = await responsePromise;
  const contentType = response.headers()["content-type"] ?? "";
  console.log("[e2e] Content-Type:", contentType);
  expect(contentType).toContain("text/event-stream");

  await expect(
    page.getByTestId("chat-message").last().or(page.getByTestId("session-complete"))
  ).toBeVisible({ timeout: 60_000 });
}, { timeout: 180_000 });

// ──────────────────────────────────────────────────────────────────────────────
// 테스트 2: mock SSE + MutationObserver → streaming-text 순간 출현 감지
// ──────────────────────────────────────────────────────────────────────────────
test("mock SSE — token 이벤트가 DOM에 렌더링된다 (MutationObserver 감지)", async ({ page }) => {
  await startInterviewSession(page);

  // mock SSE 응답 (token 10개 + done 1개)
  await page.route("**/api/interview/answer", async (route) => {
    const tokens = ["다음으로 ", "본인의 ", "가장 ", "큰 ", "강점을 ", "말씀해", "주세요.", " 구체적인 ", "사례와 ", "함께."];
    const done = {
      type: "done",
      nextQuestion: { persona: "tech_lead", personaLabel: "기술 리드", question: "다음으로 본인의 가장 큰 강점을 말씀해주세요.", type: "main" },
      updatedQueue: [],
      sessionComplete: false,
    };

    let body = "";
    for (const t of tokens) body += `data: ${JSON.stringify({ type: "token", text: t })}\n\n`;
    body += `data: ${JSON.stringify(done)}\n\n`;

    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      body,
    });
  });

  // MutationObserver 주입 — streaming-text 가 DOM에 추가되는 순간을 감지
  await page.evaluate(() => {
    (window as any).__streamingTextSeen = false;
    (window as any).__streamingTextContent = "";
    const obs = new MutationObserver(() => {
      const el = document.querySelector('[data-testid="streaming-text"]');
      if (el) {
        (window as any).__streamingTextSeen = true;
        (window as any).__streamingTextContent = el.textContent ?? "";
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    (window as any).__streamingObserver = obs;
  });

  // 답변 제출
  await page.getByTestId("answer-input").fill("제 강점은 빠른 학습 능력입니다.");
  await page.getByTestId("submit-answer").click();

  // 최종 상태 대기 (다음 질문 또는 세션 완료)
  await expect(
    page.getByTestId("chat-message").last().or(page.getByTestId("session-complete"))
  ).toBeVisible({ timeout: 30_000 });

  // observer 해제
  await page.evaluate(() => (window as any).__streamingObserver?.disconnect());

  // 플래그 확인
  const sawStreaming: boolean = await page.evaluate(() => (window as any).__streamingTextSeen);
  const streamingContent: string = await page.evaluate(() => (window as any).__streamingTextContent);

  console.log("[e2e] sawStreaming:", sawStreaming);
  console.log("[e2e] streamingContent:", streamingContent);

  expect(
    sawStreaming,
    `streaming-text 버블이 DOM에 한 번도 나타나지 않음.
     flushSync 동작을 확인하세요: page.tsx의 for await 루프 내 flushSync(() => setStreamingText(...))`
  ).toBe(true);
}, { timeout: 180_000 });
