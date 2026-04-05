import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

import { LandingCTA } from "./LandingCTA";

describe("LandingCTA", () => {
  it("기본 props로 렌더링된다", () => {
    const { container } = render(<LandingCTA />);
    expect(container.firstChild).toBeDefined();
  });

  it("기본 text가 '지금 면접 시작하기'이다", () => {
    render(<LandingCTA />);
    expect(screen.getByText("지금 면접 시작하기")).toBeDefined();
  });

  it("href가 /resume이다", () => {
    render(<LandingCTA />);
    const link = screen.getByText("지금 면접 시작하기").closest("a");
    expect(link?.getAttribute("href")).toBe("/resume");
  });

  it("primary variant className을 포함한다", () => {
    render(<LandingCTA variant="primary" />);
    const link = screen.getByText("지금 면접 시작하기").closest("a");
    expect(link?.className).toContain("bg-[#0D9488]");
  });

  it("outline variant className을 포함한다", () => {
    render(<LandingCTA variant="outline" />);
    const link = screen.getByText("지금 면접 시작하기").closest("a");
    expect(link?.className).toContain("border-2");
  });

  it("커스텀 text prop이 반영된다", () => {
    render(<LandingCTA text="무료로 시작하기" />);
    expect(screen.getByText("무료로 시작하기")).toBeDefined();
  });
});
