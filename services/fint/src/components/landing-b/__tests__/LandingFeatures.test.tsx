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

describe("LandingFeatures (landing-b)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingFeatures />);
    expect(container.firstChild).toBeDefined();
  });

  it("섹션 헤딩 '합격을 만드는 세 가지 무기'를 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("합격을 만드는 세 가지 무기")).toBeDefined();
  });

  it("'AI 면접 시뮬레이션' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("AI 면접 시뮬레이션")).toBeDefined();
  });

  it("'맞춤형 피드백' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("맞춤형 피드백")).toBeDefined();
  });

  it("'합격 전략 코칭' 기능 타이틀을 렌더링한다", () => {
    render(<LandingFeatures />);
    expect(screen.getByText("합격 전략 코칭")).toBeDefined();
  });

  it("3개 기능 타이틀을 모두 렌더링한다", () => {
    render(<LandingFeatures />);
    const titles = ["AI 면접 시뮬레이션", "맞춤형 피드백", "합격 전략 코칭"];
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeDefined();
    });
  });
});
