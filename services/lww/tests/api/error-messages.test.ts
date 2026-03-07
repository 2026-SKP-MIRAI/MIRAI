import { describe, it, expect } from "vitest";
import { mapDetailToKey } from "@/lib/error-messages";

describe("mapDetailToKey", () => {
  it("이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다", () => {
    // 엔진 ImageOnlyPDFError 메시지: "이미지"와 "텍스트" 둘 다 포함
    const detail =
      "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.";
    expect(mapDetailToKey(detail, 422)).toBe("imageOnlyPdf");
  });

  it("텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다", () => {
    const detail =
      "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.";
    expect(mapDetailToKey(detail, 422)).toBe("emptyPdf");
  });
});
