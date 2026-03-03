# [#1] claude-code-harness 패턴 적용 계획

> 타겟 레포: [chacha95/claude-code-harness](https://github.com/chacha95/claude-code-harness)
> 작성: 2026-03-03

---

## 배경 및 제약

- **기간:** 4주 교육 프로젝트 (3/1~3/31)
- **불변식 강제:** CI + pre-commit → Week 2 (3/12) 계획됨 — 에이전트 중복 구현 불필요
- **멘티 목적:** 기능 구현 + 에이전트 활용법 학습
- **결론:** 불변식 체크보다 **멘티 워크플로 자동화**에 집중

---

## 타겟 레포에서 발견한 것

| 항목 | 내용 |
|------|------|
| `.claude/agents/` | Claude Code 네이티브 Sub-Agent (.md 파일 1개 = 에이전트 1개) |
| `.claude/skills/` + `skill-rules.json` | 파일 경로/키워드 기반 스킬 자동 활성화 |
| `.claude/commands/dev-docs.md` | plan + context + tasks 3파일 자동 생성 |
| `settings.json` | Edit/Write/Bash 전체 허용, defaultMode: acceptEdits |

---

## 적용 항목

### ★★★ HIGH — 즉시 도입

**`.claude/agents/` 도입 — 7개 (타겟 레포 기반)**

에이전트 포맷:
```markdown
---
name: agent-name
description: 언제 호출할지 (Claude가 이걸 읽고 자동 판단)
tools: Read, Write, Edit, Bash
model: sonnet
---
```

| # | 에이전트 | 출처 | 역할 |
|---|----------|------|------|
| 1 | `plan-reviewer` | 타겟 레포 | 구현 계획 검토 — 리스크, 누락 AC, 의존성 지적 |
| 2 | `code-architecture-reviewer` | 타겟 레포 + MirAI 불변식 추가 | 아키텍처·레이어 일관성 리뷰 |
| 3 | `frontend-error-fixer` | 타겟 레포 | Next.js/React 에러 디버깅 |
| 4 | `web-research-specialist` | 타겟 레포 | GitHub Issues, Stack Overflow 등 외부 리서치 |
| 5 | `refactor-planner` | 타겟 레포 | 리팩토링 분석 + 계획서 작성 (실행 없음) |
| 6 | `code-refactor-master` | 타겟 레포 | 리팩토링 실행 + 검증 (`refactor-planner` 후속) |
| 7 | `documentation-architect` | 타겟 레포 | README, API 문서, .ai.md 등 문서 생성 |

**서비스 스택 (에이전트 기준으로 정의):** FastAPI (backend) + Next.js + TypeScript (frontend)

### ★★ MEDIUM — Week 2 이후

- `/start-issue` 강화: `01_plan.md` 체크리스트 자동 생성 (이슈 AC 기반)

### ★ LOW — 4주 프로젝트에서 오버헤드

- `skill-rules.json`: 설정·튜닝 비용 높음, ROI 낮음 → 차기 코호트 검토
- `settings.json` defaultMode 변경: 팀 논의 필요 (현재 보수적 설정 유지 권고)

---

## 완료 기준

- [x] `.claude/agents/` 생성 + 에이전트 7개 작성 (YAML frontmatter 포함)
  - [x] `plan-reviewer.md`
  - [x] `code-architecture-reviewer.md` (MirAI 불변식 추가)
  - [x] `frontend-error-fixer.md`
  - [x] `web-research-specialist.md`
  - [x] `refactor-planner.md`
  - [x] `code-refactor-master.md`
  - [x] `documentation-architect.md`
- [x] `.claude/agents/README.md` 카탈로그 작성
- [x] `.claude/agents/.ai.md` 작성
- [x] `/start-issue` 강화: `01_plan.md` 체크리스트 자동 생성
