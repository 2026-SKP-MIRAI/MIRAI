import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OnboardingSlider } from "../onboarding/OnboardingSlider";

// next/navigation mock
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

// localStorage mock
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("OnboardingSlider", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("첫 번째 슬라이드를 렌더링한다", () => {
    render(<OnboardingSlider />);
    expect(screen.getByText("lww")).toBeDefined();
  });

  it("마지막 슬라이드에 CTA 버튼이 없다 (초기 상태)", () => {
    render(<OnboardingSlider />);
    // 초기 currentSlide=0 이므로 마지막 슬라이드가 아니어서 CTA 버튼 없음
    expect(screen.queryByText("지금 시작하기 🚀")).toBeNull();
  });

  it("도트 인디케이터가 3개 존재한다", () => {
    const { container } = render(<OnboardingSlider />);
    // 슬라이드 수만큼 도트 버튼 (건너뛰기 버튼은 currentSlide > 0 일때만)
    const dots = container.querySelectorAll("button");
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });
});
