import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";

// IntersectionObserver mock (client component에서 사용)
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// 하위 컴포넌트 mock (client component with useEffect)
vi.mock("@/components/landing-a/LandingHero", () => ({
  LandingHero: () => <section data-testid="landing-a-hero">히어로 섹션</section>,
}));
vi.mock("@/components/landing-a/LandingPainPoints", () => ({
  LandingPainPoints: () => <section data-testid="landing-a-painpoints">페인포인트</section>,
}));
vi.mock("@/components/landing-a/LandingFeatures", () => ({
  LandingFeatures: () => <section data-testid="landing-a-features">기능 소개</section>,
}));
vi.mock("@/components/landing/LandingCTA", () => ({
  LandingCTA: ({ text }: { text?: string }) => (
    <a href="/resume" data-testid="landing-cta">{text ?? "지금 면접 시작하기"}</a>
  ),
}));

import LandingAPage from "../page";

describe("LandingAPage (/landing-a)", () => {
  it("오류 없이 렌더링된다 (smoke test)", () => {
    const { container } = render(<LandingAPage />);
    expect(container.firstChild).toBeDefined();
  });

  it("루트 div에 w-full 클래스가 있다", () => {
    const { container } = render(<LandingAPage />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain("w-full");
  });

  it("히어로, 페인포인트, 기능소개 섹션이 렌더링된다", () => {
    render(<LandingAPage />);
    expect(screen.getByTestId("landing-a-hero")).toBeDefined();
    expect(screen.getByTestId("landing-a-painpoints")).toBeDefined();
    expect(screen.getByTestId("landing-a-features")).toBeDefined();
  });

  it("CTA 버튼이 /resume 링크를 가리킨다", () => {
    render(<LandingAPage />);
    const cta = screen.getByTestId("landing-cta");
    expect(cta.getAttribute("href")).toBe("/resume");
  });
});
