import logging

import fitz  # PyMuPDF

from .exceptions import EmptyPDFError, ImageOnlyPDFError, ParseError, FileSizeError, PageLimitError
from app.schemas import ParsedResume

logger = logging.getLogger(__name__)

# OCR 렌더링 해상도 — ~24MB/페이지, max_pages=10 기준 최대 ~240MB
_OCR_DPI = 300


def _ocr_fallback(doc: fitz.Document) -> str:
    """이미지 PDF에서 OCR로 텍스트 추출. 실패 시 빈 문자열 반환.

    전제: doc은 열린 상태(with 블록 안)이어야 하며, 호출 전 텍스트 레이어가 없고
    이미지가 포함됨을 확인한 상태여야 한다.
    """
    try:
        parts = []
        for page in doc:
            tp = page.get_textpage_ocr(language="eng+kor", dpi=_OCR_DPI)
            parts.append(page.get_text(textpage=tp))
        return "\n".join(parts).strip()
    except Exception:
        logger.warning("OCR fallback failed", exc_info=True)
        return ""


def parse_pdf(
    file_bytes: bytes,
    *,
    filename: str | None = None,
    max_file_size_bytes: int = 5 * 1024 * 1024,
    max_pages: int = 10,
) -> ParsedResume:
    # 파일 크기 검증
    if len(file_bytes) > max_file_size_bytes:
        raise FileSizeError(
            f"파일 크기가 너무 큽니다. {max_file_size_bytes // (1024 * 1024)}MB 이하의 파일을 업로드해 주세요."
        )

    # PDF 파싱
    try:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception as e:
        raise ParseError("PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요.") from e

    with doc:
        # 페이지 수 검증
        page_count = len(doc)
        if page_count > max_pages:
            raise PageLimitError(
                f"페이지 수가 너무 많습니다. {max_pages}페이지 이하의 파일을 업로드해 주세요."
            )

        # 텍스트 추출
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())

        full_text = "\n".join(text_parts).strip()

        if not full_text:
            # 이미지 포함 여부로 EmptyPDF vs ImageOnly 구분
            has_images = any(page.get_images() for page in doc)
            if has_images:
                ocr_text = _ocr_fallback(doc)
                if ocr_text:
                    return ParsedResume(text=ocr_text, extracted_length=len(ocr_text))
                raise ImageOnlyPDFError(
                    "이미지는 있으나 텍스트를 추출할 수 없는 PDF입니다. 텍스트가 선명한 PDF를 업로드해 주세요."
                )
            raise EmptyPDFError(
                "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요."
            )

        return ParsedResume(text=full_text, extracted_length=len(full_text))
