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

describe("LandingPainPoints (landing-b)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingPainPoints />);
    expect(container.firstChild).toBeDefined();
  });

  it("섹션 헤딩 '면접 준비, 이런 어려움 있으셨나요?'를 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("면접 준비, 이런 어려움 있으셨나요?")).toBeDefined();
  });

  it("'막막한 시작' 카드 라벨을 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("막막한 시작")).toBeDefined();
  });

  it("'반복해도 성장이 없음' 카드 라벨을 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("반복해도 성장이 없음")).toBeDefined();
  });

  it("'합격자와의 격차' 카드 라벨을 렌더링한다", () => {
    render(<LandingPainPoints />);
    expect(screen.getByText("합격자와의 격차")).toBeDefined();
  });

  it("3개 카드 라벨을 모두 렌더링한다", () => {
    render(<LandingPainPoints />);
    const labels = ["막막한 시작", "반복해도 성장이 없음", "합격자와의 격차"];
    labels.forEach((label) => {
      expect(screen.getByText(label)).toBeDefined();
    });
  });
});
