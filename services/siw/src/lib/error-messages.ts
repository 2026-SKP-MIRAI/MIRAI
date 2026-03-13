export const ENGINE_ERROR_MESSAGES = {
  noFile:       "파일이 없습니다. PDF 파일을 업로드해 주세요.",
  tooLarge:     "파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.",
  tooManyPages: "페이지 수가 너무 많습니다. 10페이지 이하의 파일을 업로드해 주세요.",
  corruptedPdf: "PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.",
  imageOnlyPdf: "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요.",
  emptyPdf:     "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요.",
  llmError:     "질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  interviewStartFailed: "면접 시작에 실패했습니다. 다시 시도해주세요.",
  interviewAnswerFailed: "답변 처리 중 오류가 발생했습니다.",
  sessionNotFound: "면접 세션을 찾을 수 없습니다.",
} as const;

export type ErrorKey = keyof typeof ENGINE_ERROR_MESSAGES;

export function mapDetailToKey(detail: string, status: number): ErrorKey {
  if (detail.includes("파일") && detail.includes("필요")) return "noFile";
  if (detail.includes("크기") || detail.includes("5MB")) return "tooLarge";
  if (detail.includes("페이지")) return "tooManyPages";
  if (detail.includes("읽을 수 없")) return "corruptedPdf";
  if (status === 422 && detail.includes("이미지")) return "imageOnlyPdf";
  if (status === 422 && detail.includes("텍스트")) return "emptyPdf";
  return "llmError";
}
