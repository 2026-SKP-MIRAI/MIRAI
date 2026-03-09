from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.parsers.exceptions import EmptyPDFError, ImageOnlyPDFError, FileSizeError, PageLimitError, ParseError, LLMError
from app.routers.resume import router
from app.routers.interview import router as interview_router

app = FastAPI(title="MirAI Engine")

@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, exc: RequestValidationError):
    return JSONResponse(status_code=400, content={"detail": "요청 형식이 올바르지 않습니다."})

@app.exception_handler(EmptyPDFError)
@app.exception_handler(ImageOnlyPDFError)
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

app.include_router(router, prefix="/api")
app.include_router(interview_router, prefix="/api")
