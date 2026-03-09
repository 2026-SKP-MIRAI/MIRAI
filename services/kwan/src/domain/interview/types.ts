export type Category = '직무 역량' | '경험의 구체성' | '성과 근거' | '기술 역량'

export interface Question {
  category: Category
  question: string
}

export interface GenerateResult {
  questions: Question[]
  meta: {
    extractedLength: number
    categoriesUsed: Category[]
  }
}

export type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error'
