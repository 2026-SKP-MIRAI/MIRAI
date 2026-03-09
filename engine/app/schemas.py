from typing import Literal
from pydantic import BaseModel, Field

Category = Literal["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]

class ParsedResume(BaseModel):
    text: str
    extracted_length: int

class QuestionItem(BaseModel):
    category: Category
    question: str

class Meta(BaseModel):
    extractedLength: int
    categoriesUsed: list[str]

class QuestionsResponse(BaseModel):
    questions: list[QuestionItem]
    meta: Meta


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


class FollowupRequest(BaseModel):
    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    persona: PersonaType
    resumeText: str = Field(..., min_length=1)


class FollowupResponse(BaseModel):
    followupType: FollowupType
    followupQuestion: str
    reasoning: str
