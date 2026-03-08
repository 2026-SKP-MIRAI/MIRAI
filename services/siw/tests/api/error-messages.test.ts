import { describe, it, expect } from "vitest";
import { mapDetailToKey } from "@/lib/error-messages";

describe("mapDetailToKey", () => {
  it("파일 필요 에러를 noFile로 매핑한다", () => {
    expect(mapDetailToKey("파일이 필요합니다.", 400)).toBe("noFile");
  });

  it("파일 크기 에러를 tooLarge로 매핑한다", () => {
    expect(mapDetailToKey("파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.", 400)).toBe("tooLarge");
  });

  it("페이지 수 에러를 tooManyPages로 매핑한다", () => {
    expect(mapDetailToKey("페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요.", 400)).toBe("tooManyPages");
  });

  it("손상된 PDF 에러를 corruptedPdf로 매핑한다", () => {
    expect(mapDetailToKey("PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.", 400)).toBe("corruptedPdf");
  });

  it("이미지 전용 PDF 에러를 imageOnlyPdf로 매핑한다", () => {
    // 엔진 ImageOnlyPDFError 메시지: "이미지"와 "텍스트" 둘 다 포함 — imageOnlyPdf를 먼저 검사해야 함
    const detail = "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.";
    expect(mapDetailToKey(detail, 422)).toBe("imageOnlyPdf");
  });

  it("텍스트 없는 빈 PDF 에러를 emptyPdf로 매핑한다", () => {
    const detail = "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.";
    expect(mapDetailToKey(detail, 422)).toBe("emptyPdf");
  });

  it("알 수 없는 에러를 llmError로 매핑한다", () => {
    expect(mapDetailToKey("질문 생성 중 오류가 발생했습니다.", 500)).toBe("llmError");
  });
});
