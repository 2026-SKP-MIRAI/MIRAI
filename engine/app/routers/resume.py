import logging

from fastapi import APIRouter, File, Request, UploadFile
from app.schemas import (
    ParseResponse, QuestionsRequest, QuestionsResponse, Meta,
    ResumeFeedbackRequest, ResumeFeedbackResponse,
    TargetRoleRequest, TargetRoleResponse, AnalyzeResponse,
)
from app.parsers.pdf_parser import parse_pdf
from app.parsers.exceptions import FileSizeError, ParseError
from app.services.llm_service import generate_questions
from app.services.feedback_service import generate_resume_feedback
from app.services.role_service import extract_target_role

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024

router = APIRouter(prefix="/resume")


async def _validate_and_parse_pdf(request: Request, file: UploadFile | None, endpoint: str):
    """PDF 업로드 공통 검증·파싱 헬퍼. ParseError / FileSizeError 발생 시 main.py 핸들러가 처리."""
    logger.info("[resume/%s] 요청 수신: 파일명=%s, content_type=%s",
                endpoint, file.filename if file else None, file.content_type if file else None)

    if file is None:
        logger.warning("[resume/%s] 파일 없음", endpoint)
        raise ParseError("파일이 없습니다. PDF 파일을 업로드해 주세요.")

    content_type = file.content_type or ""
    if "pdf" not in content_type.lower():
        raise ParseError("PDF 파일만 업로드 가능합니다.")

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            # +1024: multipart/form-data 경계(boundary) 헤더 오버헤드를 고려한 여유 마진
            parsed_length = int(content_length)
        except ValueError:
            parsed_length = None
        if parsed_length is not None and parsed_length > MAX_UPLOAD_BYTES + 1024:
            raise FileSizeError("파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.")

    file_bytes = await file.read()
    parsed = parse_pdf(file_bytes, filename=file.filename)
    logger.info("[resume/%s] 파싱 완료: 텍스트 길이=%d", endpoint, parsed.extracted_length)
    return parsed


@router.post("/parse", response_model=ParseResponse)
async def parse_resume(request: Request, file: UploadFile | None = File(None)):
    parsed = await _validate_and_parse_pdf(request, file, "parse")
    return ParseResponse(resumeText=parsed.text, extractedLength=parsed.extracted_length)


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_resume(request: Request, file: UploadFile | None = File(None)):
    parsed = await _validate_and_parse_pdf(request, file, "analyze")
    role = extract_target_role(parsed.text)
    logger.info("[resume/analyze] 직무 추출 완료: %s", role)
    return AnalyzeResponse(
        resumeText=parsed.text,
        extractedLength=parsed.extracted_length,
        targetRole=role,
    )


@router.post("/target-role", response_model=TargetRoleResponse)
async def get_target_role(body: TargetRoleRequest):
    logger.info("[resume/target-role] 요청 수신: resumeText 길이=%d", len(body.resumeText))
    role = extract_target_role(body.resumeText)
    logger.info("[resume/target-role] 직무 추출 완료: %s", role)
    return TargetRoleResponse(targetRole=role)


@router.post("/questions", response_model=QuestionsResponse)
async def create_questions(body: QuestionsRequest):
    logger.info("[resume/questions] 요청 수신: resumeText 길이=%d", len(body.resumeText))
    questions, usage = generate_questions(body.resumeText, target_role=body.targetRole)
    logger.info("[resume/questions] 질문 생성 완료: %d개", len(questions))
    categories_used = list(dict.fromkeys(q.category for q in questions))
    return QuestionsResponse(
        questions=questions,
        meta=Meta(extractedLength=len(body.resumeText), categoriesUsed=categories_used),
        usage=usage,
    )


@router.post("/feedback", response_model=ResumeFeedbackResponse)
async def create_feedback(body: ResumeFeedbackRequest):
    logger.info("[resume/feedback] 요청 수신: resumeText 길이=%d, targetRole=%s",
                len(body.resumeText), body.targetRole)
    data, usage = generate_resume_feedback(body.resumeText, body.targetRole)
    data.usage = usage
    return data
