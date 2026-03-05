# MirAI 개발 명세서

> **기준 문서:** `MirAI_proposal.md` §2-2 서비스 7가지 핵심 기능
> **최종 업데이트:** 2026-03-05

---

## 1. 전체 기능 범위

| # | 기능 | Step | 구현 순위 |
|---|------|------|---------|
| 01 | PDF 구조화 및 자소서 기반 맞춤 질문 생성 | Step 1 — 서류 분석 | ⭐ MVP |
| 02 | 이력서·자소서 피드백 및 서류 강점·약점 분석 | Step 1 — 서류 분석 | Phase 3 |
| 03 | 3인 1조 페르소나 패널 면접 시스템 | Step 2 — 실전 시뮬레이션 | Phase 1 |
| 04 | 실시간 꼬리질문 엔진 (Clarify · Challenge · Explore) | Step 2 — 실전 시뮬레이션 | Phase 1 |
| 05 | 연습 모드 및 즉각 피드백 시스템 | Step 3 — 몰입형 환경 | Phase 3 |
| 06 | 실시간 AI 아바타 및 TTS 기반 몰입형 면접 | Step 3 — 몰입형 환경 | Phase 4 |
| 07 | 8축 역량 평가 및 실행형 리포트 | Step 4 — 심층 피드백 | Phase 2 |

---

## 2. 공통 기술 스택

### 엔진 (engine/ — FastAPI, Python)

| 구분 | 기술 | 용도 |
|------|------|------|
| **서버** | Python FastAPI | API 엔드포인트 |
| **언어** | Python 3.12+ | — |
| **타입 시스템** | Pydantic v2 (`schemas.py`) | 요청·응답 모델 |
| **설정 관리** | pydantic-settings (`config.py`) | 환경변수 |
| **AI** | `anthropic` Python SDK | LLM 호출 (`app/services/`에서만) |
| **PDF 처리** | PyMuPDF (`fitz`) | 텍스트 추출 (`app/parsers/`에서만) |
| **테스트** | pytest | 단위·통합 테스트 |

### 서비스 (services/ — Next.js, TypeScript)

| 구분 | 기술 | 용도 |
|------|------|------|
| **프론트엔드** | Next.js (App Router) | 라우트·UI·상태 관리 |
| **스타일** | Tailwind CSS v4 | 레이아웃·컴포넌트 |
| **언어** | TypeScript (strict) | 타입 안전성 |
| **인증** | Better Auth | 사용자 인증 (서비스에서만) |
| **ORM / DB** | Prisma + PostgreSQL | 데이터 저장 (서비스가 소유) |
| **TTS** | Phase 4 확정 예정 | 음성 인터랙션 |
| **테스트** | Vitest | 단위 테스트 |
| **E2E 테스트** | Playwright (Week 2 도입 예정) | 전체 흐름 통합 테스트 |

### 인프라 (AWS)

| 구분 | 기술 | 용도 | 도입 시점 |
|------|------|------|---------|
| **컴퓨트** | EC2 + ALB | 서비스·엔진 호스팅, 트래픽 분산 | Week 1 |
| **도메인** | Route53 | 도메인 연결 | Week 1 |
| **보안** | WAF + HTTPS | 웹 방화벽, TLS 인증서 | Week 1 |
| **파일 저장** | S3 | PDF 자소서 업로드 저장 | Week 2 |
| **CDN** | CloudFront | 정적 에셋 배포 | Week 2 |
| **컨테이너** | Docker + ECR | 이미지 빌드·레지스트리 | Week 2 |
| **CI/CD** | GitHub Actions | 자동 테스트·배포 파이프라인 | Week 2 |
| **스케일링** | ALB 오토 스케일링 | 트래픽 급증 대응 | Week 3 |

> **1차 출시(Week 1) 최소 인프라:** EC2 + ALB + Route53 + WAF + HTTPS. S3·CloudFront·Docker는 Week 2 Beta 릴리스에 추가.

### 통신

```
[유저] → [Next.js 서비스 (Better Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]
```

- `ENGINE_BASE_URL` 환경변수, 타임아웃 30초
- 에러: FastAPI → JSON → 서비스에서 유저 메시지로 변환

