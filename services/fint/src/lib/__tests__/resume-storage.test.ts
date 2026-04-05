// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUpload, mockRemove } = vi.hoisted(() => ({
  mockUpload: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: vi.fn().mockReturnValue({
    storage: {
      from: vi.fn().mockReturnValue({
        upload: mockUpload,
        remove: mockRemove,
      }),
    },
  }),
}));

import { uploadResumePdf, deleteResumePdf } from "../resume-storage";

describe("resume-storage", () => {
  beforeEach(() => {
    mockUpload.mockReset();
    mockRemove.mockReset();
    vi.stubEnv("SUPABASE_STORAGE_BUCKET", "resumes");
  });

  describe("uploadResumePdf", () => {
    it("storageKey를 {userId}/{uuid}.pdf 형식으로 반환한다", async () => {
      mockUpload.mockResolvedValue({ error: null });
      const key = await uploadResumePdf("user-123", Buffer.from("pdf"));
      expect(key).toMatch(/^user-123\/[0-9a-f-]{36}\.pdf$/);
    });

    it("Storage 오류 발생 시 에러를 던진다", async () => {
      mockUpload.mockResolvedValue({ error: { message: "upload failed" } });
      await expect(
        uploadResumePdf("user-123", Buffer.from("pdf"))
      ).rejects.toThrow("Storage upload failed");
    });

    it("SUPABASE_STORAGE_BUCKET 미설정 시 에러를 던진다", async () => {
      vi.stubEnv("SUPABASE_STORAGE_BUCKET", "");
      await expect(
        uploadResumePdf("user-123", Buffer.from("pdf"))
      ).rejects.toThrow("SUPABASE_STORAGE_BUCKET is not set");
    });
  });

  describe("deleteResumePdf", () => {
    it("remove를 올바른 storageKey로 호출한다", async () => {
      mockRemove.mockResolvedValue({ error: null });
      await deleteResumePdf("user-123/abc.pdf");
      expect(mockRemove).toHaveBeenCalledWith(["user-123/abc.pdf"]);
    });

    it("Storage 오류 발생 시 에러를 던진다", async () => {
      mockRemove.mockResolvedValue({ error: { message: "delete failed" } });
      await expect(deleteResumePdf("user-123/abc.pdf")).rejects.toThrow(
        "Storage delete failed"
      );
    });
  });
});
