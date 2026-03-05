# [#19] 프로젝트 구조 재정의 — FastAPI 엔진 구조 수립 및 .ai.md 체계 정립

> 작성: 2026-03-05

---

## 현황 분석

### 작업 전 상태
- `engine/`은 submodule (`mirai-engine` 레포) — README.md만 존재
- `INTERFACE.md`는 생성된 적 없음 — 14곳에서 참조하지만 실제 파일 부재
- engine 내부 디렉토리 구조·코드·테스트 전무
- .ai.md 파일: umbrella 레포에 존재, engine/ 하위에는 0개
- 기술 스택 FastAPI(Python) + Next.js(TypeScript) 확정이나 문서 미반영
- 아키텍처 불변식이 파일 레벨 4개 — 숲이 아닌 나무를 보는 수준

### 핵심 제약
1. **submodule 경계**: engine/ 내부 파일 변경은 mirai-engine 레포에 별도 커밋·푸시 필요
2. **umbrella <-> submodule 동기화**: umbrella에서 submodule 커밋 해시 업데이트 필요
3. **INTERFACE.md 부재**: "통합"이 아닌 "신규 정의" — .ai.md 형태로 처음부터 작성

---

## 완료 기준

### engine 구조
- [x] AC1: FastAPI 엔진 디렉토리 구조 생성 (`app/parsers/`, `app/services/`, `app/prompts/`, `app/routers/`, `tests/`)
- [x] AC2: `pyproject.toml` (FastAPI, pytest, 의존성)
- [x] AC3: 스켈레톤 코드 (`main.py`, `config.py`, `schemas.py`, parsers, services, prompts, routers)
- [x] AC4: pytest 테스트 스켈레톤 (Red 상태)

### .ai.md 체계
- [x] AC5: `engine/.ai.md` — 아키텍처 불변식 + 구조 + 통신 + 테스트
- [x] AC6: `engine/app/parsers/.ai.md`, `services/.ai.md`, `prompts/.ai.md`, `routers/.ai.md`
- [x] AC7: `engine/tests/.ai.md`

### 참조 경로 + 문서 현행화
- [x] AC8: INTERFACE.md 참조를 `engine/.ai.md`로 전환 (전체 grep 0건 확인)
- [x] AC9: `AGENTS.md` 레포 구조 현행화 (FastAPI/Python 반영)
- [x] AC10: `CLAUDE.md` — 아키텍처 불변식 5개 + 핵심 문서 위치 + 기획서 경로
- [x] AC11: `mirai_project_plan.md` — 레포 구조 + 아키텍처 불변식 전면 재작성
- [x] AC12: `code-architecture-reviewer.md` 기술 스택 현행화
- [x] AC13: `.gitignore`에 `tests/fixtures/` 예외 추가

### 커밋
- [ ] AC14: engine submodule 커밋·푸시 + umbrella 해시 업데이트

---

## 구현 계획

### Phase 1: engine 디렉토리 구조 + 스켈레톤 코드 [완료]

**작업 위치**: engine/ submodule 내부 (mirai-engine 레포)

#### 생성된 구조
```
engine/
├── .ai.md                  <- 엔진 전체 계약 (불변식, 구조, 통신, 테스트)
├── pyproject.toml           <- Python 프로젝트 설정 (FastAPI, pytest)
├── app/
│   ├── __init__.py
│   ├── main.py              <- FastAPI 앱 진입점 (/health)
│   ├── config.py            <- 환경변수 (Settings, pydantic-settings)
│   ├── schemas.py           <- Pydantic 모델 (Question, QuestionResponse)
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── pdf_parser.py    <- PDF -> 텍스트 추출 스켈레톤 (NotImplementedError)
│   │   └── .ai.md
│   ├── services/
│   │   ├── __init__.py
│   │   ├── llm_service.py   <- LLM API 호출 스켈레톤 (NotImplementedError)
│   │   └── .ai.md
│   ├── prompts/
│   │   ├── __init__.py
│   │   ├── question_generation.py  <- 시스템 프롬프트 v1
│   │   └── .ai.md
│   └── routers/
│       ├── __init__.py
│       ├── resume.py        <- POST /resume/questions 스켈레톤
│       └── .ai.md
└── tests/
    ├── __init__.py
    ├── conftest.py           <- sample_resume_text fixture
    ├── test_pdf_parser.py    <- PDF 파서 테스트 (Red/skip)
    ├── test_llm_service.py   <- LLM 서비스 테스트 (Red/skip)
    ├── test_resume_api.py    <- Health 엔드포인트 테스트
    └── .ai.md
```

