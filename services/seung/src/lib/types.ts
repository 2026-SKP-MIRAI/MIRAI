export type Question = {
  category: string
  question: string
}

export type QuestionsResponse = {
  questions: Question[]
  meta: {
    extractedLength: number
    categoriesUsed: string[]
  }
}

export type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

export const ERROR_MESSAGES: Record<number, string> = {
  400: 'PDF 파일을 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.',
  413: '파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.',
  422: '텍스트를 읽을 수 없는 PDF입니다. 텍스트가 포함된 파일을 업로드해 주세요.',
  500: '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
}

export const DEFAULT_ERROR_MESSAGE = '오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
