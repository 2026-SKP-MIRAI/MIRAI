#!/bin/bash
# secret-filter.sh 테스트 스크립트
# TDD: 구현 전에 먼저 작성

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/secret-filter.sh"

PASS=0
FAIL=0

assert_contains() {
    local desc="$1"
    local input="$2"
    local expected="$3"
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null)
    if echo "$output" | grep -q "$expected"; then
        echo "  PASS: $desc"
        ((PASS++))
    else
        echo "  FAIL: $desc"
        echo "        expected to contain: $expected"
        echo "        got: $output"
        ((FAIL++))
    fi
}

assert_empty() {
    local desc="$1"
    local input="$2"
    local output
    output=$(echo "$input" | bash "$HOOK" 2>/dev/null)
    if [[ -z "$output" ]]; then
        echo "  PASS: $desc"
        ((PASS++))
    else
        echo "  FAIL: $desc"
        echo "        expected empty output"
        echo "        got: $output"
        ((FAIL++))
    fi
}

assert_exit_0() {
    local desc="$1"
    local input="$2"
    echo "$input" | bash "$HOOK" > /dev/null 2>&1
    local code=$?
    if [[ $code -eq 0 ]]; then
        echo "  PASS: $desc"
        ((PASS++))
    else
        echo "  FAIL: $desc (exit code: $code)"
        ((FAIL++))
    fi
}

echo "=== secret-filter.sh 테스트 ==="
echo ""

echo "[1] 시크릿 탐지: additionalContext 포함 여부"
assert_contains \
    "OpenAI API Key (sk-proj-)" \
    '{"tool_name":"Bash","tool_response":"OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012mno345pqr"}' \
    "additionalContext"

assert_contains \
    "AWS Access Key (AKIA)" \
    '{"tool_name":"Bash","tool_response":"aws_access_key_id = AKIAIOSFODNN7EXAMPLE1234"}' \
    "additionalContext"

assert_contains \
    "GitHub PAT (ghp_)" \
    '{"tool_name":"Bash","tool_response":"token: ghp_abcdefghijklmnopqrstuvwxyz1234567890"}' \
    "additionalContext"

assert_contains \
    "Bearer Token" \
    '{"tool_name":"Bash","tool_response":"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"}' \
    "additionalContext"

assert_contains \
    "env var ANTHROPIC_API_KEY=..." \
    '{"tool_name":"Read","tool_response":"ANTHROPIC_API_KEY=sk-ant-api03-abcdefghijklmnopqrstuvwxyz"}' \
    "additionalContext"

echo ""
echo "[2] 정상 출력: 빈 출력 (false positive 없음)"
assert_empty \
    "일반 텍스트" \
    '{"tool_name":"Bash","tool_response":"Hello, World!"}'

assert_empty \
    "빈 tool_response" \
    '{"tool_name":"Bash","tool_response":""}'

assert_empty \
    "짧은 토큰 (길이 미달)" \
    '{"tool_name":"Bash","tool_response":"token=short"}'

assert_empty \
    "JSON 없는 입력" \
    '{}'

echo ""
echo "[3] 항상 exit 0"
assert_exit_0 \
    "시크릿 탐지 시 exit 0" \
    '{"tool_name":"Bash","tool_response":"OPENAI_API_KEY=sk-proj-abc123def456ghi789jkl012"}'

assert_exit_0 \
    "정상 출력 시 exit 0" \
    '{"tool_name":"Bash","tool_response":"Hello World"}'

assert_exit_0 \
    "잘못된 JSON 시 exit 0" \
    'not-json-at-all'

echo ""
echo "================================"
echo "결과: PASS=$PASS, FAIL=$FAIL"
if [[ $FAIL -eq 0 ]]; then
    echo "ALL PASS"
    exit 0
else
    exit 1
fi
