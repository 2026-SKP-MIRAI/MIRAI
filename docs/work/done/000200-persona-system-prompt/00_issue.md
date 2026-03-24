# feat: [engine] 기능03 페르소나 System Prompt 강화 + 압박도 adaptive 조절

## 사용자 관점 목표
HR·기술팀장·경영진이 실제로 다른 관점에서 질문하여, 지원자의 다양한 역량이 고르게 드러난다.
페르소나가 실제로 차별화되지 않으면 특정 역량 축만 반복 평가되고 나머지 축은 not_evaluated로 남는다.

## 배경

### 평가 신뢰성과의 연결
8축 역량 평가에서 각 축이 실제로 측정되려면 해당 역량을 유도하는 질문이 있어야 한다.

- **HR** → 대인관계, 조직 적합성, 문화 적합성 질문 → communication, cultureFit, sincerity 축
- **기술팀장** → 기술 깊이, 문제 해결 질문 → jobExpertise, problemSolving, logicalThinking 축
- **경영진** → 성과, 비전, 리더십 질문 → leadership, creativity, problemSolving 축

현재 페르소나 3명이 사실상 같은 질문을 하면:
- 특정 축은 반복 측정, 나머지 축은 데이터 없음 → not_evaluated
- "의사소통만 잘하는 사람"과 "기술만 잘하는 사람"이 동일한 평가를 받는 구조적 오류

**페르소나 차별화 = 8축 전체 커버 보장 = 평가 완전성(completeness)**

현재 페르소나 3명은 같은 LLM 프롬프트 변형에 불과하여 실질적 차별화가 없다.
RAG 방식은 페르소나별 질문 패턴 데이터(각 수백~수천 개)가 필요하나 현실적으로 확보가 어렵다.
대신 페르소나별 System Prompt를 강화하고, 답변 신호에 따라 각 페르소나가 자기 관심 영역에만
반응하도록 한다.

선행 조건: #197 완료

## 완료 기준
- [x] 페르소나별 System Prompt 분리 강화 — HR·기술팀장·경영진 각각 독립 프롬프트 파일
- [x] 동일 답변에 HR·기술팀장·경영진이 서로 다른 다음 질문 생성 (검증 테스트 포함)
- [x] answer_quality < 60 → CHALLENGE, vague_ratio > 0.4 → CLARIFY, else → EXPLORE 자동 전환
- [x] 답변 신호 추출 후 해당 페르소나 관심 영역 기반 질문 유도
- [x] pytest 커버리지 80% 이상

> **구현 범위 메모**: 이 이슈의 "페르소나 System Prompt 강화"는 **꼬리질문(followup) 프롬프트** 한정이다.
> - 대상: `interview_followup_v2.md` (단일) → `interview_followup_{hr|tech_lead|executive}_v3.md` (페르소나별 3개 분리)
> - 비대상: 초기 질문 생성 프롬프트 (`interview_hr_v2.md`, `interview_tech_lead_v2.md`, `interview_executive_v2.md`) — 이 파일들의 강화는 별도 이슈 범위

## 구현 플랜

**1단계: 페르소나별 System Prompt 파일 분리**
```
engine/app/prompts/interview_followup_hr_v3.md
  - 역할: 조직 적합성·협업 태도·인성 검증 (꼬리질문 전용)
  - 관심 신호: teamwork_mentions, STAR 완성도, 귀인 이론
  - 담당 8축: communication, cultureFit, sincerity

engine/app/prompts/interview_followup_tech_lead_v3.md
  - 역할: 직무 역량·문제 해결·기술 깊이 검증 (꼬리질문 전용)
  - 관심 신호: technical_depth, 인과분석, 대안 언급
  - 담당 8축: jobExpertise, problemSolving, logicalThinking

engine/app/prompts/interview_followup_executive_v3.md
  - 역할: 성장 가능성·비전·비즈니스 임팩트 검증 (꼬리질문 전용)
  - 관심 신호: business_impact, 성과 정량화, 확장사고
  - 담당 8축: leadership, creativity, problemSolving
```

**2단계: `engine/app/analyzers/answer_signals.py` 생성**
```python
def extract_signals(answer: str) -> dict:
    return {
        "technical_depth":    esco_match_score(answer),
        "teamwork_mentions":  count_keywords(answer, ["협업","팀","소통","배려"]),
        "business_impact":    count_keywords(answer, ["매출","성과","임팩트","전략"]),
        "answer_quality":     calc_quality(answer),   # star_score + specificity 복합
        "vague_ratio":        vague_ratio(answer),    # text_analyzer 재사용
    }
```

**3단계: `engine/app/analyzers/pressure_controller.py` 생성**
```python
def calc_pressure(answer_quality: float, vague_ratio: float) -> str:
    if answer_quality < 60:  return "CHALLENGE"
    if vague_ratio > 0.4:    return "CLARIFY"
    return "EXPLORE"
```

**4단계: `engine/app/services/interview_service.py` 수정**

## 평가 신뢰성 기여

