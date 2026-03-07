#!/usr/bin/env python3
"""
금지 파일 형식 커밋 차단
*.pdf, *.csv, *.pkl, *.parquet 는 커밋 금지 (레포 규칙 2번)
"""

import subprocess
import sys

FORBIDDEN_EXTENSIONS = (".pdf", ".csv", ".pkl", ".parquet")

result = subprocess.run(
    ["git", "diff", "--cached", "--name-only"],
    capture_output=True,
    text=True,
)

violations = [
    f for f in result.stdout.splitlines()
    if f.lower().endswith(FORBIDDEN_EXTENSIONS)
]

if violations:
    print("\n❌ [레포 규칙 위반] 금지 파일 형식 커밋 감지")
    print("   수정 방법: git reset HEAD <파일> 로 스테이징을 취소하세요")
    print("   규칙: *.pdf, *.csv, *.pkl, *.parquet 는 커밋 금지\n")
    for f in violations:
        print(f"   - {f}")
    sys.exit(1)

print("✅ 금지 파일 형식 검사 통과")
