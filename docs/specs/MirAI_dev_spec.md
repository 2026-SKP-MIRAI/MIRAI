# MirAI 개발 명세서

> **기준 문서:** `MirAI_proposal.md` §2-2 서비스 7가지 핵심 기능
> **최종 업데이트:** 2026-03-04

---

## 1. 전체 기능 범위

| # | 기능 | Step | 구현 순위 |
|---|------|------|---------|
| 01 | PDF 구조화 및 자소서 기반 맞춤 질문 생성 | Step 1 — 서류 분석 | ⭐ MVP (Week 1) |
| 02 | 이력서·자소서 피드백 및 서류 강점·약점 분석 | Step 1 — 서류 분석 | Week 2 |
| 03 | 3인 1조 페르소나 패널 면접 시스템 | Step 2 — 실전 시뮬레이션 | Week 2 |
| 04 | 실시간 꼬리질문 엔진 (Clarify · Challenge · Explore) | Step 2 — 실전 시뮬레이션 | Week 2 |
| 05 | 연습 모드 및 즉각 피드백 시스템 | Step 3 — 몰입형 환경 | Week 3 |
| 06 | 실시간 AI 아바타 및 TTS 기반 몰입형 면접 | Step 3 — 몰입형 환경 | Week 3 |
| 07 | 8축 역량 평가 및 실행형 리포트 | Step 4 — 심층 피드백 | Week 3 |

---

## 2. 공통 기술 스택

| 구분 | 기술 | 용도 |
|------|------|------|
| **프론트엔드** | Next.js (App Router) | 라우트·UI·상태 관리 |
| **스타일** | Tailwind CSS v4 | 레이아웃·컴포넌트 |
| **언어** | TypeScript (strict) | 타입 안전성 |
| **AI** | Anthropic Claude API | 질문 생성·꼬리질문·피드백·평가 |
| **PDF 처리** | `pdf-parse` (Node.js) | 서버 측 텍스트 추출 |
| **TTS** | (Week 3 확정 예정) | 음성 인터랙션 |
| **스토리지 (1차 출시)** | 세션/메모리 | DB·회원 미도입 |

> **엔진 불변식**: LLM 호출 → `engine/services/`, PDF 파싱 → `engine/parsers/`

---

## 3. 기능별 명세

---

### 기능 01 — PDF 구조화 및 자소서 기반 맞춤 질문 생성 ⭐ MVP

**기능 정의:** PDF 자소서를 업로드하면 프로젝트 경험·직무 역량·기술 키워드를 추출하고, 단순 키워드 매칭이 아닌 서술된 성과와 과정에서 파생될 실전형 질문 리스트를 생성한다. 이후 모든 기능의 기반 데이터 엔진이 된다.

**시스템 흐름:**
```
PDF 업로드
  → POST /api/resume/upload
  → engine/parsers/pdf_parser: Buffer → 텍스트 추출
  → POST /api/resume/questions
  → engine/services/llm_service: 텍스트 → 맞춤 질문 생성
  → 결과 화면: 카테고리별 질문 리스트
```

**API: POST /api/resume/questions**

요청: `multipart/form-data`, `file` (PDF, 최대 5MB / 10페이지 권장)

응답 (200):
```json
{
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

**1차 출시 제외 항목:** 회원가입·결제·DB 저장·꼬리질문·페르소나·8축 평가·오디오

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
  "personas": ["hr", "tech_lead", "executive"]
}
```

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
- 출력: `{ type: "CLARIFY"|"CHALLENGE"|"EXPLORE", question: "...", reasoning: "..." }`
- 유형 판단 기준을 system prompt에 명시
- 꼬리질문은 단답 유도가 아닌 구체적 서술 유도

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
  "previousAnswer": "..." // 비교 모드 시 포함
}
```

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
  "comparisonDelta": { "specificity": +12, "logic": +5 } // 비교 모드 시
}
```

---