> **아키텍처 불변식 (위반 시 CI 차단):**
> 1. 인증은 서비스(Next.js)에서만 — 엔진은 인증 로직 없이 내부 호출만 수신
> 2. 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM을 호출하지 않는다
> 3. 서비스 간 직접 통신 금지 — 공유 로직은 엔진으로
> 4. DB는 서비스가 소유 — 엔진은 stateless, 데이터 저장은 서비스 책임
> 5. 테스트 없는 PR은 머지 금지

---

## 3. 개발 원칙

| 레이어 | 원칙 | 설명 |
|--------|------|------|
| **엔진** | 기술 레이어 + TDD | 파서·LLM·프롬프트 레이어 명확 분리. AC = 첫 번째 테스트. Red → Green → Refactor |
| **서비스** | DDD + TDD | 도메인 중심 설계 1순위, 구현 전 테스트 작성 2순위. AC = 첫 번째 테스트 |

**Outside-In 개발 순서:** 서비스(Next.js) API 라우트가 먼저 인터페이스를 정의하고, 엔진(FastAPI)은 그 계약을 구현한다. 서비스 껍데기 → 엔진 설계 → 엔진 구현 순으로 진행.

> 프롬프트 템플릿은 `engine/app/prompts/`에서 버전 관리. 기능별 Claude 지침은 이 디렉토리의 파일로 분리한다.

---

## 4. 기능별 명세


---

### 기능 01 — PDF 구조화 및 자소서 기반 맞춤 질문 생성 ⭐ MVP

**기능 정의:** PDF 자소서를 업로드하면 프로젝트 경험·직무 역량·기술 키워드를 추출하고, 단순 키워드 매칭이 아닌 서술된 성과와 과정에서 파생될 실전형 질문 리스트를 생성한다. 이후 모든 기능의 기반 데이터 엔진이 된다.

**시스템 흐름:**
```
PDF 업로드
  → POST /api/resume/questions (Next.js 서비스)
  → HTTP REST → FastAPI 엔진
  → engine/app/parsers/: PDF → 텍스트 추출 (PyMuPDF)
  → engine/app/services/: 텍스트 → 맞춤 질문 생성 (Claude)
  → 결과 화면: 카테고리별 질문 리스트
```

**API: POST /api/resume/questions**

요청: `multipart/form-data`, `file` (PDF, 최대 5MB / 10페이지 권장)

응답 (200):
```json
{
  "resumeId": "resume-abc123",
  "questions": [
    { "category": "직무 역량", "question": "OO 프로젝트에서 담당한 역할과 결과를 설명해 주세요." },
    { "category": "경험의 구체성", "question": "해당 경험에서 갈등이 있었다면 어떻게 해결했나요?" }
  ],
  "meta": {
    "extractedLength": 3200,
    "categoriesUsed": ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]
  }
}
```

에러: `400` 파일 없음/비PDF/크기 초과, `500` 파싱 실패/LLM 오류 (한국어 메시지)

**Claude 프롬프트 지침:**
- 역할: "자소서 기반 면접 예상 질문 생성 전문가"
- 카테고리: 직무 역량 / 경험의 구체성 / 성과 근거 / 기술 역량
- 카테고리당 2~5개, 총 8~20개
- 자소서에 없는 내용은 질문하지 않음
- 출력: JSON 배열 `[{ "category": "...", "question": "..." }]`

**화면 상태:** `idle` → `uploading` → `processing` → `done` / `error`

**1차 출시 제외 항목:** 회원가입·결제·DB 저장·S3 파일 저장(Week 2 도입)·꼬리질문·페르소나·8축 평가·오디오

> Week 1 MVP에서 PDF는 멀티파트 업로드 후 서버 메모리에서 직접 파싱. S3 저장은 Week 2 Beta에 추가.

---

### 기능 02 — 이력서·자소서 피드백 및 서류 강점·약점 분석

**기능 정의:** 기능01에서 파싱된 서류를 5개 항목으로 종합 진단하고, 지원 직무 기준 강점·약점을 도출하여 면접관 시각에서 구체적 개선 방향을 제시한다.

**진단 항목 (5개):**
1. 서술의 구체성 (수치·사례 포함 여부)
2. 성과 수치의 명확성
3. 논리 구조 (서론-본론-결론 흐름)
4. 직무 적합성 (지원 직무 핵심 역량 반영도)
5. 차별성 (타 지원자 대비 독자성)

