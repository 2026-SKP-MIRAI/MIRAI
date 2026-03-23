#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface HookInput {
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
    description?: string;
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

function findRulesPath(): string | null {
    const projectDir = process.env.CLAUDE_PROJECT_DIR;
    if (projectDir) {
        const p = join(projectDir, '.claude', 'skills', 'skill-rules.json');
        if (existsSync(p)) return p;
    }

    const cwdPath = join(process.cwd(), '..', 'skills', 'skill-rules.json');
    if (existsSync(cwdPath)) return cwdPath;

    return null;
}

function sortPriority(matches: MatchedSkill[]): MatchedSkill[] {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...matches].sort((a, b) => rank[a.config.priority] - rank[b.config.priority]);
}

async function main() {
    try {
        const input = readFileSync(0, 'utf-8');
        const data: HookInput = JSON.parse(input);
        const prompt = (data.prompt || '').toLowerCase();
        if (!prompt) process.exit(0);

        const rulesPath = findRulesPath();
        if (!rulesPath) process.exit(0);
        const rules: SkillRules = JSON.parse(readFileSync(rulesPath, 'utf-8'));

        const matchedSkills: MatchedSkill[] = [];

        for (const [skillName, config] of Object.entries(rules.skills)) {
            const triggers = config.promptTriggers;
            if (!triggers) continue;

            if (triggers.keywords?.some(kw => prompt.includes(kw.toLowerCase()))) {
                matchedSkills.push({ name: skillName, matchType: 'keyword', config });
                continue;
            }

            if (triggers.intentPatterns?.some(pattern => new RegExp(pattern, 'i').test(prompt))) {
                matchedSkills.push({ name: skillName, matchType: 'intent', config });
            }
        }

        if (matchedSkills.length === 0) process.exit(0);

        const ordered = sortPriority(matchedSkills);
        let output = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        output += 'SKILL ACTIVATION CHECK\n';
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

        for (const match of ordered) {
            output += `- ${match.name}`;
            if (match.config.description) {
                output += `: ${match.config.description}`;
            }
            output += '\n';
        }

        output += '\nACTION: relevant local project skills are available.\n';
        output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        console.log(output);
        process.exit(0);
    } catch {
        process.exit(0);
    }
}

main().catch(() => process.exit(0));
