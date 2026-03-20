from fastapi import APIRouter
from app.schemas import (
    InterviewStartRequest, InterviewStartResponse,
    InterviewAnswerRequest, InterviewAnswerResponse,
    FollowupRequest, FollowupResponse,
)
from app.services.interview_service import start_interview, process_answer, generate_followup

router = APIRouter(prefix="/interview")


@router.post("/start", response_model=InterviewStartResponse)
async def start(req: InterviewStartRequest):
    data, usage = start_interview(req.resumeText, req.personas)
    data.usage = usage
    return data


@router.post("/answer", response_model=InterviewAnswerResponse)
async def answer(req: InterviewAnswerRequest):
    data, usage = process_answer(
        req.resumeText, req.history, req.questionsQueue,
        req.currentQuestion, req.currentPersona, req.currentAnswer
    )
    data.usage = usage
    return data


@router.post("/followup", response_model=FollowupResponse)
async def followup(req: FollowupRequest):
    data, usage = generate_followup(req.question, req.answer, req.persona, req.resumeText)
    data.usage = usage
    return data
