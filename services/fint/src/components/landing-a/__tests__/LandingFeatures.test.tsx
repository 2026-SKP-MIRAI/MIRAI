import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

import { LandingFeatures } from "../LandingFeatures";

describe("LandingFeatures (landing-a)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingFeatures />);
    expect(container.firstChild).toBeDefined();
  });

  it("섹션 헤딩 '합격을 만드는 세 가지 기능'을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("합격을 만드는 세 가지 기능")).toBeDefined();
  });

  it("'AI 면접관' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("AI 면접관")).toBeDefined();
  });

  it("'즉각 피드백' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("즉각 피드백")).toBeDefined();
  });

  it("'맞춤 질문' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("맞춤 질문")).toBeDefined();
  });

  it("3개 기능 타이틀을 모두 렌더링한다", () => {
    render(<LandingFeatures />);
    const titles = ["AI 면접관", "즉각 피드백", "맞춤 질문"];
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeDefined();
    });
  });
});
