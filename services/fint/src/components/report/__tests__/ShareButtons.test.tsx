import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShareButtons } from "../ShareButtons";

beforeEach(() => {
  vi.clearAllMocks();
  // clipboard mock
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

describe("ShareButtons", () => {
  it("renders kakao share button and copy button", () => {
    render(<ShareButtons sessionId="test-id" totalScore={85} />);

    expect(screen.getByText("카카오톡 공유")).toBeInTheDocument();
    expect(screen.getByText("링크 복사")).toBeInTheDocument();
  });

  it("copy button writes to clipboard", async () => {
    render(<ShareButtons sessionId="test-id" totalScore={85} />);

    const copyButton = screen.getByText("링크 복사");
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      window.location.href
    );
  });

  it("kakao button is disabled when SDK not available", () => {
    // window.Kakao가 없으면 disabled
    (window as any).Kakao = undefined;

    render(<ShareButtons sessionId="test-id" totalScore={85} />);

    const kakaoButton = screen.getByText("카카오톡 공유");
    expect(kakaoButton.closest("button")).toBeDisabled();
  });
});
