# MirAI — Claude Code 가이드

> 세션 시작 시 이 파일을 먼저 읽는다. 지도(map)다. 백과사전이 아니다.

## 시작 전 필수 확인 순서
1. `gh issue list --assignee @me` — 내 담당 이슈 확인
2. `AGENTS.md` — 레포 전체 목차·불변식·규칙
3. 작업 대상 디렉토리의 `.ai.md` — 목적·구조·역할
4. `engine/docs/INTERFACE.md` — 엔진 API 계약 (엔진/서비스 작업 시)
5. `docs/work/active/` — 현재 진행 중인 작업 내역 (있는 경우)

## 불변식 (위반 시 pre-commit 자동 차단)
```
1. LLM 호출     → engine/services/ 에서만
2. PDF 파싱     → engine/parsers/ 에서만
3. service      → engine 호출만 (내부 직접 접근 금지)
4. 테스트 없는 코드 커밋 금지
```

## 레포 규칙
```
1. 5MB 초과 파일 커밋 시 팀 컨펌 필요
2. *.pdf, *.csv, *.pkl, *.parquet 커밋 금지 (.gitignore 적용)
3. 모든 디렉토리에 .ai.md 포함 — 목적·구조·역할 기술
4. 작업 전 해당 디렉토리의 .ai.md 확인
5. 작업 완료 후 .ai.md 최신화 필수 (생략 시 작업 미완료)
```

## 작업 흐름
1. 해당 디렉토리 `.ai.md` 읽기
2. GitHub Issue body에서 AC 확인 (`docs/specs/`는 기획/기술 설계/배경 문서 — "어떻게 만드나")
3. 테스트 먼저 작성 → Red → Green → Refactor
4. **완료 후 `.ai.md` 최신화 — 필수, 생략 시 작업 미완료로 간주**
5. 실패 시 → "레포에 무엇이 없었나?" 진단 → 문서 업데이트

## 핵심 문서 위치
- 레포 구조·커리큘럼 → `docs/whitepaper/mirai_project_plan.md`
- 엔진 API 계약 → `engine/docs/INTERFACE.md`
- 기능 명세 + AC → `docs/specs/`
- 배경 자료·리서치 → `docs/background/`
- 회의록 → `docs/meetings/`
- 온보딩·워크플로우 → `docs/onboarding/`
- 작업 내역 → `docs/work/active/` · `docs/work/done/`
