# MirAI 프로젝트 운영 계획

> 작성: 2026-03-01 / 멘토: 이왕원
> 기간: 2026년 3월 1일 ~ 3월 31일 (4주)
> 프로젝트: MirAI (모의면접관 페르소나 생성/검증 시스템)

**역할 분리**

엔진은 멘토·멘티 전원이 함께 만든다. 단, 다음 영역은 멘토가 주도한다:

| 멘토 주도 영역 | 내용 |
|--------------|------|
| **프로젝트 세팅** | 레포 구조, AGENTS.md 초기 설계, 온보딩 환경 |
| **에이전트 동작 환경** | CI, pre-commit, 불변식 정의, exec-plans 구조 |
| **에이전트 정의** | 어떤 에이전트가 어떤 역할을 하는지 설계 |
| **PM** | 프로덕트 방향, 우선순위, 스코프 통제 |

멘티는 이 환경 안에서 기능을 정의하고 구현한다. 하네스 운영 방식을 관찰하면서 에이전트에게 일 시키는 법을 익히고, 여유가 생기면 환경 개선에 기여한다.

---

## 1. 레포 구조

공통 엔진 위에 개인 서비스가 올라가는 구조로 운영한다.

```
mirai/                          ← monorepo
├── AGENTS.md                   ← 전체 목차 (백과사전 금지)
├── docs/                       ← 프로젝트 문서 (SOT)
│   ├── whitepaper/             기획서·운영 계획
│   ├── specs/                  기능 명세 (기능 01~07)
│   ├── background/             배경 자료·리서치·경쟁사 분석
│   ├── meetings/               회의록
│   ├── onboarding/             환경 설정·기여 가이드
│   └── work/                   이슈별 작업 내역 (active/done)
│
├── engine/                     ← FastAPI (Python), 전원 공동 설계
│   ├── app/
│   │   ├── main.py             FastAPI 앱 진입점
│   │   ├── config.py           환경변수 (ANTHROPIC_API_KEY 등)
│   │   ├── schemas.py          Pydantic 모델 (요청·응답 타입)
│   │   ├── parsers/            PDF → 텍스트 추출 (PyMuPDF)
│   │   ├── services/           LLM API 호출 (Claude)
│   │   ├── prompts/            프롬프트 템플릿 + 버전 관리
│   │   └── routers/            API 엔드포인트 (/resume, /interview 등)
│   ├── tests/                  pytest 테스트
│   │   └── fixtures/           테스트 데이터 (샘플 PDF, 예상 응답 JSON)
│   └── pyproject.toml          Python 프로젝트 설정
│
└── services/                   ← Next.js 풀스택 (TypeScript), 1인 1서비스
    ├── siw/                    성시우
    ├── kwan/                   김관우
    ├── seung/                  이승현
    └── lww/                    이왕원
        ├── src/app/            Next.js App Router (페이지·API 라우트)
        ├── tests/              Vitest 테스트
        │   └── fixtures/       테스트 데이터
        ├── prisma/             DB 스키마 (PostgreSQL)
        └── package.json        Better Auth, Tailwind, Prisma 등
```

**핵심:** 기술 파트를 나누지 않는다. 1명이 서비스 1개를 프론트·백·배포 포함해서 처음부터 끝까지 만든다.

---

## 2. 엔진 vs 서비스

| | 엔진 (engine/) | 서비스 (services/각자/) |
|--|--|--|
| 누가 만드나 | 멘토 + 멘티 전원 | 1명이 전부 |
| 무엇을 만드나 | 공통 파서·LLM·프롬프트 레이어 | 프론트·백엔드·배포 포함한 완성형 제품 |
| 기술 스택 | **FastAPI (Python)** | **Next.js 풀스택 (TypeScript)** |
| 설계 방식 | 기술 레이어 + TDD | DDD + TDD |
| 하네스 실천 | 불변식·AC·피드백 루프 공동 설계 | 엔진 위에서 서비스 전체 설계 경험 |

### 통신 구조

```
[유저] → [Next.js (Better Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]
```

- 서비스 → 엔진: HTTP REST (`ENGINE_BASE_URL` 환경변수, 타임아웃 30초)
- 인증: **서비스 게이트웨이 패턴** — Next.js가 인증 처리, FastAPI는 내부 호출만 수신
- 에러 전파: FastAPI → JSON 에러 → Next.js에서 유저 메시지로 변환

### 개발 원칙

**엔진 — 기술 레이어 구조 + TDD (Test-Driven Development, 테스트 주도 개발)**
파서·LLM·프롬프트 레이어를 명확하게 분리. 구현 전 테스트를 먼저 작성한다. AC = 첫 번째 테스트. Red → Green → Refactor.

**서비스 — DDD (Domain-Driven Design, 도메인 주도 설계) 1순위, TDD 2순위**
각자의 서비스는 도메인 중심으로 설계한다. 비즈니스 로직(면접 코칭)이 기술 구현보다 앞선다.
구현 전 테스트를 먼저 작성한다. AC(인수 조건) = 첫 번째 테스트. Red → Green → Refactor.

