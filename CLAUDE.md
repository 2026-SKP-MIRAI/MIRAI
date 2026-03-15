# MirAI — Claude Code 가이드

> 세션 시작 시 이 파일을 먼저 읽는다. 지도(map)다. 백과사전이 아니다.

## 시작 전 필수 확인 순서
1. `gh issue list --assignee @me` — 내 담당 이슈 확인
2. `AGENTS.md` — 레포 전체 목차·불변식·규칙
3. 작업 대상 디렉토리의 `.ai.md` — 목적·구조·역할
4. `engine/.ai.md` — 엔진 계약 (타입·불변식·API)
5. `docs/work/active/` — 현재 진행 중인 작업 내역 (있는 경우)

## 아키텍처 불변식 (위반 시 CI 차단)
```
1. 인증은 서비스(Next.js)에서만 — 엔진은 인증 로직 없이 내부 호출만 수신
2. 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM을 호출하지 않는다
3. 서비스 간 직접 통신 금지 — 각 서비스는 독립적, 공유 로직은 엔진으로
4. DB는 서비스가 소유 — 엔진은 stateless, 데이터 저장은 서비스 책임
5. 테스트 없는 PR은 머지 금지
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
- 서비스 기획서 → `docs/whitepaper/MirAI_proposal.md`
- 엔진 계약 → `engine/.ai.md`
- 기능 명세 + AC → `docs/specs/`
- 배경 자료·리서치 → `docs/background/`
- 회의록 → `docs/meetings/`
- 온보딩·워크플로우 → `docs/onboarding/`
- 작업 내역 → `docs/work/active/` · `docs/work/done/`

## 조사·리서치 규칙
- 서베이·리서치 등 조사 작업은 팩트에 근거한 내용만 작성한다
- 조사 결과 문서 하단에는 반드시 출처를 명시한다

## 행동 규칙
- `git commit` 전에 항상 사용자에게 먼저 확인한다 ("커밋할까?" 등으로 물어보고 승인 후 실행)
- `git push` 전에 항상 사용자에게 먼저 확인한다 ("푸시할까?" 등으로 물어보고 승인 후 실행)
