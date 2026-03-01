# Claude Code Infrastructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** showcase 레포에서 선별한 hooks(skill-activation-prompt, post-tool-use-tracker), 10개 네이티브 agents, skill-rules.json을 MIRAI 프로젝트에 적용한다.

**Architecture:** `.claude/hooks/`에 TypeScript 기반 훅 2개를 설치하고, `.claude/agents/`에 10개 네이티브 에이전트 마크다운을 배치한다. `settings.local.json`에 훅을 등록해 UserPromptSubmit/PostToolUse 이벤트에 연결한다.

**Tech Stack:** bash, TypeScript(tsx), Node.js, jq

---

### Task 1: 디렉토리 구조 생성

**Files:**
- Create: `.claude/hooks/` (디렉토리)
- Create: `.claude/agents/` (디렉토리)
- Create: `.claude/skills/` (디렉토리)

**Step 1: 디렉토리 생성**

```bash
mkdir -p /home/dev_00/sharedfolder/MIRAI/.claude/hooks
mkdir -p /home/dev_00/sharedfolder/MIRAI/.claude/agents
mkdir -p /home/dev_00/sharedfolder/MIRAI/.claude/skills
```

**Step 2: 생성 확인**

```bash
ls /home/dev_00/sharedfolder/MIRAI/.claude/
```
Expected: `agents  hooks  settings.local.json  skills`

**Step 3: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/
git commit -m "chore: create claude infrastructure directories"
```

---

### Task 2: hooks/package.json + tsconfig.json 생성

**Files:**
- Create: `.claude/hooks/package.json`
- Create: `.claude/hooks/tsconfig.json`

**Step 1: package.json 작성**

```json
{
    "name": "claude-hooks",
    "version": "1.0.0",
    "description": "TypeScript hooks for Claude Code skill auto-activation",
    "private": true,
    "type": "module",
    "scripts": {
        "check": "tsc --noEmit"
    },
    "dependencies": {
        "@types/node": "^20.11.0",
        "tsx": "^4.7.0",
        "typescript": "^5.3.3"
    }
}
```

**Step 2: tsconfig.json 작성**

```json
{
    "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022"],
        "outDir": "./dist",
        "rootDir": ".",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "allowSyntheticDefaultImports": true,
        "types": ["node"]
    },
    "include": ["*.ts"],
    "exclude": ["node_modules", "dist"]
}
```

**Step 3: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/hooks/package.json .claude/hooks/tsconfig.json
git commit -m "chore: add hooks typescript config"
```

---

### Task 3: skill-activation-prompt 훅 설치

**Files:**
- Create: `.claude/hooks/skill-activation-prompt.sh`
- Create: `.claude/hooks/skill-activation-prompt.ts`

**Step 1: skill-activation-prompt.sh 작성**

```bash
#!/bin/bash
set -e

cd "$CLAUDE_PROJECT_DIR/.claude/hooks"
cat | npx tsx skill-activation-prompt.ts
```

**Step 2: skill-activation-prompt.ts 작성**

아래 내용 그대로 복사 (showcase에서 가져온 원본):

