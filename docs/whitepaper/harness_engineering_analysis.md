# Harness Engineering 분석 리포트

> 원문: [Harness engineering: leveraging Codex in an agent-first world](https://openai.com/index/harness-engineering/)
> 저자: Ryan Lopopolo (Member of the Technical Staff, OpenAI)
> 발행일: 2026년 2월 11일
> 정리 일자: 2026-03-01
> 핵심 질문: **이러한 시대에 엔지니어는 어떤 역량을 가져야 하는가?**

---

## 1. 실험 개요 — 무슨 일이 있었나

OpenAI 내부 팀이 5개월 동안 소프트웨어 제품을 개발했다.
조건은 단 하나: **수동으로 작성된 코드 0줄.**

모든 코드(애플리케이션 로직, CI 설정, 테스트, 문서, Observability, 내부 툴링)를 Codex 에이전트가 작성했다.

### 결과 수치

| 항목 | 수치 |
|---|---|
| 기간 | 5개월 (2025년 8월 말 ~ 2026년 1월) |
| 총 코드 라인 | ~100만 줄 |
| 수동 작성 코드 | 0줄 |
| 열고 머지된 PR | ~1,500개 |
| 초기 엔지니어 수 | 3명 |
| 현재 엔지니어 수 | 7명 |
| 1인당 일평균 PR | **3.5개** (팀 규모 커질수록 오히려 증가) |
| 기존 대비 개발 속도 | **1/10의 시간** |
| 내부 사용자 | 수백 명 (일간 파워유저 포함) |

> "We estimate that we built this in about 1/10th the time it would have taken to write the code by hand."

---

## 2. 핵심 철학

> **"Humans steer. Agents execute."**

에이전트가 모든 코드를 쓴다. 사람은 방향을 잡고, 환경을 설계하고, 피드백을 준다.
이것이 단순한 AI 보조 도구 활용이 아닌, **엔지니어링 패러다임의 전환**이다.

---

## 3. 엔지니어 역할의 재정의

### 기존 역할 vs 새 역할

| 기존 (코드 작성자) | 새로운 (환경 설계자) |
|---|---|
| 직접 코드 타이핑 | 에이전트가 작동할 환경 설계 |
| 기능 구현 | 의도(Intent) 명시 |
| 버그 수정 | 피드백 루프 설계 |
| 코드 리뷰 | "어떤 역량이 빠져 있나?" 진단 |

### 핵심 전환점

> "When something failed, the fix was almost never 'try harder.' Because the only way to make progress was to get Codex to do the work, human engineers always stepped into the task and asked: **'what capability is missing, and how do we make it both legible and enforceable for the agent?'**"

실패했을 때 "더 열심히 프롬프트 쓰기"가 아니라,
**"에이전트가 할 수 없는 이유가 무엇이고, 어떻게 시스템에 반영할까"** 를 묻는다.

---

## 4. 실제로 한 일 — 4가지 핵심 실천

### 4-1. 레포지토리를 지식의 Single Source of Truth로

> **"Give Codex a map, not a 1,000-page instruction manual."**

큰 하나의 `AGENTS.md` 파일은 실패했다. 이유:

- **Context is a scarce resource**: 거대한 지시 파일이 중요한 제약을 밀어낸다
- **Too much guidance becomes non-guidance**: 모든 것이 중요하면 아무것도 중요하지 않다
- **It rots instantly**: 사람도 관리 안 하는 파일은 순식간에 낡는다
- **It's hard to verify**: 기계적 검증이 불가능하다

대신, `AGENTS.md`를 **목차(table of contents)** 로만 쓰고,
지식은 `docs/` 폴더 구조로 분산 저장:

```
docs/
├── design-docs/
│   ├── index.md
│   └── core-beliefs.md
├── exec-plans/
│   ├── active/
│   ├── completed/
│   └── tech-debt-tracker.md
├── product-specs/
├── references/
├── DESIGN.md
├── FRONTEND.md
├── QUALITY_SCORE.md
├── RELIABILITY.md
└── SECURITY.md
```

**핵심 원칙**: 에이전트가 컨텍스트 내에서 볼 수 없는 것은 존재하지 않는 것이다.

> "That Slack discussion that aligned the team on an architectural pattern? If it isn't discoverable to the agent, it's illegible in the same way it would be unknown to a new hire joining three months later."

슬랙 대화, 구글 닥스, 암묵지 — 레포에 없으면 에이전트에겐 없는 것이다.

### 4-2. 애플리케이션 가시성(Legibility) 향상

에이전트가 스스로 자기 작업을 검증할 수 있도록 만든 것들:

- **Chrome DevTools Protocol** 연동: 에이전트가 브라우저를 직접 구동하여 DOM 스냅샷, 스크린샷, 네비게이션으로 UI 동작 검증
- **Observability Stack**: 로그(LogQL), 메트릭(PromQL), 트레이스를 에이전트가 직접 조회
- **Git Worktree per task**: 각 변경사항마다 앱을 독립 부팅하여 에이전트가 격리된 환경에서 작업

결과: "ensure service startup completes in under 800ms" 같은 프롬프트가 실행 가능해진다.

> "We regularly see single Codex runs work on a single task for upwards of six hours (often while the humans are sleeping)."

### 4-3. 아키텍처와 Taste를 기계적으로 강제

> "By enforcing invariants, not micromanaging implementations, we let agents ship fast without undermining the foundation."

레이어드 도메인 아키텍처:

```
Types → Config → Repo → Service → Runtime → UI
```

이 방향으로만 의존성이 허용된다. Cross-cutting concerns(auth, 텔레메트리, feature flag)는 반드시 Providers를 통해서만 진입.

이를 구현하는 방법:
- **Custom Linters**: Codex가 직접 만든 린터로 구조 위반 자동 차단
- **Error messages**: 린트 에러 메시지에 수정 방법을 직접 삽입 → 에이전트가 스스로 수정
- **Structural tests**: 의존성 방향 위반을 테스트로 잡아냄

> "In a human-first workflow, these rules might feel pedantic or constraining. With agents, they become multipliers: once encoded, they apply everywhere at once."

### 4-4. Golden Principles + 자동 Garbage Collection

문제: Codex 처리량이 늘수록 AI가 불균일한 패턴을 누적시킨다.

초기에는 매주 금요일(주간 20%)을 "AI slop" 정리에 썼다 → 확장 불가능.

대신: **"Golden Principles"** 를 레포에 직접 인코딩하고, 백그라운드 Codex 태스크가 정기적으로 편차를 스캔하고 리팩터링 PR을 자동 생성.

예시 원칙:
- 독자 helper 대신 shared utility 패키지 우선
- 경계에서는 반드시 데이터 shape 파싱 (YOLO-style 탐침 금지)
- 타입드 SDK 또는 명시적 검증 필수

> "Technical debt is like a high-interest loan: it's almost always better to pay it down continuously in small increments than to let it compound and tackle it in painful bursts."

---

## 5. AI 시대 엔지니어에게 필요한 역량

원문을 기반으로 정리한 핵심 역량 5가지:

### 역량 1: 환경 설계 능력 (Environment Design)

코드를 쓰는 능력이 아니라, **에이전트가 올바른 코드를 쓸 수 있는 환경을 만드는 능력**.

- 레포 구조 설계 (지식이 어디에, 어떤 형태로 있어야 하나)
- 아키텍처 제약을 기계적으로 강제하는 시스템 구축
- 에이전트가 스스로 검증할 수 있는 도구 노출 (MCP, observability)

### 역량 2: 의도 명시 능력 (Intent Specification)

모호한 지시가 아니라 **목적 + 달성 조건** 을 기계가 실행 가능한 형태로 변환하는 능력.

- "버그 고쳐" (X) → "이 유저 저니 4개에서 span이 2초를 넘지 않아야 함" (O)
- 추상적 목표를 검증 가능한 기준으로 분해
- 허용되는 것과 허용되지 않는 것을 명확히 경계 설정

### 역량 3: 피드백 루프 설계 능력 (Feedback Loop Design)

에이전트가 실패했을 때 "어떤 역량이 빠졌는가"를 진단하고,
그것을 레포에 다시 반영하는 능력.

- 에이전트 실패를 신호로 읽는 사고방식
- 린터 에러 메시지를 교육적으로 설계
- 사람의 taste를 문서/툴링/구조 테스트로 인코딩
- Review feedback → AGENTS.md 업데이트 → 다음 에이전트 런에 자동 반영

### 역량 4: 아키텍처 판단력 (Architectural Judgment)

개별 구현을 마이크로매니징하지 않고, **불변식(invariant)을 설계**하는 능력.

- 어디에 경계가 필요하고, 어디서 자유를 줄 것인지 결정
- "지루한(boring)" 기술 선택의 가치 판단 (에이전트가 추론하기 쉬운 기술)
- 레이어별 의존성 방향 설계

> "Technologies often described as 'boring' tend to be easier for agents to model due to composability, API stability, and representation in the training set."

### 역량 5: 인간 판단의 복리화 (Compounding Human Judgment)

한 번의 판단이 코드베이스 전체에 자동으로 적용되도록 만드는 능력.

- 리뷰 코멘트 → 문서화 → 린트 규칙 → CI 자동화 파이프라인
- "Human taste is captured once, then enforced continuously on every line of code"
- Background 에이전트로 품질 기준을 지속 유지

---

## 6. 에이전트가 단일 프롬프트로 할 수 있게 된 것

5개월의 환경 구축 이후, Codex가 혼자 할 수 있게 된 것들:

- 코드베이스 현재 상태 검증
- 신고된 버그 재현
- 실패 영상 녹화
- 수정 구현
- 앱을 구동해서 수정 검증
- 해결 영상 녹화
- PR 오픈
- 에이전트·사람 피드백 대응
- 빌드 실패 감지 및 자동 복구

---

## 7. "아직 배우고 있는 것"

OpenAI도 인정하는 미지의 영역:

> "We're still learning where human judgment adds the most leverage and how to encode that judgment so it compounds."

> "Our most difficult challenges now center on designing environments, feedback loops, and control systems..."

> "Building software still demands discipline, but the discipline shows up more in the scaffolding rather than the code."

---

## 8. DIT 팀 적용 사례 분석

> 5인 팀 에이전트 분석 (2026-03-01) — GitHub, Slack, Notion, 코드베이스 교차 검증

### DIT 팀이 이미 하고 있는 것

DIT 팀의 현재 프로세스는 Harness Engineering의 4가지 핵심 실천과 놀랍도록 일치한다.

**① 레포지토리 = 지식의 Single Source of Truth**

- `CLAUDE.md`를 목차(map)로만 사용 ← `AGENTS.md` 목차 원칙과 동일
- dita 16개 + lucive 13개 = 29개 영구 Whitepaper 분산 저장 ← `docs/` 폴더 계층 원칙
- `00_issue.md` AC 포맷 (Given/When/Then + QA 스크립트) ← `exec-plans/` 실행 계획 문서
- 18개 Notion 동기화 스크립트로 외부 지식 레포 연동 ← 암묵지 레포 인입

**② 애플리케이션 가시성(Legibility) — 에이전트의 자기 검증**

- Chrome DevTools MCP 서버 + `c-do-chrome-test` ← Chrome DevTools Protocol 에이전트 연동
- `c-monitoring-live`, `c-monitoring-daily` 등 9개 모니터링 커맨드 ← Observability Stack 직접 조회
- Supabase MCP 6개 (local/staging/production × 2) + PostHog MCP ← 에이전트가 직접 인프라 조회
- Git Worktree per issue — 이슈번호 = 포트번호 자동 매핑 (40초 → **0.7초**) ← Git Worktree per task 격리
- `c-finalize` E2E 테스트 **최대 3회 자동 수정 루프** ← 에이전트 자기 검증 루프의 초기 구현
- TypeScript LSP MCP (cclsp) — 코드 분석 도구 에이전트 노출

**③ 아키텍처와 Taste의 (사람-매개) 강제**

- `code-reviewer` 에이전트 — 체크리스트 기반 아키텍처 패턴 준수 확인 ← Custom Linter (사람-매개)
- `code-reviewer`가 체크리스트 항목 추가/수정 담당 ← Golden Principles 인코딩
- `intent-validator` — AC 품질 검증 및 충족 여부 검증 ← 검증 가능한 기준 분해
- PostToolUse 훅으로 Prettier 자동 적용 ← Taste의 자동 강제 (기계적)
- `.next-ai` 빌드 디렉토리 분리 — AI 빌드 격리 ← 에이전트 격리 환경 설계

**④ Golden Principles (부분 구현)**

- `c-code-simplify` — 코드 가독성/유지보수성 개선 ← AI slop 정리 (수동 트리거)
- Whitepaper 코드 리뷰 체크리스트 — 아키텍처 원칙 명시 ← 원칙의 레포 인코딩

**규모 수치 (2026-03-01 기준):** 커맨드 47개, MCP 서버 11개, 에이전트 9개, 스크립트 18개, Worktree 격리 0.7초

---

### DIT 팀에서 아직 없는 것 (격차)

5인 팀 분석에서 식별된 Harness Engineering 대비 의미 있는 격차 5개:

**격차 1: 백그라운드 자동 품질 유지 에이전트 없음**

Harness Engineering에서는 백그라운드 Codex 태스크가 정기적으로 편차를 스캔하고 리팩터링 PR을 자동 생성한다. DIT는 `c-code-simplify`로 수동 트리거하거나 `c-finalize` 내에서만 실행. **상시 동작하는 품질 가디언이 없다.**

**격차 2: 기계적 아키텍처 강제 (Linter/Structural Test) 미흡**

Harness Engineering은 CI에서 Custom Linter가 아키텍처 위반을 자동 차단하고, 린트 에러 메시지에 수정 방법을 직접 삽입한다. DIT는 `code-reviewer`가 사람-매개로 검토. **에이전트가 실수해도 자동으로 잡히지 않는 영역이 있다.**

**격차 3: Notion SOT vs 레포 SOT 분리 문제**

Harness Engineering에서는 레포 자체가 SOT다. DIT는 Notion이 SOT이고 레포는 동기화 대상이며, Notion MCP는 불안정 상태. **에이전트 관점에서 SOT에 대한 신뢰 있는 접근이 불안정하다.** Slack 논의, 구글 닥스 결정이 Notion에 들어가지 않으면 에이전트에겐 없는 지식이 된다.

**격차 4: 에이전트 실패 → 시스템 개선 공식 루프 없음**

Harness Engineering: 에이전트 실패 → 빠진 역량 진단 → AGENTS.md 업데이트 → 다음 런에 반영. DIT는 `/c-memo`로 컨텍스트 기록 가능하지만 **에이전트 실패를 공식적으로 분류하고 Whitepaper/CLAUDE.md에 반영하는 구조화된 피드백 루프가 없다.**

**격차 5: 장기 자율 실행 인프라 미확인**

Harness Engineering: "single Codex runs work on a single task for upwards of six hours (often while the humans are sleeping)." DIT: 밤새 자율 실행하는 백그라운드 에이전트 인프라가 없다.

---

### DIT = "1인 에이전트 팀 리더" (새 관찰)

LinkedIn의 Full Stack Builder(APB)는 개인 한 명이 디자인+코딩+PM을 직접 수행한다. DIT 모델은 이와 다르다:

> DIT 엔지니어는 **에이전트 오케스트레이터** 다 — `database-analyst`, `robust-code-developer`, `code-reviewer`, `deep-researcher`를 한 명이 지휘하여 도메인 통합 역할을 수행한다.

- **1인 Full Stack Builder**: 한 명이 전부 직접 한다
- **1인 에이전트 팀 리더**: 한 명이 에이전트 팀을 운영하여 전부 처리한다

Harness Engineering 관점에서 DIT 모델이 더 진화된 형태다. 47개 커맨드와 11개 MCP 서버를 만드는 것 자체가 "에이전트가 올바른 코드를 쓸 수 있는 환경 설계"이며, DIT 팀이 의도적으로 Harness Engineering을 참조하지 않았더라도 동일한 방향으로 수렴했다.

---

## 9. 멘토링 관점에서의 시사점

이 글이 MirAI 프로젝트 및 멘티 교육에 주는 함의:

### 핵심 재정의

| 기존 관점 | Harness Engineering 관점 |
|---|---|
| "코드를 잘 짜는 것" | "에이전트가 잘 짤 수 있는 환경을 만드는 것" |
| "기능 구현" | "의도 명시 + 검증 기준 설계" |
| "디버깅 = 버그 찾기" | "디버깅 = 빠진 역량/문서/구조 찾기" |
| "문서화 = 부수작업" | "문서화 = 에이전트가 볼 수 있는 유일한 지식" |
| "리뷰 = 코드 검토" | "리뷰 = 다음 에이전트 런을 위한 규칙 생성" |

### 멘티들에게 가르쳐야 할 것

1. **"AI한테 뭘 시킬까"가 아니라 "AI가 실수 안 하려면 뭘 알아야 하나"를 먼저 생각하기**
2. **실패는 에이전트 탓이 아니라 환경 설계 실패 신호**
3. **자소서 PDF 파싱 → 질문 생성 파이프라인 = 작은 Harness 설계 실습**
4. **AGENTS.md (또는 README)를 지도(map)처럼 설계하기 (백과사전 금지)**
5. **문서화 = 다음 에이전트/사람이 볼 수 있는 유일한 지식임을 내면화**

---

## 10. 한 문장 요약

> **AI 시대의 엔지니어는 코드를 쓰는 사람이 아니라, 에이전트가 올바른 코드를 쓸 수 있는 환경(구조, 도구, 제약, 피드백 루프)을 설계하는 사람이다.**

---

## 참고 자료

- [OpenAI 원문](https://openai.com/index/harness-engineering/) — Ryan Lopopolo, Feb 11, 2026
- [InfoQ 분석](https://www.infoq.com/news/2026/02/openai-harness-engineering-codex/)
- [The Emerging Harness Engineering Playbook](https://www.ignorance.ai/p/the-emerging-harness-engineering)
- [Martin Fowler: Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html)
- [Harness Engineering Is Not Context Engineering](https://mtrajan.substack.com/p/harness-engineering-is-not-context)
- [claude-code-harness (chacha95)](https://github.com/chacha95/claude-code-harness) — Claude Code 기반 Harness Engineering 구현 사례 (Python+JS, `.claude/` 디렉토리 + CLAUDE.md 포함)

---

## 11. 엔지니어 역할 요약

> **핵심 한 줄:** "Humans steer. Agents execute."

### 기존 엔지니어 vs 하네스 엔지니어

| | 기존 | 하네스 엔지니어링 |
|--|--|--|
| 무엇을 만드나 | 코드 | 에이전트가 일할 수 있는 환경 |
| 어떻게 일하나 | 직접 실행 | 방향 설정 → 에이전트가 실행 |
| 핵심 역량 | 구현 능력 | 문제 정의 + 검증 설계 |
| 실패 처리 | 직접 디버그 | 에이전트가 실패하도록 설계 |

### 구체적으로 하는 일

1. **Acceptance Criteria 작성** — 에이전트에게 "무엇이 완료 상태인지" 명확히 정의
2. **가드레일 설정** — 에이전트가 넘으면 안 되는 경계 (아키텍처 불변 조건, 테스트 통과 기준 등)
3. **도구 선택과 연결** — 에이전트가 쓸 수 있는 도구 조합 설계
4. **출력 검증** — 에이전트 결과가 맞는지 판단하는 평가 기준 설계
5. **방향 수정** — 에이전트가 잘못된 방향으로 가면 개입해서 조정

### 핵심 전환

마이크로매니지먼트(줄 단위 검토) → **시스템 수준 판단**

에이전트를 믿고 맡기되, 에이전트가 제대로 작동하는 환경을 만드는 것이 엔지니어의 책임이다. 코딩 실력보다 **문제를 정확히 정의하는 능력**과 **결과를 검증하는 판단력**이 더 중요해진다.
