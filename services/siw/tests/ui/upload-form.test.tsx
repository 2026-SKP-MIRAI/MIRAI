import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import UploadForm from "@/components/UploadForm";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const mockOnComplete = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

describe("UploadForm", () => {
  it("초기 idle: 버튼 disabled", () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const btn = screen.getByRole("button", { name: /이력서 분석/ });
    expect(btn).toBeDisabled();
  });

  it("파일 선택 → 버튼 활성화", () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });
    const btn = screen.getByRole("button", { name: /이력서 분석/ });
    expect(btn).not.toBeDisabled();
  });

  it("uploading → confirming: /analyze 성공 후 직무 확인 UI 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "이력서 텍스트", targetRole: "백엔드 개발자" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      expect(screen.getByText("지원 직무가 확인됐어요")).toBeInTheDocument();
    });
  });

  it("confirming: targetRole 입력란에 AI 추론 직무 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "프론트엔드 개발자" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      const roleInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(roleInput.value).toBe("프론트엔드 개발자");
    });
  });

  it("confirming: targetRole='미지정' → 빈 input + placeholder", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "미지정" }), { status: 200 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      const roleInput = screen.getByRole("textbox") as HTMLInputElement;
      expect(roleInput.value).toBe("");
      expect(roleInput.placeholder).toBe("지원 직무를 입력하세요");
    });
  });

  it("confirming → done: 확인 버튼 클릭 → onComplete 호출", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ resumeText: "텍스트", targetRole: "개발자" }), { status: 200 })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ questions: [], resumeId: "r-1" }), { status: 200 })
      );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => screen.getByText("지원 직무가 확인됐어요"));

    fireEvent.click(screen.getByRole("button", { name: /이 직무로 면접 준비하기/ }));
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith(expect.objectContaining({ resumeId: "r-1" }));
    });
  });

  it("/analyze 오류 → error 상태 + 에러 메시지 표시", async () => {
    render(<UploadForm onComplete={mockOnComplete} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["pdf"], "resume.pdf", { type: "application/pdf" })] } });

    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "PDF 파일을 읽을 수 없습니다." }), { status: 422 })
    );

    fireEvent.click(screen.getByRole("button", { name: /이력서 분석/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});