```typescript
#!/usr/bin/env node
import { readFileSync } from 'fs';
import { join } from 'path';

interface HookInput {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode: string;
    prompt: string;
}

interface PromptTriggers {
    keywords?: string[];
    intentPatterns?: string[];
}

interface SkillRule {
    type: 'guardrail' | 'domain';
    enforcement: 'block' | 'suggest' | 'warn';
    priority: 'critical' | 'high' | 'medium' | 'low';
    promptTriggers?: PromptTriggers;
}

interface SkillRules {
    version: string;
    skills: Record<string, SkillRule>;
}

interface MatchedSkill {
    name: string;
    matchType: 'keyword' | 'intent';
    config: SkillRule;
}

async function main() {
    try {
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);
        const prompt = data.prompt.toLowerCase();

        const projectDir = process.env.CLAUDE_PROJECT_DIR || '$HOME/project';
        const rulesPath = join(projectDir, '.claude', 'skills', 'skill-rules.json');
        const rules: SkillRules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

        const matchedSkills: MatchedSkill[] = [];

        for (const [skillName, config] of Object.entries(rules.skills)) {
            const triggers = config.promptTriggers;
            if (!triggers) continue;

            if (triggers.keywords) {
                const keywordMatch = triggers.keywords.some(kw =>
                    prompt.includes(kw.toLowerCase())
                );
                if (keywordMatch) {
                    matchedSkills.push({ name: skillName, matchType: 'keyword', config });
                    continue;
                }
            }

            if (triggers.intentPatterns) {
                const intentMatch = triggers.intentPatterns.some(pattern => {
                    const regex = new RegExp(pattern, 'i');
                    return regex.test(prompt);
                });
                if (intentMatch) {
                    matchedSkills.push({ name: skillName, matchType: 'intent', config });
                }
            }
        }

        if (matchedSkills.length > 0) {
            let output = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            output += '🎯 SKILL ACTIVATION CHECK\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

            const critical = matchedSkills.filter(s => s.config.priority === 'critical');
            const high = matchedSkills.filter(s => s.config.priority === 'high');
            const medium = matchedSkills.filter(s => s.config.priority === 'medium');
            const low = matchedSkills.filter(s => s.config.priority === 'low');

            if (critical.length > 0) {
                output += '⚠️ CRITICAL SKILLS (REQUIRED):\n';
                critical.forEach(s => output += `  → ${s.name}\n`);
                output += '\n';
            }
            if (high.length > 0) {
                output += '📚 RECOMMENDED SKILLS:\n';
                high.forEach(s => output += `  → ${s.name}\n`);
                output += '\n';
            }
            if (medium.length > 0) {
                output += '💡 SUGGESTED SKILLS:\n';
                medium.forEach(s => output += `  → ${s.name}\n`);
                output += '\n';
            }
            if (low.length > 0) {
                output += '📌 OPTIONAL SKILLS:\n';
                low.forEach(s => output += `  → ${s.name}\n`);
                output += '\n';
            }

            output += 'ACTION: Use Skill tool BEFORE responding\n';
            output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
            console.log(output);
        }

        process.exit(0);
    } catch (err) {
        console.error('Error in skill-activation-prompt hook:', err);
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Uncaught error:', err);
    process.exit(1);
});
```

**Step 3: 실행 권한 부여**

```bash
chmod +x /home/dev_00/sharedfolder/MIRAI/.claude/hooks/skill-activation-prompt.sh
```

**Step 4: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/hooks/skill-activation-prompt.sh .claude/hooks/skill-activation-prompt.ts
git commit -m "feat: add skill-activation-prompt hook"
```

---

### Task 4: post-tool-use-tracker 훅 설치

**Files:**
- Create: `.claude/hooks/post-tool-use-tracker.sh`

**Step 1: post-tool-use-tracker.sh 작성**

showcase 원본 그대로 복사. 내용:
- stdin에서 tool_name, file_path, session_id 추출
- Edit/MultiEdit/Write 도구이고 .md가 아닌 파일만 처리
- `.claude/tsc-cache/{session_id}/edited-files.log`에 기록
- affected-repos.txt, commands.txt 업데이트

(전체 내용은 showcase `.claude/hooks/post-tool-use-tracker.sh` 참고)

**Step 2: 실행 권한 부여**

```bash
chmod +x /home/dev_00/sharedfolder/MIRAI/.claude/hooks/post-tool-use-tracker.sh
```

**Step 3: jq 설치 확인**

```bash
jq --version
```
없으면: `sudo apt-get install -y jq`

**Step 4: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/hooks/post-tool-use-tracker.sh
git commit -m "feat: add post-tool-use-tracker hook"
```

---

### Task 5: npm install

**Files:**
- Create: `.claude/hooks/node_modules/` (자동 생성)

**Step 1: 의존성 설치**

```bash
cd /home/dev_00/sharedfolder/MIRAI/.claude/hooks
npm install
```
Expected: `added N packages`

**Step 2: .gitignore에 node_modules 추가**

`.gitignore`에 없으면 추가:
```
.claude/hooks/node_modules/
.claude/tsc-cache/
```

**Step 3: tsx 동작 확인**

```bash
cd /home/dev_00/sharedfolder/MIRAI/.claude/hooks
echo '{"session_id":"test","transcript_path":"","cwd":"/tmp","permission_mode":"default","prompt":"test"}' | npx tsx skill-activation-prompt.ts
```
Expected: 에러 없이 종료 (skill-rules.json이 없어서 에러날 수 있음 - Task 6에서 해결)

