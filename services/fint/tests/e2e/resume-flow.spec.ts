import { test, expect } from "@playwright/test";

const MOCK_QUESTIONS = {
  questions: [
    { category: "직무 역량", question: "해당 직무에서 핵심 역량은 무엇인가요?" },
    { category: "직무 역량", question: "직무 관련 경험을 구체적으로 설명해 주세요." },
    { category: "경험의 구체성", question: "프로젝트에서 맡은 역할은 무엇이었나요?" },
    { category: "경험의 구체성", question: "협업 과정에서 어려움을 어떻게 극복했나요?" },
    { category: "성과 근거", question: "이전 직장에서 달성한 성과를 수치로 표현해 주세요." },
    { category: "성과 근거", question: "해당 성과가 팀에 미친 영향은 무엇인가요?" },
    { category: "기술 역량", question: "사용한 기술 스택의 장단점을 설명해 주세요." },
    { category: "기술 역량", question: "새로운 기술을 학습한 경험을 공유해 주세요." },
  ],
  meta: {
    extractedLength: 1200,
    categoriesUsed: ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"],
  },
};

test("성공_플로우_PDF_업로드_질문_렌더링", async ({ page }) => {
  // API mock — 실제 엔진/LLM 없이 UI 동작 검증
  await page.route("/api/resume/questions", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_QUESTIONS) })
  );

  await page.goto("/resume");

  // PDF 파일 업로드 (인메모리 버퍼)
  await page.setInputFiles("input[type=file]", {
    name: "sample_resume.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 1 0 obj<</Type /Catalog>>"),
  });

  await page.getByRole("button", { name: "질문 생성" }).click();

  // 카테고리 텍스트 확인
  await expect(page.getByText("직무 역량")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("경험의 구체성")).toBeVisible();
  await expect(page.getByText("성과 근거")).toBeVisible();
  await expect(page.getByText("기술 역량")).toBeVisible();

  // 질문 8개 이상 렌더링 확인
  const questions = page.locator("[data-testid='question-item']");
  await expect(questions).toHaveCount(8);
});

test("에러_플로우_txt_업로드_한국어_에러", async ({ page }) => {
  // API mock — 엔진이 반환하는 400 에러 재현
  await page.route("/api/resume/questions", (route) =>
    route.fulfill({
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ message: "PDF 파일만 업로드 가능합니다." }),
    })
  );

  await page.goto("/resume");

  // 텍스트 파일 업로드 (accept 필터 우회)
  await page.setInputFiles("input[type=file]", {
    name: "not-a-pdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("이것은 텍스트 파일입니다."),
  });

  await page.getByRole("button", { name: "질문 생성" }).click();

  // 한국어 에러 메시지 표시 확인
  await expect(page.getByText("PDF 파일만 업로드 가능합니다.")).toBeVisible({ timeout: 10000 });
});
