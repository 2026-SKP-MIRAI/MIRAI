# MirAI AGENTS.md

> 이 파일은 레포 전체의 목차다. 백과사전이 아니다.
> 규칙·불변식은 `CLAUDE.md` 참조. 각 디렉토리 상세는 해당 `.ai.md` 참조.

---

## 레포 구조

```
mirai/
├── AGENTS.md               ← 지금 이 파일 (목차)
├── CLAUDE.md               ← 불변식·규칙·작업 흐름
├── docs/                   ← 프로젝트 문서 (SOT)
│   ├── whitepaper/         기획서·운영 계획
│   ├── specs/              기능 명세 (기능 01~07)
│   ├── background/         배경 자료·리서치·경쟁사 분석
│   ├── meetings/           회의록
│   ├── onboarding/         환경 설정·기여 가이드
│   └── work/               이슈별 작업 내역 (active/done)
│
├── engine/                 ← FastAPI (Python), 전원 공동 설계 (submodule: mirai-engine)
│   ├── app/
│   │   ├── parsers/        PDF → 텍스트 추출
│   │   ├── services/       LLM API 호출
│   │   ├── prompts/        프롬프트 템플릿 + 버전 관리
│   │   └── routers/        API 엔드포인트
│   └── tests/              pytest 테스트
│
└── services/               ← Next.js 풀스택 (TypeScript), 1인 1서비스 (각각 submodule)
    ├── siw/                → mirai-siw
    ├── kwan/               → mirai-kwan
    ├── lww/                → mirai-lww
    └── seung/              → mirai-seung
```

---

## 핵심 문서 링크

- 프로젝트 운영 계획 → `docs/whitepaper/mirai_project_plan.md`
- 기획서 → `docs/whitepaper/MirAI_proposal.md`
- 엔진 계약 → `engine/.ai.md`
- 기능 명세 + AC → `docs/specs/`
- 작업 내역 → `docs/work/active/`
