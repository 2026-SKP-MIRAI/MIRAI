from typing import Literal
from pydantic import BaseModel, Field


class UsageMetadata(BaseModel):
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    model: str

FeedbackType = Literal["strength", "improvement"]

Category = Literal["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]

class ParsedResume(BaseModel):
    text: str
    extracted_length: int


class ParseResponse(BaseModel):
    resumeText: str
    extractedLength: int


class QuestionsRequest(BaseModel):
    # max_length=50_000: 5MB PDF 기준 최대 ~16K자이나 여유 있게 설정
    # 내부적으로 llm_service가 16,000자로 잘라 LLM에 전달 (묵시적 잘림)
    resumeText: str = Field(..., min_length=1, max_length=50_000)
    targetRole: str | None = Field(None, max_length=100,
                                   description="사용자 확정 직무. 미입력 시 resume 내용 기반으로 질문 생성")


class QuestionItem(BaseModel):
    category: Category
    question: str

class Meta(BaseModel):
    extractedLength: int
    categoriesUsed: list[str]

class QuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    meta: Meta
    usage: UsageMetadata | None = None


PersonaType = Literal["hr", "tech_lead", "executive"]
FollowupType = Literal["CLARIFY", "CHALLENGE", "EXPLORE"]


class QueueItem(BaseModel):
    persona: PersonaType
    type: Literal["main", "follow_up"]


class QuestionWithPersona(BaseModel):
    persona: PersonaType
    personaLabel: str
    question: str
    type: Literal["main", "follow_up"] = "main"


class HistoryItem(BaseModel):
    persona: PersonaType
    personaLabel: str
    question: str
    answer: str


class InterviewStartRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    personas: list[PersonaType] = Field(..., min_length=1)
    mode: Literal["panel"] = "panel"


class InterviewStartResponse(BaseModel):
    firstQuestion: QuestionWithPersona
    questionsQueue: list[QueueItem]
    usage: UsageMetadata | None = None


class InterviewAnswerRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    history: list[HistoryItem]
    questionsQueue: list[QueueItem]
    currentQuestion: str = Field(..., min_length=1)
    currentPersona: PersonaType
    currentAnswer: str = Field(..., min_length=1, max_length=5000)


class InterviewAnswerResponse(BaseModel):
    nextQuestion: QuestionWithPersona | None = None
    updatedQueue: list[QueueItem]
    sessionComplete: bool
    usage: UsageMetadata | None = None


class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    persona: PersonaType
    resumeText: str = Field(..., min_length=1)


class FollowupResponse(BaseModel):
    followupType: FollowupType
    followupQuestion: str
    reasoning: str
    usage: UsageMetadata | None = None


class AxisScores(BaseModel):
    communication:   int = Field(..., ge=0, le=100)
    problemSolving:  int = Field(..., ge=0, le=100)
    logicalThinking: int = Field(..., ge=0, le=100)
    jobExpertise:    int = Field(..., ge=0, le=100)
    cultureFit:      int = Field(..., ge=0, le=100)
    leadership:      int = Field(..., ge=0, le=100)
    creativity:      int = Field(..., ge=0, le=100)
    sincerity:       int = Field(..., ge=0, le=100)


class AxisFeedback(BaseModel):
    axis:      str
    axisLabel: str
    score:     int = Field(..., ge=0, le=100)
    type:      FeedbackType
    feedback:  str


class ReportRequest(BaseModel):
    resumeText: str = Field(..., min_length=1)
    history: list[HistoryItem] = Field(..., min_length=1)


class ReportResponse(BaseModel):
    scores:        AxisScores
    totalScore:    int = Field(..., ge=0, le=100)
    summary:       str
    axisFeedbacks: list[AxisFeedback] = Field(..., min_length=8, max_length=8)
    growthCurve:   None = None
    usage:         UsageMetadata | None = None


# --- 연습 모드 피드백 ---

class FeedbackDetail(BaseModel):
    good:    list[str] = Field(..., min_length=1, max_length=3, description="잘한 점 1-3개")
    improve: list[str] = Field(..., min_length=1, max_length=3, description="개선할 점 1-3개")


class ComparisonDelta(BaseModel):
    scoreDelta:   int       = Field(..., ge=-100, le=100, description="이전 대비 점수 변화")
    improvements: list[str] = Field(default_factory=list, description="구체적 개선 사항 (0개 이상)")


class PracticeFeedbackRequest(BaseModel):
    question:       str          = Field(..., min_length=1, description="면접 질문")
    answer:         str          = Field(..., min_length=1, max_length=5000, description="사용자 답변")
    previousAnswer: str | None   = Field(None, min_length=1, max_length=5000, description="이전 답변 (비교용, 선택)")


class PracticeFeedbackResponse(BaseModel):
    score:               int                     = Field(..., ge=0, le=100)
    feedback:            FeedbackDetail
    keywords:            list[str]               = Field(..., min_length=1, max_length=5)
    improvedAnswerGuide: str                     = Field(..., min_length=1)
    comparisonDelta:     ComparisonDelta | None  = None
    usage:               UsageMetadata | None    = None


# --- 이력서·자소서 피드백 ---

class ResumeFeedbackScores(BaseModel):
    specificity:        int = Field(..., ge=0, le=100)
    achievementClarity: int = Field(..., ge=0, le=100)
    logicStructure:     int = Field(..., ge=0, le=100)
    roleAlignment:      int = Field(..., ge=0, le=100)
    differentiation:    int = Field(..., ge=0, le=100)


class SuggestionItem(BaseModel):
    section:    str
    issue:      str
    suggestion: str


class ResumeFeedbackRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=50_000)
    targetRole: str | None = Field(None, max_length=100, description="지원 직무. 미입력 시 '미지정 직무'로 처리")


class ResumeFeedbackResponse(BaseModel):
    scores:      ResumeFeedbackScores
    strengths:   list[str] = Field(..., min_length=2, max_length=3)
    weaknesses:  list[str] = Field(..., min_length=2, max_length=3)
    suggestions: list[SuggestionItem] = Field(..., min_length=1)
    usage:       UsageMetadata | None = None


# --- targetRole 추출 ---

class TargetRoleRequest(BaseModel):
    resumeText: str = Field(..., min_length=1, max_length=50_000)


class TargetRoleResponse(BaseModel):
    targetRole: str = Field(..., max_length=100)


class AnalyzeResponse(BaseModel):
    resumeText: str
    extractedLength: int
    targetRole: str = Field(..., max_length=100)


# --- 임베딩 ---

class EmbedRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=100)
    model: str = "text-embedding-004"


class EmbedResponse(BaseModel):
    embeddings: list[list[float]]
    model: str
    usage: UsageMetadata | None = None
