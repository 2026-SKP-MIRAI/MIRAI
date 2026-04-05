import { describe, it, expect, beforeAll, vi } from "vitest";
import { render, screen } from "@testing-library/react";

beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

import { LandingPainPoints } from "../LandingPainPoints";

describe("LandingPainPoints (landing-a)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingPainPoints />);
    expect(container.firstChild).toBeDefined();
  });

  it("섹션 헤딩 '면접 준비, 이렇게 하고 계신가요?'를 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("면접 준비, 이렇게 하고 계신가요?")).toBeDefined();
  });

  it("'혼자 연습의 한계' 카드를 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("혼자 연습의 한계")).toBeDefined();
  });

  it("'피드백 없는 반복' 카드를 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("피드백 없는 반복")).toBeDefined();
  });

  it("'막막한 첫 마디' 카드를 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("막막한 첫 마디")).toBeDefined();
  });

  it("3개의 페인포인트 카드를 렌더링한다", () => {
    render(<LandingPainPoints />);
    const titles = ["혼자 연습의 한계", "피드백 없는 반복", "막막한 첫 마디"];
    titles.forEach((title) => {
      expect(screen.getByText(title)).toBeDefined();
    });
  });
});
