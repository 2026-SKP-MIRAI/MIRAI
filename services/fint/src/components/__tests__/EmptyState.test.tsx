import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmptyState } from "../common/EmptyState";
import { Mic } from "lucide-react";

describe("EmptyState", () => {
  it("icon, title, description을 렌더링한다", () => {
    render(
      <EmptyState
        icon={Mic}
        title="기록이 없어요"
        description="첫 면접을 시작해보세요"
      />
    );
    expect(screen.getByText("기록이 없어요")).toBeDefined();
    expect(screen.getByText("첫 면접을 시작해보세요")).toBeDefined();
  });

  it("ctaLabel이 있을 때 버튼을 렌더링한다", () => {
    const onCta = vi.fn();
    render(
      <EmptyState
        icon={Mic}
        title="제목"
        description="설명"
        ctaLabel="시작하기"
        onCta={onCta}
      />
    );
    const button = screen.getByText("시작하기");
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(onCta).toHaveBeenCalledOnce();
  });

  it("ctaLabel이 없을 때 버튼을 렌더링하지 않는다", () => {
    render(
      <EmptyState icon={Mic} title="제목" description="설명" />
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
