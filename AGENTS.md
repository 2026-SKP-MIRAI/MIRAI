# MirAI AGENTS.md

> 이 파일은 레포 전체의 목차다. 백과사전이 아니다.
> 카톡/노션에서 논의한 결정이 여기 없으면 에이전트에겐 없는 것이다.

---

## 레포 구조

```
mirai/
├── AGENTS.md               ← 지금 이 파일
├── docs/                   ← 프로젝트 문서 (SOT)
│   ├── whitepaper/         화이트페이퍼·기획서
│   ├── specs/              기능 명세 (기능 2~4 상세 설계)
│   ├── meetings/           회의록
│   ├── decisions/          아키텍처 의사결정 기록 (ADR)
│   ├── retrospectives/     주간 회고 기록
│   └── onboarding/         환경 설정·기여 가이드
├── engine/                 ← 전원 공동 (기술 레이어, TDD 적용)
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

## 엔진 불변식 (위반 시 CI 차단)

```
1. LLM API 호출은 반드시 engine/services/ 레이어에서만
2. PDF 파싱은 반드시 engine/parsers/ 경계에서만
3. 각 service는 engine을 호출만 — engine 내부 직접 접근 금지
4. 테스트 없는 PR은 머지 금지
```

---

## 레포 규칙

```
1. 5MB 초과 파일 커밋 시 팀 컨펌 필요
2. *.pdf, *.csv, *.pkl, *.parquet 파일은 커밋 금지 (.gitignore 적용)
3. 모든 디렉토리에는 ai.md 포함 — 목적·구조·역할 기술
4. 작업 전 해당 디렉토리의 ai.md 확인
5. 작업 완료 후 ai.md 최신화 필수
```

---

## 핵심 문서 링크

- 프로젝트 운영 계획 → `docs/whitepaper/mirai_project_plan.md`
- 기획서 → `docs/whitepaper/MirAI_기획서.md`
- 엔진 인터페이스 → `engine/docs/INTERFACE.md`
- 기능 명세 → `docs/specs/`
- 의사결정 기록 → `docs/decisions/`

---

## 개발 원칙

- **엔진**: 기술 레이어 구조 + TDD (Test-Driven Development)
- **서비스**: DDD (Domain-Driven Design) + TDD
- **매니징 및 개발 프로세스**: 이왕원
