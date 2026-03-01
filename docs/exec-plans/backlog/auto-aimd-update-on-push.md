# 백로그: git push 전 ai.md 자동 업데이트 훅

> 등록: 2026-03-01 / 우선순위: 중
> 연계: `precommit-hooks-plan.md` (pre-commit 훅 계획과 함께 구현 검토)

## 목적

Claude가 `git push`를 실행하기 전에 변경된 디렉토리의 `ai.md`를 자동으로 업데이트하도록 강제한다.

## 구현 방법 (설계 완료)

레이어 2개로 구성:

```
레이어 1: PreToolUse:Bash 훅 (Claude에게 알림)
  → Claude가 "git push" 실행 시도
  → 훅 스크립트가 변경 디렉토리 분석
  → 스테이지되지 않은 ai.md 목록을 Claude 컨텍스트에 주입
  → Claude가 ai.md 업데이트 → 커밋 → push 재실행

레이어 2: git pre-push hook (기계적 안전망)
  → Claude가 놓쳤을 때 push 자체를 차단
```

## 구현 파일 3개

### ① `~/.claude/hooks/pre-push-aimd-check.sh`

```bash
#!/bin/bash
# stdin에서 tool_input.command 추출, git push면 ai.md 점검
input=$(cat)
cmd=$(echo "$input" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null)

echo "$cmd" | grep -qE "git push" || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -z "$branch" ] && exit 0

changed_dirs=$(git diff origin/$branch..HEAD --name-only 2>/dev/null \
  | grep -v 'ai\.md$' \
  | xargs -I{} dirname {} 2>/dev/null \
  | sort -u | grep -v '^\.')

needs=()
for dir in $changed_dirs; do
  [ -f "$dir/ai.md" ] || continue
  git diff origin/$branch..HEAD --name-only 2>/dev/null \
    | grep -q "^$dir/ai.md$" && continue
  needs+=("$dir/ai.md")
done

[ ${#needs[@]} -eq 0 ] && exit 0

echo "⚠️  git push 전 ai.md 업데이트 필요:"
for f in "${needs[@]}"; do echo "  - $f"; done
echo "위 파일 업데이트 후 커밋하고 push를 재실행하세요."
```

### ② `~/.claude/settings.json` — PreToolUse 훅 추가

기존 `hooks` 객체에 추가:

```json
"PreToolUse": [
  {
    "matcher": "Bash",
    "hooks": [
      {
        "type": "command",
        "command": "$HOME/.claude/hooks/pre-push-aimd-check.sh"
      }
    ]
  }
]
```

### ③ `.git/hooks/pre-push` (기계적 안전망)

```bash
#!/bin/bash
branch=$(git rev-parse --abbrev-ref HEAD)
changed_dirs=$(git diff origin/$branch..HEAD --name-only \
  | grep -v 'ai\.md$' | xargs -I{} dirname {} | sort -u | grep -v '^\.')

needs=()
for dir in $changed_dirs; do
  [ -f "$dir/ai.md" ] || continue
  git diff origin/$branch..HEAD --name-only | grep -q "^$dir/ai.md$" && continue
  needs+=("$dir/ai.md")
done

[ ${#needs[@]} -eq 0 ] && exit 0

echo "❌ Push 차단: ai.md 미업데이트 디렉토리:"
for f in "${needs[@]}"; do echo "  - $f"; done
exit 1
```

## 동작 흐름 (구현 후)

```
Claude: git push 실행
→ PreToolUse 훅 실행
→ "⚠️ docs/background/ai.md 업데이트 필요" 컨텍스트 주입
→ Claude가 메시지 확인 → ai.md 업데이트 → git add + commit
→ git push 재실행 → 훅 통과 → push 성공
```

## 인수 조건 (AC)

- [ ] Claude가 `git push`를 실행하면 변경된 디렉토리의 미업데이트 `ai.md` 목록이 컨텍스트에 표시된다
- [ ] ai.md가 모두 최신 상태면 훅이 아무 메시지 없이 통과한다
- [ ] `git push`가 아닌 bash 명령에서는 훅이 아무 동작도 하지 않는다
- [ ] `.git/hooks/pre-push`가 동일 조건으로 push를 차단한다