**API: POST /api/resume/feedback**

요청:
```json
{ "resumeText": "...", "targetRole": "백엔드 개발자" }
```

응답 (200):
```json
{
  "scores": {
    "specificity": 72,
    "achievementClarity": 65,
    "logicStructure": 80,
    "roleAlignment": 88,
    "differentiation": 60
  },
  "strengths": ["..."],
  "weaknesses": ["..."],
  "suggestions": [
    { "section": "성장 경험", "issue": "수치 근거 없음", "suggestion": "'30% 개선'과 같은 구체적 수치 추가 권장" }
  ]
}
```

**Claude 프롬프트 지침:**
- 역할: "채용 전문 서류 컨설턴트"
- 5개 항목 각 0~100점 산출
- 강점 2~3개, 약점 2~3개, 섹션별 구체 개선 제안 포함
- 한국어 출력, 면접관 시각 유지

---

### 기능 03 — 3인 1조 페르소나 패널 면접 시스템

**기능 정의:** 한 세션에서 3종 페르소나가 동시에 면접관으로 참여하는 패널 면접 형식. 각 페르소나는 고유한 관점과 질문 스타일을 가진다.

**페르소나 정의:**

| 페르소나 | 역할 | 검증 포인트 |
|--------|------|-----------|
| HR 담당자 | 조직 적합성·협업 태도·인성 | 경험의 맥락, 팀 내 역할, 가치관 |
| 기술팀장 | 직무 역량·문제 해결·기술 깊이 | 구체적 구현 방법, 기술 판단력 |
| 경영진 | 성장 가능성·비전·비즈니스 임팩트 | 장기적 기여 가능성, 전략적 사고 |

**API: POST /api/interview/start**

요청:
```json
{
  "resumeId": "session-abc",
  "mode": "panel",
  "personas": ["hr", "tech_lead", "executive"],
  "interviewMode": "real"
}
```

> **`interviewMode`**: `"real"` | `"practice"`
> - `"real"` (실전 모드): 세션 중 즉각 피드백 차단. 종료 후 8축 리포트(기능07)에서만 평가 제공
> - `"practice"` (연습 모드): `/api/interview/answer` 응답에 `feedback` 필드 포함 (기능05 `/api/practice/feedback` 연동). 클라이언트가 별도 호출하거나 서버가 인라인 반환 — 구현 시 결정 (→ `ux_flow.md` Open Questions)

응답:
```json
{
  "sessionId": "int-xyz",
  "firstQuestion": {
    "persona": "hr",
    "personaLabel": "HR 담당자",
    "question": "자기소개와 함께 이 역할에 지원한 동기를 말씀해 주세요."
  }
}
```

**API: POST /api/interview/answer**

요청:
```json
{ "sessionId": "int-xyz", "answer": "..." }
```

응답:
```json
{
  "nextQuestion": {
    "persona": "tech_lead",
    "personaLabel": "기술팀장",
    "question": "OO 프로젝트에서 사용한 기술 스택 선택 이유를 설명해 주세요.",
    "type": "follow_up"
  },
  "sessionComplete": false
}
```

**Claude 프롬프트 지침:**
- 각 페르소나 system prompt에 역할·검증 포인트·질문 스타일 명시
- 자소서 내용 기반으로 질문 개인화
- 패널 순서: HR → 기술팀장 → 경영진 (또는 동적 조율)

---

### 기능 04 — 실시간 꼬리질문 엔진 (Clarify · Challenge · Explore)

**기능 정의:** 지원자 답변을 분석하여 3가지 유형 중 가장 적합한 꼬리질문을 즉각 생성한다. 단순 질문 나열이 아닌 답변 맥락 기반 압박 면접 경험을 제공한다.

**꼬리질문 유형:**

| 유형 | 목적 | 생성 조건 |
|------|------|---------|
| **CLARIFY** | 불명확한 부분 재확인 | 답변에 모호한 표현, 주어 불명확, 수치 없음 |
| **CHALLENGE** | 논리적 근거 검증 | 주장만 있고 근거 없음, 일반론적 답변 |
| **EXPLORE** | 경험의 심층 탐색 | 흥미로운 경험 언급, 더 깊이 파고들 여지 있음 |

