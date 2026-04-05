// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/engine-client", () => ({
  engineFetch: vi.fn(),
}));

vi.mock("@/lib/resume-storage", () => ({
  uploadResumePdf: vi.fn(),
  deleteResumePdf: vi.fn(),
}));

const { mockMaybeSingle, mockUpsert } = vi.hoisted(() => ({
  mockMaybeSingle: vi.fn(),
  mockUpsert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "user-123" } },
        error: null,
      }),
    },
  }),
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      upsert: mockUpsert,
    }),
  }),
}));

import { engineFetch } from "@/lib/engine-client";
import { uploadResumePdf, deleteResumePdf } from "@/lib/resume-storage";
import { POST } from "../upload/route";

const mockEngFetch = vi.mocked(engineFetch);
const mockUploadResumePdf = vi.mocked(uploadResumePdf);
const mockDeleteResumePdf = vi.mocked(deleteResumePdf);

function makePdfRequest(size = 1024, type = "application/pdf") {
  const buffer = new Uint8Array(size).fill(0);
  const file = new File([buffer], "cv.pdf", { type });
  const formData = new FormData();
  formData.append("file", file);
  return new Request("http://localhost/api/resume/upload", {
    method: "POST",
    body: formData,
  });
}

describe("POST /api/resume/upload", () => {
  beforeEach(() => {
    mockEngFetch.mockReset();
    mockUploadResumePdf.mockReset();
    mockDeleteResumePdf.mockReset();
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();

    mockEngFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ resumeText: "자소서 내용" }),
    } as Response);
    mockUploadResumePdf.mockResolvedValue("user-123/abc.pdf");
    mockDeleteResumePdf.mockResolvedValue(undefined);
    mockMaybeSingle.mockResolvedValue({ data: null });
    mockUpsert.mockResolvedValue({ error: null });
  });

  it("미인증 요청에 401을 반환한다", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    } as never);

    const req = makePdfRequest();
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("PDF가 아닌 파일에 400을 반환한다", async () => {
    const file = new File([new Uint8Array(100)], "cv.docx", {
      type: "application/msword",
    });
    const formData = new FormData();
    formData.append("file", file);
    const req = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      body: formData,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockUploadResumePdf).not.toHaveBeenCalled();
  });

  it("5MB 초과 파일에 400을 반환한다", async () => {
    const req = makePdfRequest(5 * 1024 * 1024 + 1);
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockUploadResumePdf).not.toHaveBeenCalled();
  });

  it("유효한 PDF + 인증 → 200 및 storageKey 반환", async () => {
    const req = makePdfRequest();
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.storageKey).toBe("user-123/abc.pdf");
    expect(data.fileName).toBe("cv.pdf");
    expect(data.resumeText).toBe("자소서 내용");
  });

  it("엔진 parse 실패 시 400 반환하고 Storage 업로드를 하지 않는다", async () => {
    mockEngFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "parse error" }),
    } as Response);

    const req = makePdfRequest();
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(mockUploadResumePdf).not.toHaveBeenCalled();
  });

  it("DB upsert 실패 시 500 반환하고 Storage 파일을 롤백한다", async () => {
    mockUpsert.mockResolvedValueOnce({ error: { message: "db error" } });

    const req = makePdfRequest();
    const res = await POST(req);

    expect(res.status).toBe(500);
    expect(mockDeleteResumePdf).toHaveBeenCalledWith("user-123/abc.pdf");
  });

  it("기존 레코드 있을 때 재업로드 시 이전 storageKey 삭제를 호출한다", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { storage_key: "user-123/old.pdf" },
    });
    mockUploadResumePdf.mockResolvedValueOnce("user-123/new.pdf");

    const req = makePdfRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockDeleteResumePdf).toHaveBeenCalledWith("user-123/old.pdf");
  });
});
