export type Category = "직무 역량" | "경험의 구체성" | "성과 근거" | "기술 역량";
export type QuestionItem = { category: Category; question: string };
export type QuestionsResponse = {
  questions: QuestionItem[];
  meta: { extractedLength: number; categoriesUsed: string[] };
  resumeId: string;
};
export type UploadState = "idle" | "ready" | "uploading" | "done" | "error";

export type PersonaType = "hr" | "tech_lead" | "executive";
export type FollowupType = "CLARIFY" | "CHALLENGE" | "EXPLORE";
export type QueueItem = { persona: PersonaType; type: "main" | "follow_up" };
export type QuestionWithPersona = {
  persona: PersonaType;
  personaLabel: string;
  question: string;
  type?: "main" | "follow_up";
};
export type HistoryItem = {
  persona: PersonaType;
  personaLabel: string;
  question: string;
  answer: string;
  type: "main" | "follow_up";
};
export type InterviewAnswerResponse = {
  nextQuestion: QuestionWithPersona | null;
  updatedQueue: QueueItem[];
  sessionComplete: boolean;
};

export type AxisScores = {
  communication: number;
  problemSolving: number;
  logicalThinking: number;
  jobExpertise: number;
  cultureFit: number;
  leadership: number;
  creativity: number;
  sincerity: number;
};

export type AxisFeedback = {
  axis: string;
  axisLabel: string;
  score: number;
  type: "strength" | "improvement";
  feedback: string;
};

export type ReportResponse = {
  scores: AxisScores;
  totalScore: number;
  summary: string;
  axisFeedbacks: AxisFeedback[];
  growthCurve: null;
};

export type GrowthSession = {
  id: string;
  createdAt: string;
  reportTotalScore: number;
  scores: AxisScores;
  resumeLabel: string;
  axisFeedbacks?: AxisFeedback[];
};

export type InterviewMode = "real" | "practice";
export type PracticeFeedback = {
  score: number;
  feedback: { good: string[]; improve: string[] };
  keywords: string[];
  improvedAnswerGuide: string;
  comparisonDelta?: { scoreDelta: number; improvements: string[] } | null;
};

// 이력서 피드백 타입 (engine ResumeFeedbackResponse와 완전 일치)
export type ResumeFeedbackScores = {
  specificity: number        // 경험·사례의 구체성
  achievementClarity: number // 성과의 명확성
  logicStructure: number     // 논리 구조
  roleAlignment: number      // 직무 연관성
  differentiation: number    // 차별화
}

export type SuggestionItem = {
  section: string
  issue: string
  suggestion: string
}

export type ResumeFeedback = {
  scores: ResumeFeedbackScores
  strengths: string[]
  weaknesses: string[]
  suggestions: SuggestionItem[]
}