### 기능 06 — 실시간 AI 아바타 및 TTS 기반 몰입형 면접

**기능 정의:** 텍스트 기반 연습의 한계를 넘어 실제 면접 긴장감을 재현하는 몰입형 환경. 비언어적 역량(시선 처리, 말하는 속도, 침묵 대처)까지 훈련한다.

**구성 요소:**

| 요소 | 기술 | 설명 |
|------|------|------|
| AI 아바타 | (TBD: D-ID / HeyGen API 등) | 실제 면접관처럼 말하고 반응하는 영상 아바타 |
| TTS | (TBD: ElevenLabs / Clova Voice 등) | 자연스러운 음성 질문 생성 |
| STT | (TBD: Whisper API 등) | 지원자 음성 답변 텍스트 변환 |
| 비언어 분석 | (Week 3 검토) | 시선·속도·침묵 피드백 |

> **Week 3 기술 확정 필요.** TTS·STT·아바타 API 선정 후 명세 업데이트.

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

**8개 역량 축:** (기획서 기준, 세부 축명은 Week 2~3 확정)

| # | 역량 축 | 평가 기준 |
|---|--------|---------|
| 1 | 직무 전문성 | 기술 지식·문제 해결 구체성 |
| 2 | 경험의 구체성 | STAR 구조·수치 근거·상황 묘사 |
| 3 | 논리적 사고 | 주장-근거-결론 일관성 |
| 4 | 커뮤니케이션 | 명확성·간결성·전달력 |
| 5 | 조직 적합성 | 협업 태도·가치관 일치 |
| 6 | 성장 가능성 | 학습 의지·변화 수용력 |
| 7 | 비즈니스 임팩트 | 성과 지향성·전략적 사고 |
| 8 | 압박 대응력 | 꼬리질문 대응·논리 방어 |

**API: POST /api/report/generate**

요청:
```json
{ "sessionId": "int-xyz" }
```

응답:
```json
{
  "scores": {
    "jobExpertise": 78, "experienceClarity": 65, "logicalThinking": 82,
    "communication": 70, "cultureFit": 88, "growthPotential": 75,
    "businessImpact": 60, "pressureResponse": 55
  },
  "totalScore": 72,
  "summary": "논리적 사고와 조직 적합성이 강점. 압박 대응력과 비즈니스 임팩트 표현 보완 필요.",
  "actionItems": [
    { "axis": "압박 대응력", "issue": "CHALLENGE 꼬리질문 시 논리 붕괴", "action": "반박 예상 질문 3개 미리 준비" }
  ],
  "growthCurve": [
    { "session": 1, "totalScore": 58 },
    { "session": 2, "totalScore": 65 },
    { "session": 3, "totalScore": 72 }
  ]
}
```

---

## 4. 구현 로드맵

| 주차 | 기능 | 산출물 |
|------|------|--------|
| **Week 1** | 기능01 (1차 출시) | `/api/resume/questions`, 업로드·결과 UI |
| **Week 2** | 기능02, 03, 04 | 서류 진단 API, 패널 면접 세션, 꼬리질문 엔진 |
| **Week 3** | 기능05, 06, 07 | 연습 모드, 아바타·TTS (기술 확정 후), 8축 리포트 |
| **Week 4** | 배포·마케팅 | 배포 URL, 커뮤니티 홍보, 유저 피드백 수집 |

---

## 5. 환경 변수

```
ANTHROPIC_API_KEY    Claude API 호출
CLAUDE_MODEL         사용 모델 (기본값: claude-sonnet-4-6)
# Week 3 추가 예정
TTS_API_KEY          TTS 서비스 키
STT_API_KEY          STT 서비스 키
AVATAR_API_KEY       아바타 서비스 키
```

---

> 기능01은 `MVP_dev_spec.md`에 원본 명세가 보존되어 있다.
> 기능06 기술 스택(TTS·STT·아바타 API)은 Week 2 내 확정하여 이 문서를 업데이트한다.
