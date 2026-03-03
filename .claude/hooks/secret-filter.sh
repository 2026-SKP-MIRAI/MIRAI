#!/bin/bash
# secret-filter.sh - PostToolUse 시크릿 필터 훅
#
# 도구 실행 결과(tool_response)에서 API 키·토큰·패스워드 등을 탐지하여
# Claude에게 경고를 전달하고 보안 로그에 기록한다.
#
# 참고: claude-forge output-secret-filter.sh
# 변경: OPENCLAW 가드 제거, tool_result→tool_response, 출력 형식 Claude Code 공식 JSON
#
# Hook event: PostToolUse
# Exit code: 항상 0 (차단 불가 이벤트)

# Python3 없으면 graceful exit
if ! command -v python3 &>/dev/null; then
    exit 0
fi

INPUT=$(cat)

export _FILTER_INPUT="$INPUT"
export _SECURITY_LOG="$HOME/.claude/security.log"

python3 << 'FILTER_SCRIPT'
import os
import sys
import json
import re
from datetime import datetime

input_json = os.environ.get("_FILTER_INPUT", "")
security_log = os.environ.get("_SECURITY_LOG", "")

if not input_json:
    sys.exit(0)

try:
    data = json.loads(input_json)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)

# tool_response에서 텍스트 추출 (Claude Code 공식 필드명)
tool_response = data.get("tool_response", "")
if isinstance(tool_response, dict):
    tool_response = json.dumps(tool_response, ensure_ascii=False)
elif not isinstance(tool_response, str):
    tool_response = str(tool_response)

if not tool_response:
    sys.exit(0)

# 시크릿 패턴 정의 (패턴, 설명)
SECRET_PATTERNS = [
    # API 키
    (r'\bsk-proj-[a-zA-Z0-9_-]{20,}\b', "OpenAI Project Key"),
    (r'\bsk-[a-zA-Z0-9_-]{20,}\b', "OpenAI API Key"),
    (r'\bAKIA[A-Z0-9]{16,}\b', "AWS Access Key"),
    (r'\bxoxb-[a-zA-Z0-9-]{20,}\b', "Slack Bot Token"),
    (r'\bxoxp-[a-zA-Z0-9-]{20,}\b', "Slack User Token"),
    (r'\bghp_[a-zA-Z0-9]{36,}\b', "GitHub PAT"),
    (r'\bghs_[a-zA-Z0-9]{36,}\b', "GitHub App Token"),
    (r'\bgho_[a-zA-Z0-9]{36,}\b', "GitHub OAuth Token"),
    (r'\bghu_[a-zA-Z0-9]{36,}\b', "GitHub User Token"),
    (r'\bglpat-[a-zA-Z0-9_-]{20,}\b', "GitLab PAT"),
    (r'\bnpm_[a-zA-Z0-9]{36,}\b', "NPM Token"),

    # Bearer/Auth 토큰
    (r'(?i)\bBearer\s+[a-zA-Z0-9_.\-]{20,}\b', "Bearer Token"),
    (r'(?i)\btoken=[a-zA-Z0-9_.\-]{20,}\b', "Token Parameter"),
    (r'(?i)\bapi[_-]?key=[a-zA-Z0-9_.\-]{20,}\b', "API Key Parameter"),

    # 비밀번호/시크릿
    (r'(?i)\bpassword=[^\s&]{8,}\b', "Password Parameter"),
    (r'(?i)\bpasswd=[^\s&]{8,}\b', "Password Parameter"),
    (r'(?i)\bsecret=[^\s&]{20,}\b', "Secret Parameter"),

    # 환경변수 값
    (r'(?i)\bAWS_SECRET_ACCESS_KEY=[^\s]{20,}\b', "AWS Secret Key"),
    (r'(?i)\bOPENAI_API_KEY=[^\s]{20,}\b', "OpenAI Key Value"),
    (r'(?i)\bANTHROPIC_API_KEY=[^\s]{20,}\b', "Anthropic Key Value"),
    (r'(?i)\bTELEGRAM_BOT_TOKEN=[^\s]{20,}\b', "Telegram Token Value"),
    (r'(?i)\bGITHUB_TOKEN=[^\s]{20,}\b', "GitHub Token Value"),
    (r'(?i)\bSUPABASE_SERVICE_ROLE_KEY=[^\s]{20,}\b', "Supabase Key Value"),
    (r'(?i)\bDATABASE_URL=[^\s]{20,}\b', "Database URL Value"),

    # Private Key 블록
    (r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----', "Private Key"),

    # 긴 Base64 형태의 잠재적 시크릿
    (r'(?i)(?:key|secret|token|password|credential|auth)[\s=:]+["\']?[a-zA-Z0-9+/]{40,}={0,2}["\']?', "Potential Base64 Secret"),
]

import base64
import urllib.parse

def decode_layers(text):
    """base64, URL 인코딩 디코딩으로 숨겨진 시크릿 탐지"""
    decoded_variants = []
    b64_pattern = re.compile(r'[A-Za-z0-9+/]{20,}={0,2}')
    for m in b64_pattern.finditer(text):
        try:
            decoded = base64.b64decode(m.group(0), validate=True).decode("utf-8", errors="ignore")
            if decoded and len(decoded) >= 10:
                decoded_variants.append(decoded)
        except Exception:
            pass
    try:
        url_decoded = urllib.parse.unquote(text)
        if url_decoded != text:
            decoded_variants.append(url_decoded)
    except Exception:
        pass
    return decoded_variants

detected_count = 0
detected_types = []

# 1단계: 직접 패턴 매칭
for pattern, desc in SECRET_PATTERNS:
    if re.search(pattern, tool_response):
        detected_count += 1
        if desc not in detected_types:
            detected_types.append(desc)

# 2단계: 인코딩 우회 탐지
decoded_variants = decode_layers(tool_response)
for decoded_text in decoded_variants:
    for pattern, desc in SECRET_PATTERNS:
        if re.search(pattern, decoded_text):
            detected_count += 1
            if desc not in detected_types:
                detected_types.append(desc)

if detected_count > 0:
    tool_name = data.get("tool_name", "unknown")
    types_str = ", ".join(detected_types)

    # Claude에게 경고 전달
    output = {
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": (
                f"⚠️ SECRET DETECTED in tool_response: potential secrets found "
                f"(types: {types_str}, count: {detected_count}). "
                f"Logged to ~/.claude/security.log. "
                f"Do NOT expose or repeat these values."
            )
        }
    }
    print(json.dumps(output, ensure_ascii=False))

    # 보안 로그 기록 (실제 값은 기록하지 않음)
    if security_log:
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            session_id = data.get("session_id", "unknown")
            log_entry = (
                f"{timestamp} | SECRET_DETECTED | tool={tool_name} | "
                f"count={detected_count} | types={types_str} | "
                f"session={session_id}\n"
            )
            os.makedirs(os.path.dirname(security_log), exist_ok=True)
            with open(security_log, "a") as f:
                f.write(log_entry)
        except (IOError, OSError):
            pass

sys.exit(0)
FILTER_SCRIPT
