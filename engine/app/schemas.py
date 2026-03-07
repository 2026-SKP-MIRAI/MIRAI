from typing import Literal
from pydantic import BaseModel

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
