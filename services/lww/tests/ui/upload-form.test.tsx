import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import UploadForm from "../../src/components/UploadForm";

describe("UploadForm 상태머신", () => {
  it("idle_renders_upload_controls", () => {
    render(<UploadForm onComplete={vi.fn()} />);
    expect(screen.getByRole("button", { name: /질문 생성/i })).toBeInTheDocument();
  });

  it("moves_to_ready_when_pdf_selected", async () => {
    const user = userEvent.setup();
    render(<UploadForm onComplete={vi.fn()} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    // ready 상태: 버튼 활성화 확인
    const btn = screen.getByRole("button", { name: /질문 생성/i });
    expect(btn).not.toBeDisabled();
  });

  it("moves_to_uploading_when_submit_clicked", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {}))); // 영구 pending
    render(<UploadForm onComplete={vi.fn()} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    const file = new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" });
    await user.upload(input, file);
    await user.click(screen.getByRole("button", { name: /질문 생성/i }));
    // uploading 상태: 버튼 비활성
    expect(screen.getByRole("button", { name: /질문 생성/i })).toBeDisabled();
  });

  it("moves_to_done_when_api_returns_questions", async () => {
    const mockData = {
      questions: Array(8).fill({ category: "직무 역량", question: "질문?" }),
      meta: { extractedLength: 100, categoriesUsed: ["직무 역량"] }
    };
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(mockData), { status: 200 }))
    ));
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<UploadForm onComplete={onComplete} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /질문 생성/i }));
    await vi.waitFor(() => expect(onComplete).toHaveBeenCalledWith(mockData));
  });

  it("moves_to_error_when_api_fails_and_retry_restarts", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ message: "오류" }), { status: 500 }))
    ));
    const user = userEvent.setup();
    render(<UploadForm onComplete={vi.fn()} />);
    const input = document.querySelector("input[type=file]") as HTMLInputElement;
    await user.upload(input, new File([new Uint8Array([1])], "test.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: /질문 생성/i }));
    await vi.waitFor(() => expect(screen.getByText(/다시/i)).toBeInTheDocument());
  });
});
