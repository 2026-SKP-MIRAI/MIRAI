import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

import { LandingHero } from "../LandingHero";

describe("LandingHero (landing-b)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingHero />);
    expect(container.firstChild).toBeDefined();
  });

  it("'취업 면접,' 텍스트를 포함한다", () => {
    render(<LandingHero />);
    expect(screen.getByText(/취업 면접,/)).toBeDefined();
  });

  it("'더 이상 혼자' 텍스트를 포함한다", () => {
    render(<LandingHero />);
    expect(screen.getByText(/더 이상 혼자/)).toBeDefined();
  });

  it("통계 '98%'를 렌더링한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("94%")).toBeDefined();
  });

  it("CTA '무료로 시작하기'를 렌더링한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("무료로 시작하기")).toBeDefined();
  });

  it("AI 면접관 카드 'AI 피드백' 텍스트를 포함한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("AI 피드백")).toBeDefined();
  });
});
