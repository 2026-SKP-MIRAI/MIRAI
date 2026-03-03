# [#1] claude-code-harness 스킬 적용 계획

> 타겟 레포: [chacha95/claude-code-harness](https://github.com/chacha95/claude-code-harness)
> 작성: 2026-03-03

---

## 배경 및 제약

- **기간:** 4주 교육 프로젝트 (3/1~3/31)
- **에이전트 완료:** 7개 에이전트 + README + .ai.md → `01_agent_plan.md` 완료
- **이번 목표:** 타겟 레포의 `.claude/skills/` 패턴 도입
- **핵심 질문:** 스킬 컨텐츠만 가져올 것인가 vs. 자동 활성화 훅 시스템까지 구현할 것인가

---

## 타겟 레포에서 발견한 스킬 구조

### 스킬 디렉토리 패턴

```
.claude/skills/
├── fastapi-backend-guidelines/
│   ├── skill.md          (20KB — FastAPI 개발 가이드라인)
│   ├── README.md
│   └── resources/        (참조 문서)
├── pytest-backend-testing/
│   ├── SKILL.md          (13KB — pytest 테스팅 가이드라인)
│   └── resources/
├── nextjs-frontend-guidelines/
│   ├── skill.md          (31KB — Next.js 개발 가이드라인)
│   ├── README.md
│   └── resources/
└── skill-developer/      (메타 스킬 — 스킬 작성 방법)
    ├── SKILL.md
    ├── ADVANCED.md
    ├── HOOK_MECHANISMS.md
    ├── PATTERNS_LIBRARY.md
    ├── SKILL_RULES_REFERENCE.md
    ├── TRIGGER_TYPES.md
    └── TROUBLESHOOTING.md
```

### 자동 활성화 메커니즘

타겟 레포는 2단계 자동 활성화를 사용:

1. **`skill-rules.json`** — 트리거 조건 정의
   ```json
   {
     "skills": [{
       "name": "스킬명",
       "type": "domain",               // guardrail | domain
       "enforcement": "suggest",       // block | suggest | warn
       "promptTriggers": {
         "keywords": ["fastapi", "api"],
         "intentPatterns": ["FastAPI.*endpoint", "API.*라우터"]
       },
       "fileTriggers": {
         "pathPatterns": ["**/*.py", "backend/**"],
         "contentPatterns": ["from fastapi import", "import fastapi"]
       }
     }]
   }
   ```

2. **훅 스크립트** — 실제 활성화 실행
   - `UserPromptSubmit` 훅: 사용자 메시지 키워드/의도 매칭
   - `PreToolUse` 훅: 파일 경로/컨텐츠 패턴 매칭

---

## 도입할 스킬 목록

**방침: 타겟 레포 원본 그대로 가져온다. MirAI 특화 수정 없음.**
(불변식·프로젝트 규칙은 CLAUDE.md + agents에 있으므로 스킬 중복 불필요)

| # | 스킬 | MirAI 관련성 | 채택 |
|---|------|-------------|------|
| 1 | `fastapi-backend-guidelines` | ★★★ 백엔드 스택 | ✅ |
| 2 | `pytest-backend-testing` | ★★★ TDD 워크플로 | ✅ |
| 3 | `nextjs-frontend-guidelines` | ★★★ 프론트엔드 스택 | ✅ |
| 4 | `skill-developer` | ★★ 커스텀 스킬 제작 메타 | ✅ |
| 5 | `error-tracking` | ★★ 에러 추적 | ✅ |
| 6 | `frontend-design` | ★★ UI/UX 가이드 | ✅ |
| 7 | `vercel-react-best-practices` | ★ React 베스트 프랙티스 | ✅ |
| 8 | `web-design-guidelines` | ★ 일반 웹 디자인 | ✅ |
| 9 | `mermaid` | ★ 다이어그램 | ✅ |
| 10 | `pdf` | ★ PDF 처리 | ✅ |
| 11 | `ppt-brand-guidelines` | - 브랜드 PPT | ✅ |
| 12 | `pptx` | - PPT 생성 | ✅ |
| 13 | `docx` | - Word 문서 | ✅ |
| 14 | `brand-guidelines` | - 브랜드 가이드 | ✅ |

### 불채택 항목

- `skill-rules.json` 기반 **자동 활성화 훅 시스템** → ★ LOW (이유 아래 참조)

---

## 핵심 결정: 컨텐츠만 vs. 전체 훅 시스템

### Option A: 컨텐츠 파일만 (추천)

```
.claude/skills/
├── fastapi-backend-guidelines/skill.md
├── pytest-backend-testing/skill.md
├── nextjs-frontend-guidelines/skill.md
└── skill-developer/skill.md
```

**장점:**
- 설정 비용 없음 — 파일만 만들면 됨
- Claude가 자연어 요청("FastAPI 엔드포인트 작성해줘")에 반응해 스킬 파일을 자동으로 참조
- oh-my-claudecode 스킬 시스템과 충돌 없음
- 멘티가 직접 "이 스킬 참조해서 구현해줘" 명시적 요청 가능

**단점:**
- Claude가 스킬 파일을 자동으로 불러오지 않음 — 프롬프트에 파일 경로 지정 필요 (또는 Claude의 자체 판단에 의존)

### Option B: skill-rules.json + 훅 시스템 (전체)

**장점:**
- 완전 자동 활성화 — Python 파일 열면 FastAPI 가이드라인 자동 주입
- 가장 강력한 컨텍스트 주입 방식

**단점:**
- 훅 스크립트 작성 + 디버깅 필요 (추가 1~2일 공수)
- oh-my-claudecode 기존 훅과 충돌 가능성
- 4주 프로젝트에서 설정·튜닝 오버헤드
- 스킬 내용보다 인프라 구축에 집중되는 문제

### 결론

**Option A 채택**: 컨텐츠 파일 우선 도입. 스킬 내용이 핵심이고, Claude의 자동 맥락 이해로 충분히 활용 가능. 훅 시스템은 차기 코호트에서 검토.

---

## 적용 계획

### 작업 내용

타겟 레포에서 14개 스킬 디렉토리를 **원본 그대로** 복사. 수정 없음.

```
.claude/skills/
├── fastapi-backend-guidelines/   (원본 그대로)
├── pytest-backend-testing/       (원본 그대로)
├── nextjs-frontend-guidelines/   (원본 그대로)
├── skill-developer/              (원본 그대로)
├── error-tracking/               (원본 그대로)
├── frontend-design/              (원본 그대로)
├── vercel-react-best-practices/  (원본 그대로)
├── web-design-guidelines/        (원본 그대로)
├── mermaid/                      (원본 그대로)
├── pdf/                          (원본 그대로)
├── ppt-brand-guidelines/         (원본 그대로)
├── pptx/                         (원본 그대로)
├── docx/                         (원본 그대로)
├── brand-guidelines/             (원본 그대로)
└── .ai.md                        (디렉토리 컨텍스트 — 신규 작성)
```

---

## 완료 기준

- [x] 타겟 레포에서 14개 스킬 디렉토리 원본 복사
- [x] `.claude/skills/.ai.md` 작성

### 보류 (차기 코호트)

- [ ] `skill-rules.json` 자동 활성화 훅 시스템

---

## 참고: 스킬 파일 포맷

```markdown
---
name: skill-name
description: |
  언제 이 스킬을 사용하는지 (1-2줄)
  트리거 예시 포함
triggers:
  - "fastapi endpoint"
  - "api router"
---

# 스킬 내용

...
```
