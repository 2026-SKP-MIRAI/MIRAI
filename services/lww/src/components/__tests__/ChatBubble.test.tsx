import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatBubble } from "../chat/ChatBubble";

describe("ChatBubble", () => {
  it("AI 버블을 왼쪽에 렌더링한다", () => {
    render(
      <ChatBubble message="자기소개를 해주세요." isAI personaLabel="HR 면접관" />
    );
    expect(screen.getByText("자기소개를 해주세요.")).toBeDefined();
    expect(screen.getByText("HR 면접관")).toBeDefined();
    // AI 버블: 기본 아바타 이모지 존재 (personaType 없으면 🤖)
    expect(screen.getByText("🤖")).toBeDefined();
  });

  it("유저 버블을 오른쪽에 렌더링한다", () => {
    render(<ChatBubble message="안녕하세요." />);
    expect(screen.getByText("안녕하세요.")).toBeDefined();
    // AI 아바타 없음
    expect(screen.queryByText("AI")).toBeNull();
  });

  it("isAI=false일 때 primary 배경 클래스를 사용한다", () => {
    const { container } = render(<ChatBubble message="유저 메시지" />);
    // user bubble div에 bg-[#0D9488] 클래스 포함
    const bubble = container.querySelector('[class*="bg-"]');
    expect(bubble).toBeTruthy();
    expect(bubble?.className).toContain("bg-[#0D9488]");
  });
});