**Step 4: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .gitignore
git commit -m "chore: install hook dependencies, update gitignore"
```

---

### Task 6: skill-rules.json 생성 (빈 룰셋)

**Files:**
- Create: `.claude/skills/skill-rules.json`

**Step 1: 빈 룰셋으로 생성**

```json
{
  "version": "1.0.0",
  "skills": {}
}
```

**Step 2: 훅 동작 재확인**

```bash
cd /home/dev_00/sharedfolder/MIRAI/.claude/hooks
echo '{"session_id":"test","transcript_path":"","cwd":"/tmp","permission_mode":"default","prompt":"test"}' | npx tsx skill-activation-prompt.ts
```
Expected: 출력 없이 정상 종료

**Step 3: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/skills/skill-rules.json
git commit -m "feat: add empty skill-rules.json for MIRAI"
```

---

### Task 7: settings.local.json에 hooks 등록

**Files:**
- Modify: `.claude/settings.local.json`

**Step 1: 현재 settings.local.json 읽기**

현재 내용:
```json
{
  "permissions": {
    "allow": [
      "Bash(code:*)",
      "Bash(echo 파일 없음:*)",
      "Bash(echo 없음:*)",
      "Bash(python3:*)",
      "Bash(claude mcp:*)"
    ]
  },
  "mcpServers": {
    "notion": { ... }
  }
}
```

**Step 2: hooks 섹션 추가**

```json
{
  "permissions": {
    "allow": [
      "Bash(code:*)",
      "Bash(echo 파일 없음:*)",
      "Bash(echo 없음:*)",
      "Bash(python3:*)",
      "Bash(claude mcp:*)",
      "Bash(npx tsx:*)",
      "Bash(jq:*)"
    ]
  },
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/skill-activation-prompt.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/post-tool-use-tracker.sh"
          }
        ]
      }
    ]
  }
}
```

**Step 3: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/settings.local.json
git commit -m "feat: register skill-activation and post-tool-use hooks"
```

---

### Task 8: 10개 에이전트 파일 설치

**Files:**
- Create: `.claude/agents/` 아래 10개 마크다운 파일

showcase GitHub에서 각 파일 다운로드:

```bash
BASE="https://raw.githubusercontent.com/diet103/claude-code-infrastructure-showcase/main/.claude/agents"
DEST="/home/dev_00/sharedfolder/MIRAI/.claude/agents"

for agent in \
  "auth-route-debugger.md" \
  "auth-route-tester.md" \
  "auto-error-resolver.md" \
  "code-architecture-reviewer.md" \
  "code-refactor-master.md" \
  "documentation-architect.md" \
  "frontend-error-fixer.md" \
  "plan-reviewer.md" \
  "refactor-planner.md" \
  "web-research-specialist.md"; do
  curl -sSL "$BASE/$agent" -o "$DEST/$agent"
  echo "Downloaded: $agent"
done
```

**Step 2: 파일 확인**

```bash
ls /home/dev_00/sharedfolder/MIRAI/.claude/agents/
```
Expected: 10개 .md 파일

**Step 3: Commit**

```bash
cd /home/dev_00/sharedfolder/MIRAI
git add .claude/agents/
git commit -m "feat: add 10 native agents from showcase"
```

---

### Task 9: 전체 동작 검증

**Step 1: 새 Claude Code 세션 시작 후 확인**

새 세션에서 UserPromptSubmit 훅 동작 확인:
- 프롬프트 입력 시 hooks 폴더에서 `skill-activation-prompt.sh` 실행되는지 확인
- 에러 메시지 없는지 확인

**Step 2: agents 접근 확인**

Claude Code에서:
```
/agents
```
Expected: 10개 에이전트 목록 표시

**Step 3: post-tool-use-tracker 동작 확인**

파일 수정 후 `.claude/tsc-cache/` 폴더에 로그 생성되는지 확인:
```bash
ls /home/dev_00/sharedfolder/MIRAI/.claude/tsc-cache/
```

---

## 향후 작업 (기술 스택 확정 후)

- `skill-rules.json`에 MIRAI 전용 트리거 룰 추가
- agents의 blog 도메인 예제를 MIRAI 도메인으로 교체
- 기술 스택에 맞는 프로젝트 특화 skills 추가
