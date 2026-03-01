#!/usr/bin/env python3
"""
엔진 불변식 검증 스크립트
위반 시 수정 방법을 메시지에 직접 포함 — 에이전트가 스스로 수정 가능하도록

사용법:
  python scripts/check_invariants.py --check all
  python scripts/check_invariants.py --check llm
  python scripts/check_invariants.py --check pdf
"""

import sys
import argparse
from pathlib import Path

# 불변식 1: 이 패턴이 engine/services/ 밖에 있으면 위반
LLM_PATTERNS = [
    "import openai", "from openai",
    "import anthropic", "from anthropic",
    "import litellm", "from litellm",
    "import langchain", "from langchain",
    "ChatOpenAI", "ChatAnthropic",
]

# 불변식 2: 이 패턴이 engine/parsers/ 밖에 있으면 위반
PDF_PATTERNS = [
    "import pypdf", "from pypdf",
    "import pdfplumber", "from pdfplumber",
    "import fitz", "from fitz",
    "import pdfminer", "from pdfminer",
    "import pymupdf", "from pymupdf",
]

ALLOWED_DIRS = {
    "llm": "engine/services",
    "pdf": "engine/parsers",
}


def check_invariant(patterns: list[str], allowed_dir: str) -> list[tuple]:
    violations = []
    root = Path(".")
    for py_file in root.rglob("*.py"):
        path_str = str(py_file).replace("\\", "/")
        if allowed_dir in path_str:
            continue
        if "test_" in py_file.name or py_file.name.endswith("_test.py"):
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pattern in patterns:
            if pattern in content:
                violations.append((py_file, pattern))
    return violations


def main():
    parser = argparse.ArgumentParser(description="엔진 불변식 검증")
    parser.add_argument("--check", choices=["llm", "pdf", "all"], default="all")
    args = parser.parse_args()

    exit_code = 0

    if args.check in ("llm", "all"):
        violations = check_invariant(LLM_PATTERNS, ALLOWED_DIRS["llm"])
        if violations:
            print("\n❌ [불변식 1 위반] LLM API 직접 호출 감지")
            print("   수정 방법: engine/services/llm_service 를 통해 호출하세요")
            print("   참고 문서: engine/docs/INTERFACE.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if args.check in ("pdf", "all"):
        violations = check_invariant(PDF_PATTERNS, ALLOWED_DIRS["pdf"])
        if violations:
            print("\n❌ [불변식 2 위반] PDF 파싱 라이브러리 직접 사용 감지")
            print("   수정 방법: engine/parsers/pdf_parser 를 통해 파싱하세요")
            print("   참고 문서: engine/docs/INTERFACE.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if exit_code == 0:
        print("✅ 엔진 불변식 검증 통과")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