**API: POST /api/interview/followup**

요청:
```json
{
  "sessionId": "int-xyz",
  "question": "팀 갈등을 해결한 경험을 말씀해 주세요.",
  "answer": "커뮤니케이션을 통해 해결했습니다."
}
```

응답:
```json
{
  "followupType": "CLARIFY",
  "followupQuestion": "구체적으로 어떤 방식의 커뮤니케이션을 사용하셨나요? 회의, 1:1 면담, 문서화 등 어떤 방법을 선택하셨는지 설명해 주세요.",
  "reasoning": "답변이 너무 일반적이어서 구체적 방법론 확인 필요"
}
```

**Claude 프롬프트 지침:**
- 입력: 원질문 + 지원자 답변 + 자소서 컨텍스트
- 출력: `{ "type": "CLARIFY"|"CHALLENGE"|"EXPLORE", "question": "...", "reasoning": "..." }`
- 유형 판단 기준을 system prompt에 명시
- 꼬리질문은 단답 유도가 아닌 구체적 서술 유도

> **꼬리질문 흐름 정리:**
> - 기본 흐름: `/api/interview/answer` 응답에 꼬리질문 포함 (기능04 내장)
> - `/api/interview/followup`: 수동 재요청 또는 별도 꼬리질문 트리거 시 사용

---

### 기능 05 — 연습 모드 및 즉각 피드백 시스템

**기능 정의:** "짧은 과제 → 즉각 피드백 → 교정"의 의지적 연습 순환 구조. 답변 가이드, 키워드 추천, 이전 답변과의 비교 분석을 제공한다.

**모드 구분:**

| 모드 | 설명 |
|------|------|
| **가이드 모드** | 답변 전 핵심 키워드·구조 힌트 제공 |
| **자유 모드** | 힌트 없이 답변 → 즉각 피드백 |
| **비교 모드** | 이전 답변과 수정 답변 나란히 비교 |

**API: POST /api/practice/feedback**

요청:
```json
{
  "question": "갈등 해결 경험을 말씀해 주세요.",
  "answer": "...",
  "previousAnswer": "..."
}
```

> `previousAnswer`: 비교 모드 시 포함. 생략 시 단일 답변 피드백.

응답:
```json
{
  "score": 72,
  "feedback": {
    "good": ["상황 설명이 구체적임", "본인 역할 명확"],
    "improve": ["결과의 수치화 필요", "학습 포인트 미언급"]
  },
  "keywords": ["STAR 구조", "정량적 성과", "재발 방지"],
  "improvedAnswerGuide": "상황: ... / 행동: ... / 결과: (수치 포함) ...",
  "comparisonDelta": { "specificity": 12, "logic": 5 }
}
```

> `comparisonDelta`: 비교 모드 시 포함 (이전 답변 대비 delta). 생략 시 단일 피드백.

---

### 기능 06 — 실시간 AI 아바타 및 TTS 기반 몰입형 면접

**기능 정의:** 텍스트 기반 연습의 한계를 넘어 실제 면접 긴장감을 재현하는 몰입형 환경. 비언어적 역량(시선 처리, 말하는 속도, 침묵 대처)까지 훈련한다.

**구성 요소:**

| 요소 | 기술 | 설명 |
|------|------|------|
| AI 아바타 | (TBD: D-ID / HeyGen API 등) | 실제 면접관처럼 말하고 반응하는 영상 아바타 |
| TTS | (TBD: ElevenLabs / Clova Voice 등) | 자연스러운 음성 질문 생성 |
| STT | (TBD: Whisper API 등) | 지원자 음성 답변 텍스트 변환 |
| 비언어 분석 | (Phase 4 검토) | 시선·속도·침묵 피드백 |

> **Phase 4 진입 시 기술 확정 필요.** TTS·STT·아바타 API 선정 후 명세 업데이트.

**기본 흐름:**
```
아바타 면접관 음성 질문
  → STT: 지원자 음성 답변 → 텍스트
  → 꼬리질문 엔진 (기능04) 연동
  → TTS: 다음 질문 음성 출력
  → 반복
```

---

### 기능 07 — 8축 역량 평가 및 실행형 리포트

