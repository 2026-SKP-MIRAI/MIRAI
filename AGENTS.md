# MirAI AGENTS.md

> 이 파일은 레포 전체의 목차다. 백과사전이 아니다.
> 규칙·불변식은 `CLAUDE.md` 참조. 각 디렉토리 상세는 해당 `ai.md` 참조.

---

## 레포 구조

```
mirai/
├── AGENTS.md               ← 지금 이 파일 (목차)
├── CLAUDE.md               ← 불변식·규칙·작업 흐름
├── docs/                   ← 프로젝트 문서 (SOT)
│   ├── whitepaper/         프로젝트 전략·운영 계획 문서
│   ├── background/         배경 자료·외부 분석·연구 문서
│   ├── specs/              기능 명세 (AC 포함)
│   ├── meetings/           회의록
│   ├── decisions/          아키텍처 의사결정 기록 (ADR)
│   ├── retrospectives/     주간 회고 기록
│   ├── exec-plans/         실행 계획 (backlog/review/active/completed)
│   └── onboarding/         환경 설정·기여 가이드
├── engine/                 ← 전원 공동 설계 (기술 레이어, TDD 적용)
│   ├── parsers/            PDF 파싱 레이어
│   ├── services/           LLM API 레이어
│   ├── prompts/            프롬프트 + 버전 관리
│   └── docs/               엔진 설계 문서
└── services/               ← 1인 1서비스 (DDD + TDD)
    ├── siw/
    ├── kwan/
    ├── dong/
    └── seung/
```

---

## 핵심 문서 링크

- 프로젝트 운영 계획 → `docs/whitepaper/mirai_project_plan.md`
- 기획서 → `docs/whitepaper/MirAI_proposal.md`
- 엔진 인터페이스 → `engine/docs/INTERFACE.md`
- 기능 명세 + AC → `docs/specs/`
- 의사결정 기록 → `docs/decisions/`
- 실행 계획 → `docs/exec-plans/active/`
