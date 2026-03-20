from fastapi import APIRouter
from app.schemas import ReportRequest, ReportResponse
from app.services.report_service import generate_report

router = APIRouter()


@router.post("/report/generate", response_model=ReportResponse)
async def generate_report_endpoint(body: ReportRequest):
    data, usage = generate_report(body.resumeText, body.history)
    data.usage = usage
    return data