**기능 정의:** 면접 세션 전체를 분석하여 8개 역량 축에 걸쳐 정량적 점수를 산출하고, 역량 성장 곡선과 함께 실행 가능한 개선 로드맵을 제공한다.

**진입 조건:** 답변 5개 이상 후 세션 종료 시 리포트 생성. 미만 시 `"질문을 더 진행해 주세요"` 안내 반환.

**8개 역량 축:** (MirAI_proposal.md §5-2 기능07 기준)

| # | 역량 축 | 평가 기준 |
|---|--------|---------|
| 1 | 의사소통 | 명확성·간결성·전달력 |
| 2 | 문제해결 | 구체적 해결 방식·판단 근거 |
| 3 | 논리적 사고 | 주장-근거-결론 일관성 |
| 4 | 직무 전문성 | 기술 지식·문제 해결 구체성 |
| 5 | 조직 적합성 | 협업 태도·가치관 일치 |
| 6 | 리더십 | 주도성·팀 기여·의사결정 |
| 7 | 창의성 | 독창적 접근·새로운 관점 |
| 8 | 성실성 | 학습 의지·꾸준함·책임감 |

> `growthCurve`는 DB 도입 이후 제공 예정. 1차 출시(세션/메모리 기반)에서는 `null` 반환.

**API: POST /api/report/generate**

요청:
```json
{ "sessionId": "int-xyz" }
```

응답:
```json
{
  "scores": {
    "communication": 70, "problemSolving": 65, "logicalThinking": 82,
    "jobExpertise": 78, "cultureFit": 88, "leadership": 75,
    "creativity": 60, "sincerity": 55
  },
  "totalScore": 72,
  "summary": "논리적 사고와 조직 적합성이 강점. 창의성과 성실성 표현 보완 필요.",
  "actionItems": [
    { "axis": "창의성", "issue": "CHALLENGE 꼬리질문 시 새로운 관점 제시 부족", "action": "답변에 대안적 접근 한 가지를 추가로 준비" }
  ],
  "growthCurve": null
}
```

---

## 5. 구현 로드맵

| 단계 | 기능 | 사용자에게 전달되는 가치 |
|------|------|--------------------------|
| **MVP** | 기능 01 — 자소서 맞춤 질문 생성 | "내 서류에서 이런 질문이 나오는구나" 아하 모먼트 |
| **Phase 1** | 기능 03·04 — 패널 면접 + 꼬리질문 | 실전 패널 면접 체험, 꼬리질문 대응력 훈련 |
| **Phase 2** | 기능 07 — 8축 역량 리포트 | 명확한 성장 기준점, 지속 사용 동기 |
| **Phase 3** | 기능 05·02 — 연습 모드 + 서류 진단 | 반복 연습 루프, 서류·면접 원스톱 준비 |
| **Phase 4** | 기능 06 — AI 아바타 면접 | 실전 긴장감 훈련, 비언어적 역량 강화 |

---

## 6. 환경 변수

```
# 엔진 (engine/)
ANTHROPIC_API_KEY    Claude API 호출
CLAUDE_MODEL         사용 모델 (기본값: claude-sonnet-4-6)

# 서비스 (services/)
ENGINE_BASE_URL      FastAPI 엔진 주소 (타임아웃 30초)
DATABASE_URL         PostgreSQL 연결 문자열 (Prisma)
BETTER_AUTH_SECRET   Better Auth 세션 서명 키

# AWS (Week 2 추가)
AWS_REGION           S3·ECR 리전
AWS_ACCESS_KEY_ID    IAM 접근 키
AWS_SECRET_ACCESS_KEY IAM 시크릿 키
S3_BUCKET_NAME       PDF 업로드 버킷명
CLOUDFRONT_URL       CDN 퍼블릭 URL

# Phase 4 추가 예정
TTS_API_KEY          TTS 서비스 키
STT_API_KEY          STT 서비스 키
AVATAR_API_KEY       아바타 서비스 키
```

---

> 기능01 원본 명세는 `../mvp/dev_spec.md`에 보존되어 있다.
> 기능06 기술 스택(TTS·STT·아바타 API)은 Phase 4 진입 시 확정하여 이 문서를 업데이트한다.
