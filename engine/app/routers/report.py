from fastapi import APIRouter
from app.schemas import ReportRequest, ReportResponse
from app.services.report_service import generate_report

router = APIRouter()


@router.post("/report/generate", response_model=ReportResponse)
async def generate_report_endpoint(body: ReportRequest):
    return generate_report(body.resumeText, body.history)
