# [#10] 시크릿 필터 보안 훅 도입 — 구현 계획

> 작성: 2026-03-03
> 상세 플랜: `.omc/plans/000010-secret-filter-hook.md`

---

## 완료 기준

- [ ] PostToolUse 훅으로 시크릿 필터 구현 (API 키, 토큰, 패스워드 등 출력 시 경고)
- [ ] claude-forge의 `output-secret-filter.sh` 참고하되 MIRAI 환경에 맞게 커스터마이징
- [ ] `.claude/settings.json`에 훅 등록 완료

---

## 구현 계획

### 작업 파일

| 파일 | 작업 |
|------|------|
| `.claude/hooks/secret-filter.sh` | 신규 생성 — 시크릿 탐지 훅 |
| `.claude/hooks/.ai.md` | 신규 생성 — 디렉토리 메타데이터 |
| `.claude/settings.json` | 수정 — PostToolUse 훅 등록 |

### 주요 설계 결정

1. **훅 이벤트**: `PostToolUse` — 모든 도구 실행 후 `tool_response` 검사
2. **입력 필드**: `tool_response` (Claude Code 공식 필드명)
3. **출력 방식**: `hookSpecificOutput.additionalContext` JSON으로 Claude에게 경고
4. **탐지 패턴**: OpenAI/AWS/GitHub/Slack/GitLab 키, Bearer 토큰, env var 값, Private Key
5. **인코딩 우회 탐지**: base64 및 URL 인코딩 디코딩 후 재검사
6. **보안 로그**: `~/.claude/security.log` (실제 값 기록 안 함)
7. **OPENCLAW 가드 제거**: MIRAI는 로컬 환경, 항상 실행

### 구현 순서

1. `.claude/hooks/` 디렉토리 생성
2. `secret-filter.sh` 작성 (Bash + Python3 heredoc)
3. `chmod +x .claude/hooks/secret-filter.sh`
4. `.claude/settings.json` 수정 — hooks 섹션 추가
5. `.claude/hooks/.ai.md` 작성
6. 수동 테스트 (시크릿 포함/미포함 케이스)

### 검증

```bash
# 시크릿 탐지 테스트
echo '{"tool_name":"Bash","tool_response":"OPENAI_API_KEY=sk-proj-abc123def456ghi789"}' \
  | .claude/hooks/secret-filter.sh

# 정상 출력 테스트 (false positive 없음)
echo '{"tool_name":"Bash","tool_response":"Hello World"}' \
  | .claude/hooks/secret-filter.sh
```