**대상 AC**: AC1~AC7

---

### Phase 2: umbrella 레포 참조 경로 + 문서 업데이트 [완료]

**작업 위치**: umbrella 레포 (현재 워크트리)

#### 변경된 파일

| # | 파일 | 변경 내용 |
|---|------|-----------|
| 1 | `CLAUDE.md` | INTERFACE.md -> engine/.ai.md, 불변식 5개, 기획서 경로 추가 |
| 2 | `AGENTS.md` | 레포 구조 FastAPI/Python 반영, 문서 링크 현행화 |
| 3 | `docs/whitepaper/mirai_project_plan.md` | 레포 구조 + 아키텍처 불변식 전면 재작성 |
| 4 | `.claude/agents/.ai.md` | INTERFACE.md -> engine/.ai.md |
| 5 | `.claude/agents/code-architecture-reviewer.md` | INTERFACE.md -> engine/.ai.md + 기술 스택 현행화 |
| 6 | `.claude/agents/plan-reviewer.md` | INTERFACE.md -> engine/.ai.md (3곳) |
| 7 | `.claude/agents/documentation-architect.md` | INTERFACE.md -> engine/.ai.md |
| 8 | `.claude/commands/start-issue.md` | INTERFACE.md -> engine/.ai.md |
| 9 | `scripts/check_invariants.py` | INTERFACE.md -> engine/.ai.md |
| 10 | `.gitignore` | `!**/tests/fixtures/**` 추가 (테스트 픽스처 허용) |

**검증 완료**: `grep -r "INTERFACE.md"` 결과 0건 (work docs 제외)

**대상 AC**: AC8~AC13

---

### Phase 3: engine submodule 커밋 [미완료]

```bash
cd engine
git add -A
git commit -m "chore: FastAPI 엔진 디렉토리 구조 + .ai.md + 테스트 스켈레톤 — #19"
git push origin main
cd ..
git add engine  # submodule 해시 업데이트
```

**대상 AC**: AC14

---

## 리스크 및 대응

| 리스크 | 영향 | 대응 |
|--------|------|------|
| engine submodule push 권한 부재 | AC14 차단 | gh repo 권한 확인 후 진행, 실패 시 umbrella에 임시 작성 |
| 서비스 submodule에 .ai.md 미존재 | 참조 불일치 | 이 이슈 범위 외 — 별도 이슈로 분리 |
| 스켈레톤 코드가 실제 구현과 불일치 가능 | API 혼란 | .ai.md에 "설계 단계" 명시, 구현 시 업데이트 필수 |

---

## 검증 체크리스트

- [x] engine/ 하위 모든 디렉토리에 .ai.md 존재
- [x] `grep -r "INTERFACE.md"` 결과 0건 (work docs 제외)
- [x] `mirai_project_plan.md` 레포 구조가 실제 디렉토리와 일치
- [x] `AGENTS.md` 레포 구조가 실제 디렉토리와 일치
- [x] `CLAUDE.md` 불변식이 아키텍처 수준 (5개)
- [x] `code-architecture-reviewer.md` 기술 스택 현행화
- [ ] engine submodule 커밋·푸시 완료
- [ ] `pytest` 실행 가능 (스켈레톤 테스트)

---

## 범위 외 (별도 이슈)

- services/{siw,kwan,seung,lww}/ submodule 내부 .ai.md 생성
- engine 실제 코드 구현 (parsers, services)
- CI/CD 파이프라인 설정
- TEST_STRATEGY.md 작성 (엔진 구현 시점에 작성)
- check_invariants.py 아키텍처 불변식 확장 (서비스 코드 생성 후)
