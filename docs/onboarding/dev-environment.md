# 하네스 엔지니어링 환경

> Claude Code 기반 개발 자동화 환경 전체 현황.
> 스킬 사용법은 `commands.md`, 워크플로우·컨벤션은 `workflow.md` 참조.

---

## 구성 요소 한눈에 보기

```
.claude/
├── settings.json          ← 권한·deny rules
├── commands/              ← 슬래시 커맨드 (스킬)
│   ├── start-issue.md     (/si)
│   ├── finish-issue.md    (/fi)
│   ├── cleanup-issue.md   (/ci)
│   └── backlog-issue.md   (/bi)
└── agents/                ← 커스텀 에이전트 7종

scripts/
└── check_invariants.py    ← pre-commit 불변식 검증

CLAUDE.md                  ← 에이전트 세션 시작 지도
AGENTS.md                  ← 레포 전체 목차·불변식·규칙
각 디렉토리/.ai.md          ← 디렉토리별 컨텍스트 (에이전트용)
```

---

## 커스텀 에이전트 (7종)

Claude Code에서 `@에이전트명`으로 호출. 코드 리뷰·리팩터링·문서화 등 전문 역할 수행.

| 에이전트 | 역할 |
|----------|------|
| `code-architecture-reviewer` | 아키텍처 일관성·불변식 위반 검토 |
| `code-refactor-master` | 리팩터링 가이드 |
| `documentation-architect` | 문서화 전략 |
| `frontend-error-fixer` | UI 디버깅 |
| `plan-reviewer` | 구현 플랜 검증 |
| `refactor-planner` | 리팩터링 계획 수립 |
| `web-research-specialist` | 웹 리서치 |

---

## 불변식 자동 검증

`scripts/check_invariants.py`가 pre-commit hook으로 동작. 위반 시 커밋 차단.

```
1. LLM 호출     → engine/services/ 에서만
2. PDF 파싱     → engine/parsers/ 에서만
3. service      → engine 호출만 (내부 직접 접근 금지)
4. 테스트 없는 코드 커밋 금지
```

---

## 보안 훅

- **시크릿 필터** (#10): `PostToolUse` 훅으로 API 키·토큰이 출력에 포함되면 자동 차단
- **deny rules** (`.claude/settings.json`): 위험 명령어 실행 방지

---

## .ai.md 컨텍스트 체계

모든 디렉토리에 `.ai.md` 파일 존재. 에이전트가 작업 시작 전 자동으로 읽는 컨텍스트.

포함 내용:
- 이 디렉토리의 목적
- 내부 구조·파일 역할
- 규칙·제약 사항

**규칙:** 작업 완료 후 `.ai.md` 최신화 필수. 안 하면 작업 미완료로 간주.

---

## 프로젝트 가이드 문서

| 파일 | 역할 | 대상 |
|------|------|------|
| `CLAUDE.md` | 세션 시작 시 에이전트가 읽는 지도 | 에이전트 |
| `AGENTS.md` | 레포 전체 목차·불변식·디렉토리 역할 | 에이전트 + 사람 |

---

## 미확정 (기술 스택 확정 후 진행, #20)

- `docs/onboarding/CONTRIBUTING.md`에 코딩·문서·리뷰·GitHub 규칙 통합
- 린터/포맷터는 설정 파일로 기계가 강제
