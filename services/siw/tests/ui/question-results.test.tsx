import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import QuestionList from "../../src/components/QuestionList";
import { QuestionsResponse } from "../../src/lib/types";

const mockData: QuestionsResponse = {
  questions: [
    { category: "직무 역량", question: "직무 질문1?" },
    { category: "경험의 구체성", question: "경험 질문1?" },
    { category: "성과 근거", question: "성과 질문1?" },
    { category: "기술 역량", question: "기술 질문1?" },
  ],
  meta: { extractedLength: 100, categoriesUsed: ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"] },
};

describe("QuestionList", () => {
  it("카테고리별_그룹핑_렌더링", () => {
    render(<QuestionList data={mockData} onReset={vi.fn()} />);
    expect(screen.getByText("직무 역량")).toBeInTheDocument();
    expect(screen.getByText("경험의 구체성")).toBeInTheDocument();
    expect(screen.getByText("성과 근거")).toBeInTheDocument();
    expect(screen.getByText("기술 역량")).toBeInTheDocument();
  });

  it("다시하기_버튼_클릭_시_onReset_호출", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(<QuestionList data={mockData} onReset={onReset} />);
    await user.click(screen.getByRole("button", { name: /다시/i }));
    expect(onReset).toHaveBeenCalled();
  });
});
