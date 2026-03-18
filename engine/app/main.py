import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# Windows: Tesseract가 PATH에 없을 경우 자동 추가
_TESSERACT_WIN = Path("C:/Program Files/Tesseract-OCR")
if sys.platform == "win32" and _TESSERACT_WIN.exists():
    os.environ["PATH"] = str(_TESSERACT_WIN) + os.pathsep + os.environ.get("PATH", "")

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.parsers.exceptions import EmptyPDFError, ImageOnlyPDFError, FileSizeError, PageLimitError, ParseError, LLMError, InsufficientAnswersError
from app.routers.resume import router
from app.routers.interview import router as interview_router
from app.routers.report import router as report_router
from app.routers.practice import router as practice_router

app = FastAPI(title="MirAI Engine")

@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"detail": "요청 형식이 올바르지 않습니다."})

@app.exception_handler(EmptyPDFError)
@app.exception_handler(ImageOnlyPDFError)
@app.exception_handler(InsufficientAnswersError)
async def handle_422(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})

@app.exception_handler(FileSizeError)
@app.exception_handler(PageLimitError)
@app.exception_handler(ParseError)
async def handle_400(request, exc):
    return JSONResponse(status_code=400, content={"detail": str(exc)})

@app.exception_handler(LLMError)
async def handle_500(request, exc):
    return JSONResponse(status_code=500, content={"detail": str(exc)})

@app.middleware("http")
async def catch_unexpected_errors(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        _logger = logging.getLogger(__name__)
        _logger.error("예기치 않은 오류: %s", exc, exc_info=True)
        return JSONResponse(status_code=500, content={"detail": "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."})

app.include_router(router, prefix="/api")
app.include_router(interview_router, prefix="/api")
app.include_router(report_router, prefix="/api")
app.include_router(practice_router, prefix="/api")

@app.get("/")
async def health():
    return {"status": "ok"}
