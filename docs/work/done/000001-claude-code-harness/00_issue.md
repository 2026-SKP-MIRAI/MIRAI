# [CHORE] claude-code-harness 패턴 검토 및 MirAI 적용

## 목적
Claude Code 에이전트가 더 효율적으로 작동하는 환경 패턴을 도입한다.
(chacha95/claude-code-harness 레포의 검증된 패턴을 MirAI에 선별 적용)

## 배경
harness_engineering_analysis.md §8에서 DIT 팀 사례를 교차 분석했다.
https://github.com/chacha95/claude-code-harness 는 Claude Code 기반 Harness Engineering 구현 사례로,
CI 설정, 커스텀 명령, settings.json 패턴 등 우리 레포에 직접 적용 가능한 패턴이 있을 수 있다.

- 이미 적용 완료: exec-plans 파일 네이밍 규칙 (`-plan`, `-context`, `-tasks`)
- 검토 대상: CI 설정, 커스텀 Claude 명령, settings.json 패턴 등

## 완료 기준
- [ ] 레포 전체 구조 재검토 후 적용 가능 항목 리스트 작성
- [ ] 우선순위 결정 (팀 컨펌)
- [ ] 선택한 항목 MirAI 레포에 반영 및 문서화

## 개발 체크리스트
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### 1. 타겟 레포 분석 및 플랜 작성
- `chacha95/claude-code-harness` 레포 전체 구조 검토
- MirAI 백서(4주 교육 프로젝트 제약) 반영하여 적용 항목 선별
- `docs/work/active/000001-claude-code-harness/01_agent_plan.md` — 에이전트 도입 계획
- `docs/work/active/000001-claude-code-harness/02_skill_plan.md` — 스킬 도입 계획

### 2. `.claude/agents/` 구축 (7개)
타겟 레포 기반으로 MirAI용 서브에이전트 7개 작성:
- `plan-reviewer` (opus): 구현 계획 사전 검토
- `code-architecture-reviewer` (sonnet): 코드 품질·아키텍처 리뷰
- `documentation-architect`: `.ai.md` 작성·갱신, 문서 생성
- `refactor-planner`: 리팩토링 분석·계획 수립 (실행 없음)
- `code-refactor-master` (opus): 리팩토링 실행·검증
- `frontend-error-fixer`: Next.js/React 에러 디버깅
- `web-research-specialist` (sonnet): 외부 리서치

결정사항: 불변식 하드코딩 제거 — CLAUDE.md에 이미 있으므로 에이전트 중복 불필요

### 3. `.claude/skills/` 구축 (14개)
타겟 레포에서 원본 그대로 복사 (MirAI 특화 수정 없음):
fastapi-backend-guidelines, pytest-backend-testing, nextjs-frontend-guidelines, skill-developer, error-tracking, frontend-design, vercel-react-best-practices, web-design-guidelines, mermaid, pdf, ppt-brand-guidelines, pptx, docx, brand-guidelines

### 4. `/start-issue` · `/si` 강화
이슈 시작 시 `01_plan.md` 자동 생성 추가:
- 이슈 body에서 AC 섹션 추출 → 체크리스트로 변환
- `00_issue.md` + `01_plan.md` 함께 커밋
