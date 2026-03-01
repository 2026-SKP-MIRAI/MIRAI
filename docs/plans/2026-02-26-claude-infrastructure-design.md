# Claude Code Infrastructure Design

**Date:** 2026-02-26
**Source:** [claude-code-infrastructure-showcase](https://github.com/diet103/claude-code-infrastructure-showcase)
**Approach:** Option B - 선택적 구성 요소만 복사

## 목표

showcase 레포에서 OMC와 겹치지 않는 가치 있는 구성 요소만 선별해 MIRAI에 적용한다.

## 선별 근거

| 기능 | OMC | showcase | 결정 |
|------|-----|----------|------|
| 스킬 자동 활성화 | using-superpowers hook | skill-rules.json 패턴 매칭 | 보완 관계 → 적용 |
| Agents | Task(subagent_type=...) | .claude/agents/ 마크다운 | 다른 레이어 → 적용 |
| 컨텍스트 관리 | notepad + project-memory | dev docs 3파일 패턴 | 많이 겹침 → 스킵 |
| 파일 변경 추적 | 없음 | post-tool-use-tracker.sh | OMC에 없음 → 적용 |
| 프로젝트 특화 skills | 없음 | backend/frontend 가이드라인 | 기술 스택 미정 → 나중에 |

## 디렉토리 구조

```
MIRAI/
└── .claude/
    ├── settings.local.json     (hooks 등록 추가)
    ├── hooks/
    │   ├── skill-activation-prompt.sh   (진입점)
    │   ├── skill-activation-prompt.ts   (로직)
    │   ├── post-tool-use-tracker.sh     (파일 변경 추적)
    │   ├── package.json
    │   └── tsconfig.json
    ├── agents/
    │   ├── code-architecture-reviewer.md
    │   ├── refactor-planner.md
    │   └── ... (10개)
    └── skills/
        └── skill-rules.json    (MIRAI 전용, 빈 룰셋으로 시작)
```

## Hooks 동작 방식

### skill-activation-prompt (UserPromptSubmit)
- 사용자 프롬프트 입력 시 skill-rules.json의 키워드 패턴 매칭
- 매칭되면 시스템 메시지로 스킬 제안
- OMC의 using-superpowers 훅과 동시에 실행 (충돌 없음)

### post-tool-use-tracker (PostToolUse)
- Write/Edit 도구 실행 후 수정된 파일 감지
- .claude/logs/에 변경 이력 기록

### settings.local.json 변경 사항
```json
"hooks": {
  "UserPromptSubmit": [".claude/hooks/skill-activation-prompt.sh"],
  "PostToolUse": [".claude/hooks/post-tool-use-tracker.sh"]
}
```

## Agents

- Claude Code 네이티브 `.claude/agents/` 방식 (OMC Task tool과 별개 레이어)
- showcase의 10개 에이전트 그대로 가져옴
- blog 도메인 예제는 기술 스택 확정 후 MIRAI용으로 커스터마이징

## skill-rules.json

빈 상태로 시작, 기술 스택 확정 후 MIRAI 전용 트리거 룰 추가:
```json
{
  "skills": []
}
```

## 설치 의존성

```bash
cd .claude/hooks && npm install
```
TypeScript 훅 실행을 위한 ts-node 등 패키지 설치

## 향후 확장

- 기술 스택 확정 후 프로젝트 특화 skills 추가
- MIRAI 도메인에 맞는 skill-rules.json 트리거 룰 작성
- agents의 blog 예제를 MIRAI 도메인으로 교체
