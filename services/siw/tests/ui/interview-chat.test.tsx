import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InterviewChat from "@/components/InterviewChat";

const mockHistory = [{
  persona: "hr" as const,
  personaLabel: "HR 담당자",
  question: "자기소개를 해주세요.",
  answer: "저는 개발자입니다.",
  type: "main" as const,
}];

describe("InterviewChat", () => {
  it("페르소나 레이블과 질문 버블 렌더링", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={mockHistory}
        sessionComplete={false}
      />
    );
    expect(screen.getAllByTestId("chat-message")).toHaveLength(1);
    expect(screen.getByTestId("persona-label")).toHaveTextContent("HR 담당자");
  });

  it("sessionComplete=true 시 완료 메시지", () => {
    render(
      <InterviewChat currentQuestion={null} history={[]} sessionComplete={true} />
    );
    expect(screen.getByTestId("session-complete")).toBeInTheDocument();
  });
});
