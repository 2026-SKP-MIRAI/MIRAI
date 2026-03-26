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

  it("streamingText prop 있을 때 streaming-text 버블 렌더링", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        streamingText="스트리밍 중..."
      />
    );
    expect(screen.getByTestId("streaming-text")).toBeInTheDocument();
    expect(screen.getByTestId("streaming-text")).toHaveTextContent("스트리밍 중...");
  });

  it("streamingText 없을 때 streaming-text 버블 미표시", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        streamingText=""
      />
    );
    expect(screen.queryByTestId("streaming-text")).not.toBeInTheDocument();
  });
});

const mockPracticeFeedback = {
  score: 85,
  feedback: { good: ["명확한 설명"], improve: ["구체적 사례 추가"] },
  keywords: ["리더십", "협업"],
  improvedAnswerGuide: "더 구체적인 사례를 들어보세요.",
  comparisonDelta: null,
};

describe("연습 모드 피드백", () => {
  it("practice 모드에서 피드백 카드 미표시 (practiceFeedback 전달해도 렌더링 안 됨)", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        interviewMode="practice"
        practiceFeedback={mockPracticeFeedback}
      />
    );
    expect(screen.queryByTestId("feedback-score")).not.toBeInTheDocument();
  });

  it("real 모드에서 피드백 카드 표시", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        interviewMode="real"
        practiceFeedback={mockPracticeFeedback}
      />
    );
    expect(screen.getByTestId("feedback-score")).toHaveTextContent("85점");
    expect(screen.getByTestId("feedback-good")).toBeInTheDocument();
    expect(screen.getByTestId("feedback-improve")).toBeInTheDocument();
  });

  it("real 모드 + comparisonDelta 있을 때 feedback-delta 표시", () => {
    const feedbackWithDelta = {
      ...mockPracticeFeedback,
      comparisonDelta: { scoreDelta: 10, improvements: ["더 좋아짐"] },
    };
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        interviewMode="real"
        practiceFeedback={feedbackWithDelta}
      />
    );
    expect(screen.getByTestId("feedback-delta")).toBeInTheDocument();
  });

  it("real 모드에서 isRetried=false: 다시 답변하기 + 다음 질문 버튼 모두 표시", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        interviewMode="real"
        practiceFeedback={mockPracticeFeedback}
        isRetried={false}
      />
    );
    expect(screen.getByTestId("btn-retry")).toBeInTheDocument();
    expect(screen.getByTestId("btn-next-question")).toBeInTheDocument();
  });

  it("real 모드에서 isRetried=true: 다시 답변하기 숨김", () => {
    render(
      <InterviewChat
        currentQuestion={null}
        history={[]}
        sessionComplete={false}
        interviewMode="real"
        practiceFeedback={mockPracticeFeedback}
        isRetried={true}
      />
    );
    expect(screen.queryByTestId("btn-retry")).not.toBeInTheDocument();
    expect(screen.getByTestId("btn-next-question")).toBeInTheDocument();
  });
});