### 아키텍처 불변식 (위반 시 CI 차단)

```
1. 인증은 서비스(Next.js)에서만 — 엔진은 인증 로직 없이 내부 호출만 수신
2. 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM을 호출하지 않는다
3. 서비스 간 직접 통신 금지 — 각 서비스는 독립적, 공유 로직은 엔진으로
4. DB는 서비스가 소유 — 엔진은 stateless, 데이터 저장은 서비스 책임
5. 테스트 없는 PR은 머지 금지
```

**핵심 규칙:** "카톡/노션에서 논의한 결정이 레포에 없으면 에이전트에겐 없는 것이다."

---

## 3. 4주 커리큘럼

**구조:** 엔진과 서비스를 처음부터 병행한다. 서비스 껍데기가 엔진의 인터페이스를 정의한다 (outside-in).

| 주차 | 제목 | 핵심 내용 |
|------|------|-----------|
| **Week 1** (3/1~3/7) | 기획 + 세팅 + MVP + 배포 | 기획 구체화, 프로젝트 세팅, MVP 구현, AWS(EC2·ALB·Route53·WAF·HTTPS) |
| **Week 2** (3/8~3/14) | Beta 구현 | 전체 기능 구현, 가입, S3, CloudFront, Docker/ECR, CI/CD, E2E 테스트 |
| **Week 3** (3/15~3/21) | 마케팅 + 유지보수 | 커뮤니티 홍보, 유저 피드백 수집, 유지보수, 오토 스케일링 + 스트레스 테스트 |
| **Week 4** (3/22~3/28) | 버퍼 + 마무리 | 밀린 작업 소화, 포트폴리오 작성, peer review, 블로커 해소 |

**프로젝트 성공 기준:** 실제 유저 **10명 이상**이 서비스를 사용하고 피드백을 남긴다.

---

### Week 1 (3/1~3/7): 기획 + 세팅 + MVP + 배포

기획 구체화, 하네스 엔지니어링 기반 프로젝트 세팅, MVP 구현, AWS 배포까지 한 주에 완료.

**기획 + 세팅** (멘토 주도)
- `AGENTS.md` 목차, 기능 상세 기획 (`MirAI_proposal.md` v2)
- 기술 스택 확정: Next.js 풀스택 (서비스) + FastAPI (엔진) + Better Auth + PostgreSQL + Prisma
- 프로젝트 구조 세팅 (레포·.ai.md·불변식·온보딩)
- `engine/.ai.md` 계약 정의 (타입·불변식·API)

**MVP 구현** (전원)
- 핵심 흐름 작동 (자소서 업로드 → 질문 생성)
- `engine/parsers/pdf_parser` + `engine/services/llm_service` 기본 구현

**AWS 배포** (멘토 주도)
- EC2 + ALB + Route53 (도메인 연결)
- WAF + HTTPS 적용
- 배포 URL 실제 접속 가능

---

### Week 2 (3/8~3/14): Beta 구현

기획서 전체 기능 구현 + 인프라 고도화. Beta 릴리스를 목표로 제품 수준에 도달하는 주.

**서비스** (멘토 + 전원)
- 기획서 기능 전체 구현
- 회원가입/인증 (Better Auth)
- S3 파일 업로드 연동
- CloudFront CDN 적용

**인프라 + CI/CD** (멘토 + 전원)
- Dockerize + ECR 푸시
- GitHub Actions CI/CD (자동 배포)
- E2E 테스트

---

### Week 3 (3/15~3/21): 마케팅 + 유지보수

서비스를 알리고, 유저 피드백 기반으로 유지보수 + 추가 기능 개발.

- 관련 커뮤니티 홍보 (취준 카페, 개발자 커뮤니티 등)
- 유저 피드백 수집 (폼 또는 DM)
- 피드백 기반 유지보수 + 버그 수정
- 추가 기능 개발 (우선순위별)
- ALB 오토 스케일링 설정 + 스트레스 테스트

**성공 기준:** 팀 합산 실제 유저 **10명 이상** 피드백 수집

---

### Week 4 (3/22~3/28): 버퍼 + 마무리

밀린 작업 소화, 포트폴리오 작성, 최종 마무리.

- 밀린 작업 소화 + 완성도 보완
- 포트폴리오 README (기여 + 서비스 + 의사결정 기록)
- peer review 코멘트 (서비스 ↔ 엔진 경계 확인)
- 예상치 못한 블로커 해소

---

## 참고 문서

- `MVP_proposal.md` — 서비스 기획서 원본 (v1)
- `MirAI_proposal.md` — 서비스 기획서 최신판 (v2, 팀 운영 기준)
- `growth_strategy_fullstack_builder.md` — 성장 전략 + 멘티별 현황 + 멘토 역할
- `harness_engineering_analysis.md` — Harness Engineering 원문 분석 (OpenAI, Feb 2026)
- `dev_job_market_2026.md` — 채용시장 분석
