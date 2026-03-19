export type Category = "직무 역량" | "경험의 구체성" | "성과 근거" | "기술 역량";
export type QuestionItem = { category: Category; question: string };
export type QuestionsResponse = {
  questions: QuestionItem[];
  meta: { extractedLength: number; categoriesUsed: string[] };
};
export type UploadState = "idle" | "ready" | "uploading" | "processing" | "done" | "error";

// 면접 관련 타입
export type PersonaType = "hr" | "tech_lead" | "executive";

export interface QueueItem {
  question: string;
  persona: PersonaType;
  type: "main" | "follow_up";
}

export interface HistoryItem {
  question: string;
  answer: string;
  persona: PersonaType;
  personaLabel: string;
}

export interface InterviewState {
  sessionId: string | null;
  resumeText: string;
  currentQuestion: string;
  currentPersona: PersonaType;
  history: HistoryItem[];
  questionsQueue: QueueItem[];
  questionIndex: number;
  status: "idle" | "loading" | "answering" | "submitting" | "ending" | "complete" | "error";
}

export interface AxisScore {
  axis: string;
  axisLabel: string;
  score: number;
  type: "strength" | "improvement";
  feedback: string;
}

export interface ReportResponse {
  totalScore: number;
  summary: string;
  axisFeedbacks: AxisScore[];
  growthCurve: null;
}
