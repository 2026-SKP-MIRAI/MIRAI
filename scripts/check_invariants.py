#!/usr/bin/env python3
"""
엔진 불변식 검증 스크립트
위반 시 수정 방법을 메시지에 직접 포함 — 에이전트가 스스로 수정 가능하도록

사용법:
  python scripts/check_invariants.py --check all
  python scripts/check_invariants.py --check llm
  python scripts/check_invariants.py --check pdf
  python scripts/check_invariants.py --check ts-llm
  python scripts/check_invariants.py --check auth
"""

import sys
import argparse
from pathlib import Path

# 불변식 2: LLM 패턴 — engine/app/services/ 밖의 Python 파일에서 위반
LLM_PATTERNS = [
    "import openai", "from openai",
    "import anthropic", "from anthropic",
    "import litellm", "from litellm",
    "import langchain", "from langchain",
    "ChatOpenAI", "ChatAnthropic",
]

# 불변식 2: LLM 패턴 — services/**/*.ts(x) 파일에서 위반 (TS 서비스에서 LLM 직접 호출)
TS_LLM_PATTERNS = [
    '@anthropic-ai/',
    'from "openai"', "from 'openai'",
    'require("openai")', "require('openai')",
    'from "langchain', "from 'langchain",
    'from "litellm"', "from 'litellm'",
]

# 불변식 2: PDF 패턴 — engine/app/parsers/ 밖에 있으면 위반
PDF_PATTERNS = [
    "import pypdf", "from pypdf",
    "import pdfplumber", "from pdfplumber",
    "import fitz", "from fitz",
    "import pdfminer", "from pdfminer",
    "import pymupdf", "from pymupdf",
]

# 불변식 1: 인증 패턴 — engine/ 안에 있으면 위반 (인증은 서비스에서만)
AUTH_PATTERNS = [
    "better-auth", "next-auth",
    "better_auth", "next_auth",
    "jwt.encode", "jwt.decode",
    "import jwt", "from jwt",
    "set_cookie", "get_cookie",
    "session_token", "access_token",
    "verify_token", "create_token",
    # Supabase Auth 패턴 (Better Auth → Supabase Auth 전환 후 엔진 유입 감지)
    "@supabase/auth", "supabase_auth", "supabase.auth",
    "from supabase", "import supabase",
    "createClient", "create_client",
]

ALLOWED_DIRS = {
    "llm": "engine/app/services",
    "pdf": "engine/app/parsers",
}

# 검사 제외 경로 (문자열 포함 여부로 판단)
EXCLUDED_PATHS = [
    ".worktree/",
    ".claude/",
    "scripts/",
]

# 테스트 파일 제외 이름 목록
EXCLUDED_FILENAMES = {"conftest.py"}


def _is_excluded(path_str: str, filename: str) -> bool:
    if filename in EXCLUDED_FILENAMES:
        return True
    return any(excl in path_str for excl in EXCLUDED_PATHS)


def check_python_invariant(patterns: list[str], allowed_dir: str) -> list[tuple]:
    violations = []
    root = Path(".")
    for py_file in root.rglob("*.py"):
        path_str = str(py_file).replace("\\", "/")
        if allowed_dir in path_str:
            continue
        if "test_" in py_file.name or py_file.name.endswith("_test.py"):
            continue
        if _is_excluded(path_str, py_file.name):
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pattern in patterns:
            if pattern in content:
                violations.append((py_file, pattern))
    return violations


def check_ts_llm_invariant() -> list[tuple]:
    """services/ 하위 TS/TSX 파일에서 LLM 직접 호출 감지"""
    violations = []
    services_dir = Path("services")
    if not services_dir.exists():
        return violations
    for ts_file in list(services_dir.rglob("*.ts")) + list(services_dir.rglob("*.tsx")):
        path_str = str(ts_file).replace("\\", "/")
        if "node_modules" in path_str or ".worktree/" in path_str:
            continue
        if ".test." in ts_file.name or ".spec." in ts_file.name:
            continue
        try:
            content = ts_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pattern in TS_LLM_PATTERNS:
            if pattern in content:
                violations.append((ts_file, pattern))
    return violations


def check_engine_auth_invariant() -> list[tuple]:
    """engine/ 하위 Python 파일에서 인증 코드 감지 (worktree 제외)"""
    violations = []
    engine_dir = Path("engine")
    if not engine_dir.exists():
        return violations
    for py_file in engine_dir.rglob("*.py"):
        path_str = str(py_file).replace("\\", "/")
        if ".worktree/" in path_str:
            continue
        if "test_" in py_file.name or py_file.name.endswith("_test.py"):
            continue
        if py_file.name in EXCLUDED_FILENAMES:
            continue
        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        for pattern in AUTH_PATTERNS:
            if pattern in content:
                violations.append((py_file, pattern))
    return violations


def main():
    parser = argparse.ArgumentParser(description="엔진 불변식 검증")
    parser.add_argument(
        "--check",
        choices=["llm", "pdf", "ts-llm", "auth", "all"],
        default="all",
    )
    args = parser.parse_args()

    exit_code = 0

    if args.check in ("llm", "all"):
        violations = check_python_invariant(LLM_PATTERNS, ALLOWED_DIRS["llm"])
        if violations:
            print("\n❌ [불변식 2 위반] Python — LLM API 직접 호출 감지")
            print("   수정 방법: engine/app/services/llm_service 를 통해 호출하세요")
            print("   참고 문서: engine/.ai.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if args.check in ("pdf", "all"):
        violations = check_python_invariant(PDF_PATTERNS, ALLOWED_DIRS["pdf"])
        if violations:
            print("\n❌ [불변식 2 위반] Python — PDF 파싱 라이브러리 직접 사용 감지")
            print("   수정 방법: engine/app/parsers/pdf_parser 를 통해 파싱하세요")
            print("   참고 문서: engine/.ai.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if args.check in ("ts-llm", "all"):
        violations = check_ts_llm_invariant()
        if violations:
            print("\n❌ [불변식 2 위반] TypeScript — LLM API 직접 호출 감지")
            print("   수정 방법: services/ 에서 LLM을 직접 호출하지 마세요.")
            print("   엔진 POST /api/resume/questions 를 HTTP로 호출하세요.")
            print("   참고 문서: engine/.ai.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if args.check in ("auth", "all"):
        violations = check_engine_auth_invariant()
        if violations:
            print("\n❌ [불변식 1 위반] engine/ 에 인증 코드 감지")
            print("   수정 방법: 인증 로직은 services/(Next.js) 에서만 구현하세요.")
            print("   엔진은 내부 호출만 수신해야 합니다.")
            print("   참고 문서: engine/.ai.md\n")
            for file, pattern in violations:
                print(f"   - {file}  (패턴: {pattern!r})")
            exit_code = 1

    if exit_code == 0:
        print("✅ 엔진 불변식 검증 통과")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
