import logging

from fastapi import APIRouter, File, Request, UploadFile
from app.schemas import QuestionsResponse, Meta, ResumeFeedbackRequest, ResumeFeedbackResponse
from app.parsers.pdf_parser import parse_pdf
from app.parsers.exceptions import FileSizeError, ParseError
from app.services.llm_service import generate_questions
from app.services.feedback_service import generate_resume_feedback

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024

router = APIRouter(prefix="/resume")

@router.post("/questions", response_model=QuestionsResponse)
async def create_questions(request: Request, file: UploadFile | None = File(None)):
    logger.info("[resume/questions] 요청 수신: 파일명=%s, content_type=%s", file.filename if file else None, file.content_type if file else None)

    if file is None:
        logger.warning("[resume/questions] 파일 없음")
        raise ParseError("파일이 없습니다. PDF 파일을 업로드해 주세요.")

    # Content-Length 기반 선제 크기 제한 (메모리 DoS 방지)
    content_length = request.headers.get("content-length")
    try:
        if content_length and int(content_length) > MAX_UPLOAD_BYTES:
            raise FileSizeError("파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요.")
    except ValueError:
        pass  # 비정상 헤더는 무시하고 본문 크기 검증으로 fallback

    file_bytes = await file.read()

    # content_type 검증 (MIME 위장 방지)
    content_type = file.content_type or ""
    if "pdf" not in content_type.lower():
        raise ParseError("PDF 파일만 업로드 가능합니다.")

    parsed = parse_pdf(file_bytes, filename=file.filename)
    logger.info("[resume/questions] PDF 파싱 완료: 텍스트 길이=%d", parsed.extracted_length)

    questions = generate_questions(parsed.text)
    logger.info("[resume/questions] 질문 생성 완료: %d개", len(questions))

    categories_used = list(dict.fromkeys(q.category for q in questions))

    return QuestionsResponse(
        questions=questions,
        meta=Meta(
            extractedLength=parsed.extracted_length,
            categoriesUsed=categories_used,
        ),
    )


@router.post("/feedback", response_model=ResumeFeedbackResponse)
async def create_feedback(body: ResumeFeedbackRequest):
    logger.info("[resume/feedback] 요청 수신: resumeText 길이=%d, targetRole=%s",
                len(body.resumeText), body.targetRole)
    return generate_resume_feedback(body.resumeText, body.targetRole)
