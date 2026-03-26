"""e2e 전용 pytest 픽스처 및 마크 설정."""
from __future__ import annotations

import os
from pathlib import Path

# engine/.env 자동 로드 (pytest 프로세스는 .env를 자동으로 읽지 않음)
_ENV_FILE = Path(__file__).parent.parent.parent / ".env"
if _ENV_FILE.exists():
    for _line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        _line = _line.strip()
        if _line and not _line.startswith("#") and "=" in _line:
            _key, _, _val = _line.partition("=")
            os.environ.setdefault(_key.strip(), _val.strip())

import fitz  # PyMuPDF
import pytest


# ── RUN_E2E_AGENT 플래그 없으면 모든 e2e 테스트 자동 skip ──────────────────

def pytest_collection_modifyitems(items):
    if not os.getenv("RUN_E2E_AGENT"):
        skip_marker = pytest.mark.skip(reason="RUN_E2E_AGENT 환경변수가 설정되지 않았습니다.")
        for item in items:
            if "e2e" in str(item.fspath):
                # unit 테스트(test_agent_unit.py)는 실제 서버 불필요 — skip 제외
                if "test_agent_unit" not in str(item.fspath):
                    item.add_marker(skip_marker)


# ── 픽스처 ─────────────────────────────────────────────────────────────────

@pytest.fixture
def base_url() -> str:
    return os.getenv("ENGINE_BASE_URL", "http://localhost:8000")


@pytest.fixture
def e2e_pdf_bytes() -> bytes:
    """E2E 테스트용 자소서 샘플 PDF.

    fixtures/input/sample_resume.pdf 가 존재하면 사용하고,
    없으면 합성 PDF를 생성한다.
    """
    real_pdf = Path(__file__).parent.parent / "fixtures/input/sample_resume.pdf"
    if real_pdf.exists():
        return real_pdf.read_bytes()

    # 합성 자소서 PDF 생성
    doc = fitz.open()
    page = doc.new_page()
    resume_content = """
홍길동
소프트웨어 엔지니어 지원자

[자기소개]
저는 3년간 Python과 FastAPI를 활용한 백엔드 개발 경험을 보유하고 있습니다.
대학교 졸업 프로젝트로 실시간 데이터 처리 시스템을 개발하였으며,
팀 리더로서 5명의 팀원과 협업하여 성공적으로 서비스를 런칭한 경험이 있습니다.

[지원 동기]
귀사의 AI 기반 서비스에 깊은 관심을 갖고 있으며, 제 기술 역량과 문제 해결 능력을
발휘하여 팀에 기여하고 싶습니다. 특히 LLM 기반 서비스 개발에 큰 흥미를 느낍니다.

[경험]
- ABC 스타트업 백엔드 개발 인턴 (2023.06 - 2023.12)
  REST API 설계 및 구현, 데이터베이스 최적화로 응답속도 30% 개선
- 오픈소스 프로젝트 기여: Python 라이브러리 버그 수정 및 문서화

[기술 스택]
Python, FastAPI, PostgreSQL, Docker, Git, AWS
"""
    page.insert_text((50, 50), resume_content, fontsize=11)
    return doc.tobytes()
