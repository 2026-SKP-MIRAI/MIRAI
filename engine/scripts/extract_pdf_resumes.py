#!/usr/bin/env python3
"""
합격 자소서 PDF → JSON 변환기
==============================
PDF 파일명 패턴: {id}_{company}_{job_role}.pdf
  예) 23969_서울우유협동조합_연구개발.pdf
      → job_role: "연구개발", source: "서울우유협동조합"

사용법:
  python engine/scripts/extract_pdf_resumes.py \\
    --input-dir "D:/path/to/pdfs" \\
    --output data/accepted_resumes.json

출력 형식 (build_resume_index.py 입력과 동일):
  [{"job_role": "백엔드", "content": "...", "source": "회사명"}, ...]
"""

import argparse
import json
import sys
from pathlib import Path

import pypdf


def parse_filename(stem: str) -> tuple[str, str]:
    """
    파일명 stem에서 (job_role, source) 추출.
    패턴: {id}_{company}_{job_role}
    언더스코어가 2개 미만이면 ("unknown", stem) 반환.
    """
    parts = stem.split("_", 2)
    if len(parts) < 3:
        return "unknown", stem
    job_role = parts[2].strip()
    source = parts[1].strip()
    return job_role, source


def extract_text(pdf_path: Path) -> str:
    """pypdf로 PDF 텍스트 추출. 실패 시 빈 문자열 반환."""
    try:
        reader = pypdf.PdfReader(str(pdf_path))
        pages = []
        for page in reader.pages:
            text = page.extract_text() or ""
            pages.append(text.strip())
        return "\n".join(p for p in pages if p)
    except Exception as e:
        print(f"  [경고] {pdf_path.name}: 텍스트 추출 실패 — {e}", file=sys.stderr)
        return ""


def main():
    parser = argparse.ArgumentParser(
        description="합격 자소서 PDF → JSON 변환"
    )
    parser.add_argument(
        "--input-dir",
        required=True,
        help="PDF 파일이 있는 디렉토리 경로",
    )
    parser.add_argument(
        "--output",
        default="data/accepted_resumes.json",
        help="출력 JSON 파일 경로 (기본값: data/accepted_resumes.json)",
    )
    parser.add_argument(
        "--min-chars",
        type=int,
        default=100,
        help="최소 텍스트 길이 (기본값: 100자, 미달 시 건너뜀)",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    output_path = Path(args.output)

    if not input_dir.exists():
        print(f"[오류] 디렉토리 없음: {input_dir}", file=sys.stderr)
        sys.exit(1)

    pdf_files = sorted(input_dir.glob("*.pdf"))
    total = len(pdf_files)
    print(f"[로드] PDF 파일 {total}개 발견")

    output_path.parent.mkdir(parents=True, exist_ok=True)

    results = []
    skipped = 0

    for i, pdf_path in enumerate(pdf_files, 1):
        if i % 100 == 0 or i == total:
            print(f"  진행: {i}/{total} ({len(results)}개 추출, {skipped}개 건너뜀)")

        job_role, source = parse_filename(pdf_path.stem)
        content = extract_text(pdf_path)

        if len(content) < args.min_chars:
            skipped += 1
            continue

        results.append({
            "job_role": job_role,
            "content": content,
            "source": source,
        })

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"\n완료: {len(results)}개 레코드 → {output_path}")
    print(f"건너뜀: {skipped}개 (텍스트 {args.min_chars}자 미만)")


if __name__ == "__main__":
    main()
