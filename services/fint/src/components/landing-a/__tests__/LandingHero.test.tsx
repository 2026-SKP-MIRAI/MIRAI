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

describe("LandingHero (landing-a)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingHero />);
    expect(container.firstChild).toBeDefined();
  });

  it("헤드라인 텍스트 'AI 면접관과 함께'를 포함한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("AI 면접관과 함께")).toBeDefined();
  });

  it("통계 '10,000+'를 렌더링한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("10,000+")).toBeDefined();
  });

  it("CTA 버튼 '지금 무료로 시작하기'를 렌더링한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("지금 무료로 시작하기")).toBeDefined();
  });

  it("'서비스 둘러보기' 링크가 존재한다", () => {
    render(<LandingHero />);
    expect(screen.getByText("서비스 둘러보기")).toBeDefined();
  });
});
