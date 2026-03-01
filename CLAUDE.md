# MirAI — Claude Code 가이드

> 세션 시작 시 이 파일을 먼저 읽는다. 지도(map)다. 백과사전이 아니다.

## 시작 전 필수 확인 순서
1. `AGENTS.md` — 레포 전체 목차·불변식·규칙
2. 작업 대상 디렉토리의 `ai.md` — 목적·구조·역할
3. `engine/docs/INTERFACE.md` — 엔진 API 계약 (엔진/서비스 작업 시)
4. `docs/exec-plans/active/` — 현재 진행 중인 실행 계획

## 불변식 (위반 시 pre-commit 자동 차단)
```
1. LLM 호출     → engine/services/ 에서만
2. PDF 파싱     → engine/parsers/ 에서만
3. service      → engine 호출만 (내부 직접 접근 금지)
4. 테스트 없는 코드 커밋 금지
```

## 작업 흐름
1. 해당 디렉토리 `ai.md` 읽기
2. `docs/specs/` 에서 AC(인수 조건) 확인
3. 테스트 먼저 작성 → Red → Green → Refactor
4. 완료 후 `ai.md` 최신화
5. 실패 시 → "레포에 무엇이 없었나?" 진단 → 문서 업데이트

## 핵심 문서 위치
- 레포 구조·커리큘럼 → `docs/whitepaper/mirai_project_plan.md`
- 엔진 API 계약 → `engine/docs/INTERFACE.md`
- 기능 명세 + AC → `docs/specs/`
- 실행 계획 → `docs/exec-plans/active/`
- 의사결정 기록 → `docs/decisions/`