| 기존 문제 | 이 이슈 적용 후 |
|---------|--------------|
| 페르소나 3명이 같은 질문 → 특정 축만 반복 측정 | 페르소나별 관심 영역 분리 → 8축 균형 커버 |
| 기술 역량이 있어도 HR 페르소나가 감지 못함 | 답변 신호로 페르소나 반응 영역 분기 → 역량 정확 포착 |
| 쉬운 답변에 쉬운 꼬리질문 반복 → 깊이 없음 | pressure_controller → 답변 수준에 맞는 질문 강도 |
| 일부 8축 not_evaluated | 페르소나 분리 → 각 축을 담당하는 페르소나가 해당 데이터 수집 |

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `engine/app/prompts/interview_followup_hr_v3.md` | 신규 생성 — HR 전용 꼬리질문 프롬프트 |
| `engine/app/prompts/interview_followup_tech_lead_v3.md` | 신규 생성 — 기술팀장 전용 꼬리질문 프롬프트 |
| `engine/app/prompts/interview_followup_executive_v3.md` | 신규 생성 — 경영진 전용 꼬리질문 프롬프트 |
| `engine/app/analyzers/answer_signals.py` | 신규 생성 — format_persona_signals() |
| `engine/app/analyzers/pressure_controller.py` | 신규 생성 — calc_answer_quality() + classify_pressure() |
| `engine/app/analyzers/__init__.py` | 수정 — 신규 함수 export 추가 |
| `engine/app/services/interview_service.py` | 수정 — 페르소나별 프롬프트 분기 + persona_signals/pressure_type 주입 |
| `engine/app/prompts/.ai.md` | 수정 — v3 프롬프트 파일 버전이력 추가 |
| `engine/app/analyzers/.ai.md` | 신규 생성 — 모듈 문서 |
| `engine/.ai.md` | 수정 — 신규 모듈 구조 반영 |

## 개선 효과 측정 지표

| 지표 | 현재 (단일 프롬프트) | 목표 (페르소나 분리 후) | 측정 방법 |
|------|-------------------|---------------------|---------|
| 페르소나 간 질문 유사도 (BGE-M3 cosine) | 0.80~0.95 (거의 동일) | ≤ 0.65 (명확히 다름) | pytest: 동일 답변 → HR/Tech/Exec 질문 3쌍 유사도 측정 |
| pressure 유형 분류 일관성 (동일 입력) | 미정의 (LLM 임의) | 100% (규칙 기반, 결정론) | pytest: 동일 answer_quality·vague_ratio 10회 반복 |
| 8축 중 not_evaluated 축 수 (10개 면접 세션) | 측정 없음 | 페르소나 분리 전 대비 30% 감소 | 동일 히스토리 10세션 → not_evaluated 축 수 비교 |
| HR 페르소나 teamwork 신호 반응률 | 측정 없음 | ≥ 80% | 수동 검토 5건 |
| LLM 프롬프트 토큰 증가 (신호 컨텍스트 추가) | baseline | +100~200 tokens | UsageMetadata.prompt_tokens 비교 |

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] `engine/.ai.md` 최신화
- [ ] 불변식 위반 없음


---

## 작업 내역

### 2026-03-24

**현황**: 5/5 완료

**완료된 항목**:
- 페르소나별 System Prompt 분리 강화 — HR·기술팀장·경영진 각각 독립 프롬프트 파일
- 동일 답변에 HR·기술팀장·경영진이 서로 다른 다음 질문 생성 (검증 테스트 포함)
- answer_quality < 60 → CHALLENGE, vague_ratio > 0.4 → CLARIFY, else → EXPLORE 자동 전환
- 답변 신호 추출 후 해당 페르소나 관심 영역 기반 질문 유도
- pytest 커버리지 80% 이상 (신규 모듈 100%)

**미완료 항목**:
- (없음)

**변경 파일**: 11개
- engine/app/prompts/interview_followup_hr_v3.md (신규 — 기존 interview_followup_v2 대체, HR 전용)
- engine/app/prompts/interview_followup_tech_lead_v3.md (신규 — 기술팀장 전용)
- engine/app/prompts/interview_followup_executive_v3.md (신규 — 경영진 전용)
- engine/app/analyzers/pressure_controller.py (신규 — calc_answer_quality, classify_pressure)
- engine/app/analyzers/answer_signals.py (신규 — format_persona_signals)
- engine/app/analyzers/__init__.py (수정 — 신규 함수 export 추가)
- engine/app/services/interview_service.py (수정 — 페르소나 분기 + analyze() 중복 호출 제거)
- engine/app/analyzers/.ai.md (신규 — 모듈 문서)
- engine/app/prompts/.ai.md (수정 — v3 프롬프트 파일 추가)
- engine/.ai.md (수정 — 신규 모듈 구조 반영)
- engine/tests/unit/analyzers/test_pressure_controller.py (신규, 12 tests)
- engine/tests/unit/analyzers/test_answer_signals.py (신규, 6 tests)
- engine/tests/unit/services/test_interview_service_persona.py (신규, 6 tests)

