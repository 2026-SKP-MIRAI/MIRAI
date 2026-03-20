from fastapi import APIRouter
from app.schemas import PracticeFeedbackRequest, PracticeFeedbackResponse
from app.services.practice_service import generate_practice_feedback

router = APIRouter()


@router.post("/practice/feedback", response_model=PracticeFeedbackResponse)
async def practice_feedback_endpoint(body: PracticeFeedbackRequest):
    data, usage = generate_practice_feedback(
        body.question,
        body.answer,
        body.previousAnswer,
        previous_score=body.previousScore,
    )
    data.usage = usage
    return data
