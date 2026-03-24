from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from app.schemas import (
    InterviewStartRequest, InterviewStartResponse,
    InterviewAnswerRequest, InterviewAnswerResponse,
    FollowupRequest, FollowupResponse,
)
from app.services.interview_service import start_interview, process_answer, generate_followup, process_answer_stream

router = APIRouter(prefix="/interview")


@router.post("/start", response_model=InterviewStartResponse)
async def start(req: InterviewStartRequest):
    data, usage = start_interview(req.resumeText, req.personas)
    data.usage = usage
    return data


@router.post("/answer")
async def answer(req: InterviewAnswerRequest, stream: bool = Query(False)):
    if not stream:
        data, usage = process_answer(
            req.resumeText, req.history, req.questionsQueue,
            req.currentQuestion, req.currentPersona, req.currentAnswer
        )
        data.usage = usage
        return data

    async def _event_gen():
        # process_answer_stream 내부에 try/except가 있어 에러 이벤트를 직접 yield함
        async for event in process_answer_stream(
            req.resumeText, req.history, req.questionsQueue,
            req.currentQuestion, req.currentPersona, req.currentAnswer
        ):
            yield event

    return StreamingResponse(
        _event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/followup", response_model=FollowupResponse)
async def followup(req: FollowupRequest):
    data, usage = generate_followup(req.question, req.answer, req.persona, req.resumeText)
    data.usage = usage
    return data
