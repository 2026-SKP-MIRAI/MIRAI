# [#53] feat: [engine] 프롬프트 엔지니어링 고도화 — HR·기술팀장·경영진 페르소나 v2 — 구현 계획

> 작성: 2026-03-20 | ralplan 합의 완료 (Planner → Architect → Critic APPROVE)

---

## 완료 기준

- [ ] `interview_hr_v1.md` → v2: 직무 적합성·문화 핏·소프트스킬 심층 질문 패턴 강화
- [ ] `interview_tech_lead_v1.md` → v2: 기술 깊이·시스템 설계·문제해결 역량 심층 질문 패턴 강화
- [ ] `interview_executive_v1.md` → v2: 리더십·비즈니스 임팩트·전략적 사고 심층 질문 패턴 강화
- [ ] `interview_followup_v1.md` → v2: 세 페르소나 특성을 반영한 꼬리질문 패턴 고도화
- [ ] 프롬프트 변경에 따른 테스트 코드 업데이트

---

## 배경 및 문제 진단

### v1 공통 문제점

| 문제 | 설명 |
|------|------|
| **역할 정의 피상적** | "당신은 채용 HR 담당자입니다" 한 줄 — 페르소나 깊이 없음 |
| **페르소나 경계 없음** | HR이 기술 질문, 모든 페르소나가 기술 질문 위주 출력 |
| **평가 기준 부재** | 무엇을 기준으로 질문해야 하는지 없음 → 일반적·뻔한 질문 |
| **질문 전략 없음** | 개수·난이도·순서·유형 분배 가이드 없음 |
| **이력서 분석 지시 없음** | 무엇을 추출해야 하는지 안내 없음 → 피상적 독해 |
| **Few-shot 예시 없음** | 기대 출력 수준을 보여주는 예시 없음 |
| **꼬리질문 페르소나 미분화** | 3개 페르소나 모두 동일한 꼬리질문 프롬프트 사용 |

### v1 파일 현황

| 프롬프트 | 분량 | 핵심 부족 |
|---------|------|---------|
| `interview_hr_v1.md` | 9줄 | 문화 핏·STAR 행동 질문, 소프트스킬 평가 프레임워크 |
| `interview_tech_lead_v1.md` | 9줄 | 기술 깊이 탐색, 시스템 설계, 트레이드오프 논의 |
| `interview_executive_v1.md` | 9줄 | 리더십·비즈니스 임팩트·전략적 사고 검증 |
| `interview_followup_v1.md` | 16줄 | 페르소나별 꼬리질문 스타일 분화, 깊이 조절 전략 |

### 핵심 제약

- LLM 호출 횟수 증가 없음 (단일 호출 유지, 비용 동일)
- 출력 JSON 포맷 동일 유지 — `_parse_object`는 **단일 JSON 객체** 기대
  - 질문: `{"question": "...", "personaLabel": "..."}` (배열 아님)
  - 꼬리질문: `{"shouldFollowUp": bool, "followupType": "...", "followupQuestion": "...", "reasoning": "..."}`
- 템플릿 변수 유지: `{resume_text}`, `{personas_context}`, `{persona_context}`, `{question}`, `{answer}`
- v1 파일 보존 (삭제 금지)

---

## 적용 프롬프트 엔지니어링 기법

### 논문 기반 기법 (5종)

#### A. Step-Back Prompting (추상화 → 추론)
- **출처**: Step-Back Prompting — Google DeepMind (2023)
- **원리**: 구체적 세부사항에서 물러나 고수준 원리를 먼저 도출 → 그 위에서 추론
- **적용**:
  - HR: "이 지원자의 조직 적합성을 판단하기 위해 검증할 핵심 소프트스킬 3~5개 도출"
  - 기술팀장: "이 기술 스택에서 실무 역량의 본질적 구성 요소는?"
  - 경영진: "비즈니스 임팩트를 만드는 인재의 핵심 자질은?"
- **근거**: TimeQA +27% 향상, Hard 문제 42.6%→62.3%

#### B. Chain-of-Thought (CoT) — 단계적 추론
- **출처**: Wei et al. (2022)
- **원리**: 최종 출력 전 중간 추론 단계를 명시적으로 거침
- **적용**: `<analysis>` 섹션에서 이력서 핵심 포인트 추출 → 질문 설계 (단, `<analysis>` 블록은 응답에 포함하지 않고 내부 추론에만 사용)
- **근거**: ReAct 논문에서 CoT 적용 시 환각 14%→6% 감소

#### C. Self-Reflection (자기 성찰·검증)
- **출처**: Renze & Guven, Johns Hopkins University
- **원리**: 생성 결과를 스스로 검토·교정
- **적용**: 프롬프트 말미 자기 검증 체크리스트
  - "이 질문이 이력서에 실제 기재된 내용에 근거하는가?"
  - "뻔한 일반 질문이 아닌 이력서 맞춤 질문인가?"
  - "내 페르소나 고유의 관점이 반영되었는가?"
- **근거**: GPT-4 +23.5% 정확도 향상 (p < 0.001)

#### D. ReAct 패턴 (추론 ↔ 행동 교차)
- **출처**: Yao et al. (2022)
- **원리**: Thought → Action → Observation 교차 배치
- **적용**: 꼬리질문 프롬프트 전용
  - Thought: "답변에서 검증이 필요한 부분은 X이다"
  - Action: "CHALLENGE 유형으로 X에 대한 근거 요구"
  - Observation: "이 질문이 새로운 정보를 이끌어낼 수 있는가?"
- **근거**: 환각 기반 질문 감소, ALFWorld 33~90% 성능 향상

#### E. Graph of Thoughts 원리 (분해 → 병합)
- **출처**: GoT 논문 (2023~2024)
- **원리**: 복잡한 작업을 하위 작업으로 분해 → 독립 처리 → 집계
- **적용**: 기술팀장 전용 — 이력서를 3영역으로 독립 분석 후 통합
  - 영역 A: 기술 스택 깊이 (원리 이해도)
  - 영역 B: 설계/아키텍처 역량 (트레이드오프)
  - 영역 C: 문제 해결 패턴 (디버깅·장애 대응)
- **근거**: ToT 대비 62% 오류 감소, 비용 31% 절감

### 추가 기법 (5종)

#### F. Few-Shot Exemplars
- **적용**: 각 페르소나에 좋은 질문 vs 나쁜 질문 예시 **1~2쌍** (형식 시범 목적, 내용 다양성은 LLM에 위임)
- 예: `[나쁜] "팀 프로젝트 경험이 있나요?"` → `[좋은] "이력서의 A 프로젝트에서 팀원 간 기술 의견 충돌 시 어떤 역할로 조율했고 결과는?"`

#### G. Persona Depth Anchoring
- **적용**: 역할을 직함이 아닌 구체적 경험·관점·판단 기준으로 정의
  - HR: "15년 경력 채용 전문가. STAR 기법 행동면접 전문. 문화 핏 미스매치로 인한 조기 퇴사를 줄이는 것이 최우선 목표"
  - 기술팀장: "10년+ 시니어 엔지니어. 왜 이 설계를 선택했는가를 항상 묻는 사람"
  - 경영진: "CTO/VP 레벨. 이 사람이 6개월 후 어떤 임팩트를 만들 수 있는가로 판단"

#### H. Structured Output Scaffolding
- **적용**: 질문 유형·난이도 분포를 명시적으로 강제
  - HR: 행동 기반(STAR) 40%, 상황 판단/가치관 30%, 커리어 동기·성장 20%, 문화 핏 10%
  - 기술팀장: 기술 깊이(Why/How) 40%, 시스템 설계·아키텍처 30%, 문제 해결·디버깅 20%, 기술 커뮤니케이션 10%
  - 경영진: 회사 기여·비즈니스 임팩트 30%, 리더십·조직 영향 30%, 전략적 사고·의사결정 25%, 성장 비전 15%

#### I. Negative Constraint Prompting
- **적용**: 페르소나별 금지 질문 유형 명시 (법적 금지 포함)
  - 전체 공통: Yes/No 닫힌 질문 금지, 이력서에 없는 내용 질문 금지, 질문 간 중복 금지
  - 법적 금지 (채용절차법 제4조 3항): 개인/가족사, 성별, 나이, 정치 성향, 출신 학교 평가 금지
  - HR: 기술 스택·코드·시스템 질문 금지
  - 기술팀장: 인성·가치관·HR 영역·비즈니스 전략 질문 금지
  - 경영진: 기술 세부·단순 인성 질문 금지

#### J. Role-Conditional Reasoning
- **적용**: 동일한 이력서 포인트에 대해 페르소나마다 다른 관점으로 질문 유도
  - 같은 "팀 프로젝트 경험": HR→협업·갈등 해결 관점, 기술팀장→기술 의사결정 관점, 경영진→사업 기여 관점

### 기법 적용 매트릭스

| 기법 | HR | 기술팀장 | 경영진 | 꼬리질문 |
|------|:---:|:-------:|:------:|:--------:|
| A. Step-Back | ✅ | ✅ | ✅ | - |
| B. CoT | ✅ | ✅ | ✅ | - |
| C. Self-Reflection | ✅ | ✅ | ✅ | ✅ |
| D. ReAct | - | - | - | ✅ |
| E. GoT 분해 | - | ✅ | - | - |
| F. Few-Shot | ✅ | ✅ | ✅ | ✅ |
| G. Persona Depth | ✅ | ✅ | ✅ | ✅ |
| H. Output Scaffold | ✅ | ✅ | ✅ | - |
| I. Negative Constraints | ✅ | ✅ | ✅ | ✅ |
| J. Role-Conditional | - | - | - | ✅ |

### 구조화 면접 패턴 (에이치닷 150문항 기반)

**경험면접 + 상황면접 2종 분리**
- **경험면접**: 과거 실제 경험 (STAR 패턴) — HR 중심(70%), 경영진 혼합(50%)
- **상황면접**: 가상 시나리오 → 대처 방법 — 기술팀장 중심(50%), 경영진 혼합(50%)

**추가 질문(꼬리질문) 표준 패턴 6개** (Few-Shot 소스로 활용)
1. 상황/배경을 구체적으로 설명해달라
2. 그렇게 행동한 이유는?
3. 그때 어떤 생각이 들었는가?
4. 다른 사람들의 반응은?
5. 결과는 어떠했는가?
6. 이 경험을 통해 배운 점은?

**30개 역량 체계 → 페르소나별 매핑** (에이치닷 4대 역량군)

| 역량군 | HR 담당자 | 기술팀장 | 경영진 |
|--------|---------|---------|------|
| **성과역량** | 긍정성, 성실성, 끈기 | 문제해결력, 기획력, 정보관리력, 실행력, 전문지식/기술, 창의력 | 성취갈망, 열정, 성과관리력 |
| **관계역량** | 의사소통력, 협력성, 유연성, 능동성 | 의사소통력(기술 커뮤니케이션) | 설득력, 협상력, 고객지향성 |
| **적응역량** | 규범성, 책임감, 스트레스 복원력 | 책임감 | 스트레스 내성 |
| **리더십역량** | - | 의사결정력 | 비전제시력, 통합조정력, 변화촉진력, 업무위임력, 조직계발력 |

---

## 페르소나 분리 원칙 (핵심 — 반드시 준수)

> **문제**: v1에서 HR 담당자가 기술 질문을 하거나, 모든 페르소나가 기술 질문 위주로 출력됨.
> **목표**: 각 페르소나가 실제 현업 면접관처럼 자신의 역할에 맞는 질문만 생성.

| 페르소나 | 질문 영역 | 절대 금지 |
|---------|---------|---------|
| **HR 담당자** | 자소서 기반 개인 역량·성장 스토리, 직무 동기·커리어 방향, 조직 적합성·협업 방식, 가치관·문화 핏, 소프트스킬(의사소통·갈등해결·끈기), STAR 행동 질문 | 기술 스택·코드·시스템 설계·알고리즘 질문 |
| **기술팀장** | 기술 스택 선택 이유·트레이드오프, 시스템 설계·아키텍처 판단, 코드 품질·리팩토링 경험, 기술 문제 해결·디버깅, 성능·확장성, 기술 커뮤니케이션 | 인성·가치관·문화 핏·비즈니스 전략 질문 |
| **경영진** | 이 회사에 어떻게 기여할 것인가, 비즈니스 임팩트(수치·결과 중심), 리더십·조직에 미친 영향, 전략적 사고·의사결정, 성장 비전·장기 목표 | 기술 세부 질문, 단순 인성 질문 |

### 페르소나별 질문 스타일 예시

**HR 담당자 (자소서·역량·성장 중심)**
- ✅ "이력서에 [A 프로젝트]에서 팀 갈등을 조율했다고 하셨는데, 구체적으로 어떤 상황이었고 본인이 취한 행동과 결과는 어떠했나요?" (STAR)
- ✅ "커리어에서 가장 힘들었던 순간은 언제였고, 어떻게 극복하셨나요?"
- ✅ "입사 후 우리 팀 문화에 적응하기 위해 가장 먼저 하실 일은 무엇인가요?"
- ❌ 금지: "React와 Vue의 차이점은?", "RESTful API 설계 원칙은?", "Docker를 사용해보셨나요?"

**기술팀장 (기술 깊이·설계·트레이드오프 중심)**
- ✅ "이력서에 [B 기술]을 사용하셨는데, 왜 [대안 C] 대신 B를 선택하셨나요? 어떤 트레이드오프가 있었나요?"
- ✅ "프로덕션에서 갑자기 응답 지연이 3배 증가했습니다. 어떤 순서로 디버깅하시겠어요?"
- ✅ "이력서의 [D 시스템]을 10배 트래픽으로 확장한다면 아키텍처를 어떻게 변경하시겠어요?"
- ❌ 금지: "팀워크에서 중요한 것은?", "5년 후 목표는?", "우리 회사에 지원한 이유는?"

**경영진 (기여·임팩트·전략 중심)**
- ✅ "입사 후 6개월 안에 이 팀/회사에 만들 수 있는 가장 큰 변화는 무엇이라고 생각하세요?"
- ✅ "이력서의 [C 프로젝트]가 조직 전체에 미친 비즈니스 임팩트를 수치로 설명해주실 수 있나요?"
- ✅ "현재 우리 산업의 가장 큰 변화 트렌드 중 본인이 주목하는 것은 무엇이고, 입사 후 어떻게 활용하시겠어요?"
- ❌ 금지: "Python 문법은?", "자기소개 해주세요", "성격의 장단점은?"

---

## 구현 계획

### Phase 1: v2 프롬프트 작성

---

#### Step 1: interview_hr_v2.md

**파일**: `engine/app/prompts/interview_hr_v2.md`

**페르소나 정의 (Persona Depth Anchoring G)**
> "당신은 15년 경력의 채용 HR 전문가입니다. STAR(상황-과제-행동-결과) 기법 행동면접 전문가로, 이력서와 자기소개서에서 지원자의 성장 스토리·역량·동기·가치관·협업 방식을 탐색합니다. 기술 역량 검증은 기술팀장의 역할이므로, 당신은 절대로 기술 스택이나 코드에 관한 질문을 하지 않습니다."

**적용 기법**: A(Step-Back) + B(CoT) + C(Self-Reflection) + F(Few-Shot 1~2개) + G(Persona Depth) + H(Output Scaffold) + I(Negative Constraints)

**프롬프트 섹션 구조**
1. **[Persona Depth]** 역할·판단 기준·전문 영역 정의
2. **[Step-Back]** 이 지원자의 조직 적합성 판단을 위해 검증할 핵심 소프트스킬 영역 3~5개 먼저 도출
3. **[CoT]** `<analysis>` 블록: 이력서에서 STAR 질문 가능한 경험 3개 추출 → 각 경험에서 행동 패턴 단서 → 질문 설계 (이 블록은 내부 추론용, 최종 출력에 포함하지 않음)
4. **[Output Scaffold]** 질문 유형 분포 지시: 행동 기반(STAR) 40%, 상황 판단/가치관 30%, 커리어 동기·성장 20%, 문화 핏 10%
5. **[Few-Shot]** 좋은 질문(✅) vs 나쁜 질문(❌) 예시 1~2쌍
6. **[Negative Constraints]** 기술 스택·코드·시스템 질문 금지, 닫힌 Yes/No 질문 금지, 법적 금지 사항
7. **[Self-Reflection]** 생성 전 자기 검증: "이 질문이 이력서에 근거하는가?", "HR 관점(인성·역량·문화)에만 집중하는가?", "열린 질문인가?"
8. **출력 포맷** 지시: 단일 JSON 객체

**Few-Shot 소스**: 에이치닷 긍정성·협력성·스트레스 복원력 문항 + MIDAS 면접 가이드

**AC**
- [ ] 파일 생성됨
- [ ] `{resume_text}`, `{personas_context}` 포함
- [ ] 출력: 단일 JSON 객체 `{"question": "...", "personaLabel": "HR 담당자"}`
- [ ] 평가 축 4개 이상 명시
- [ ] Few-Shot 예시 1~2개 (3개 이상 금지)
- [ ] 기술 질문 금지 Negative Constraint 명시

---

#### Step 2: interview_tech_lead_v2.md

**파일**: `engine/app/prompts/interview_tech_lead_v2.md`

**페르소나 정의 (Persona Depth Anchoring G)**
> "당신은 10년+ 경력의 시니어 엔지니어 겸 기술팀장입니다. 이력서에서 기술 스택을 보면 '왜 이 선택을 했는가?'를 반드시 파고드는 사람입니다. 표면적인 지식 확인이 아니라, 기술적 판단력·설계 사고·문제 해결 과정을 검증합니다. 인성이나 가치관 질문은 HR의 역할이므로 묻지 않습니다."

**적용 기법**: A(Step-Back) + B(CoT) + C(Self-Reflection) + E(GoT 분해) + F(Few-Shot 1~2개) + G(Persona Depth) + H(Output Scaffold) + I(Negative Constraints)

**프롬프트 섹션 구조**
1. **[Persona Depth]** 역할·판단 기준 정의
2. **[Step-Back]** "이 기술 스택/도메인에서 실무 역량의 본질적 구성 요소는 무엇인가?" 먼저 도출
3. **[GoT 분해]** 이력서를 3영역으로 독립 분석:
   - 영역 A: 기술 스택 깊이 — 선택 이유·트레이드오프·원리 이해
   - 영역 B: 설계/아키텍처 역량 — 확장성·유지보수성 판단
   - 영역 C: 문제 해결 패턴 — 디버깅 경험·장애 대응
4. **[CoT]** 각 영역별 핵심 질문 포인트 추출 → 질문 도출 (내부 추론용)
5. **[Output Scaffold]** 질문 유형 분포: 기술 깊이(Why/How) 40%, 시스템 설계·아키텍처 30%, 문제 해결·디버깅 20%, 기술 커뮤니케이션 10%
6. **[Few-Shot]** 표면적 질문(❌) vs 깊이 있는 질문(✅) 예시 1~2쌍
7. **[Negative Constraints]** 단답형 지식 확인 금지("~의 정의는?"), 인성·가치관·HR·비즈니스 전략 영역 금지
8. **[Self-Reflection]** "유행어 나열 질문이 아닌가?", "지원자의 사고 과정을 드러내는 질문인가?", "기술팀장 관점에 집중하는가?"
9. **출력 포맷** 지시: 단일 JSON 객체

**Few-Shot 소스**: 에이치닷 문제해결력·전문지식/기술·실행력 문항 (상황면접 위주)

**AC**
- [ ] 파일 생성됨
- [ ] `{resume_text}`, `{personas_context}` 포함
- [ ] 출력: 단일 JSON 객체 `{"question": "...", "personaLabel": "기술팀장"}`
- [ ] GoT 3영역 분해 구조 포함
- [ ] Few-Shot 예시 1~2개 (3개 이상 금지)
- [ ] 인성·HR 영역 금지 Negative Constraint 명시

---

#### Step 3: interview_executive_v2.md

**파일**: `engine/app/prompts/interview_executive_v2.md`

**페르소나 정의 (Persona Depth Anchoring G)**
> "당신은 CTO/VP 레벨 경영진입니다. '이 사람이 6개월 후 팀과 회사에 어떤 변화를 만들 수 있는가?'로 지원자를 판단합니다. 비즈니스 임팩트·전략적 사고·리더십 경험을 검증하며, 기술 세부나 단순 인성 질문은 하지 않습니다."

**적용 기법**: A(Step-Back) + B(CoT) + C(Self-Reflection) + F(Few-Shot 1~2개) + G(Persona Depth) + H(Output Scaffold) + I(Negative Constraints) + J(Role-Conditional)

**프롬프트 섹션 구조**
1. **[Persona Depth]** 역할·판단 기준 정의
2. **[Step-Back]** "비즈니스 임팩트를 만드는 인재의 핵심 자질은 무엇인가?" 먼저 도출
3. **[CoT + Role-Conditional]** 이력서에서 임팩트 단서 추출 → 경영진 관점으로 검증 질문 설계
   - 프로젝트 경험 → "비즈니스 가치로 환산하면?", "조직 전체에 어떤 영향?"
   - 기술 경험 → "이 사람이 회사에 가져다 줄 전략적 가치는?"
4. **[Output Scaffold]** 질문 유형 분포: 회사 기여·비즈니스 임팩트 30%, 리더십·조직 영향 30%, 전략적 사고·의사결정 25%, 성장 비전 15%
5. **[Few-Shot]** 경영진 질문 예시 1~2쌍 (비즈니스 임팩트·리더십 중심)
6. **[Negative Constraints]** 기술 세부 질문 금지, "자기소개·장단점" 류 금지, 단순 인성 질문 금지
7. **[Self-Reflection]** "이 질문이 경영진 관점(기여·임팩트·전략)에 집중하는가?", "수치·결과를 이끌어낼 수 있는 질문인가?"
8. **출력 포맷** 지시: 단일 JSON 객체

**Few-Shot 소스**: 에이치닷 비전제시력·통합조정력·성과관리력 문항

**AC**
- [ ] 파일 생성됨
- [ ] `{resume_text}`, `{personas_context}` 포함
- [ ] 출력: 단일 JSON 객체 `{"question": "...", "personaLabel": "경영진"}`
- [ ] Role-Conditional 구조 포함 (이력서 경험 → 비즈니스 가치 전환 관점)
- [ ] Few-Shot 예시 1~2개 (3개 이상 금지)
- [ ] 기술 세부·단순 인성 금지 Negative Constraint 명시

---

#### Step 4: interview_followup_v2.md

**파일**: `engine/app/prompts/interview_followup_v2.md`

**적용 기법**: C(Self-Reflection) + D(ReAct) + F(Few-Shot 1~2개) + G(Persona Depth) + I(Negative Constraints) + J(Role-Conditional)

**프롬프트 섹션 구조**
1. **[Persona Depth + Role-Conditional]** `{persona_context}` 라벨에 따라 조건부 행동 지침 활성화
   - `"HR 담당자"`: 감정·동기·구체적 경험 파고들기. 부드럽지만 깊이 있게.
   - `"기술팀장"`: 기술적 근거·대안·트레이드오프 추궁. 코드/설계 수준으로.
   - `"경영진"`: 비즈니스 임팩트·확장성 검증. "So what?" 관점.
2. **[ReAct]** Thought → Action → Observation 교차
   - Thought: "답변에서 [구체성 부족/논리 비약/흥미로운 단서] 발견"
   - Action: "[CLARIFY/CHALLENGE/EXPLORE] 유형 꼬리질문 생성"
   - Observation: "새로운 정보를 이끌어낼 수 있는가?"
3. **[CLARIFY/CHALLENGE/EXPLORE 페르소나별 세분화]**

   | 유형 | HR 담당자 | 기술팀장 | 경영진 |
   |------|---------|---------|------|
   | CLARIFY | "좀 더 구체적인 상황을 말씀해주실 수 있나요?" | "구체적으로 어떤 코드/설계로 구현했나요?" | "그 결과를 수치로 말씀해주시겠어요?" |
   | CHALLENGE | "반대 상황이었다면 어떻게 대처했을까요?" | "그 접근의 단점은? 대안은 고려했나요?" | "경쟁사도 같은 전략을 쓴다면 차별점은?" |
   | EXPLORE | "그 경험이 커리어 방향에 어떤 영향을 주었나요?" | "그 기술을 다른 문제에도 적용한 경험이 있나요?" | "그 경험을 더 큰 규모에 적용한다면?" |

4. **[에이치닷 Positive/Negative 체크포인트 활용]** 꼬리질문 유형 결정 기준:
   - 답변이 Positive 체크포인트에 해당 → EXPLORE (더 깊이 탐색)
   - 답변이 불명확 → CLARIFY
   - 답변이 Negative 또는 논리 비약 → CHALLENGE
5. **[Few-Shot]** 페르소나별 꼬리질문 예시 1쌍씩 (CLARIFY/CHALLENGE/EXPLORE 각 1개)
6. **[Negative Constraints]** 기답변 반복 질문 금지, 주제 이탈 금지, 압박 면접 톤 금지
7. **[Self-Reflection]** "기존 답변을 반복하게 만드는 질문이 아닌가?", "페르소나 관점에 맞는가?", "면접 깊이를 더하는가?"
8. **출력 포맷** 지시: 단일 JSON 객체

**핵심**: `{persona_context}`에는 라벨만 전달("HR 담당자"/"기술팀장"/"경영진") — 프롬프트 내부에서 라벨을 읽고 조건부 행동 지침 활성화 (interview_service.py 코드 변경 없음)

**AC**
- [ ] 파일 생성됨
- [ ] `{persona_context}`, `{resume_text}`, `{question}`, `{answer}` 포함
- [ ] 출력: 단일 JSON 객체 `{"shouldFollowUp": bool, "followupType": "...", "followupQuestion": "...", "reasoning": "..."}`
- [ ] 페르소나별 조건부 행동 지침 내장 (3개 페르소나 모두)
- [ ] CLARIFY/CHALLENGE/EXPLORE 유형별 페르소나 분기 포함
- [ ] Few-Shot 예시 1~2개 (3개 이상 금지)

---

### Phase 2: 통합 및 테스트

#### Step 5-A: interview_service.py 변경 (4곳)

- 11행: `"interview_hr_v1.md"` → `"interview_hr_v2.md"`
- 12행: `"interview_tech_lead_v1.md"` → `"interview_tech_lead_v2.md"`
- 13행: `"interview_executive_v1.md"` → `"interview_executive_v2.md"`
- 57행: `"interview_followup_v1.md"` → `"interview_followup_v2.md"`

#### Step 5-B: 기존 테스트 확인

- LLM mock 기반이므로 변경 불필요. `pytest engine/tests/` 전체 통과 확인.

#### Step 5-C: 템플릿 변수 검증 테스트 추가

`test_v2_prompts_contain_required_placeholders()` 단위 테스트 추가:
- HR/기술팀장/경영진 v2: `{resume_text}`, `{personas_context}` 포함 검증
- followup v2: `{persona_context}`, `{resume_text}`, `{question}`, `{answer}` 포함 검증
- 위치: `engine/tests/unit/prompts/test_prompt_templates.py` (신규)

**AC**
- [ ] `PERSONA_PROMPTS` dict 3개 값 모두 v2 파일 참조 (11, 12, 13행)
- [ ] `_check_followup`가 `interview_followup_v2.md` 참조 (57행)
- [ ] `test_v2_prompts_contain_required_placeholders` 존재 및 통과
- [ ] `pytest engine/tests/` 전체 통과

---

### Phase 3: 마무리

#### Step 6: .ai.md 업데이트

- `engine/app/prompts/.ai.md`: v2 파일 4개 추가 등록

#### Step 7: 이슈 완료 기준 검증

8개 Success Criteria 전체 확인:
1. v2 프롬프트 4개 파일 생성
2. v1 파일 4개 보존
3. interview_service.py 4곳 변경
4. 기존 pytest 전체 통과
5. test_v2_prompts_contain_required_placeholders 통과
6. 각 v2 프롬프트에 최소 2가지 기법 적용
7. JSON 단일 객체 유지
8. Few-Shot 1~2개 제한

---

## 출력 형식 계약 (필수 준수)

- `interview_service.py:84`의 `_parse_object`는 단일 JSON 객체 기대 (`required_keys=["question"]`)
- 질문 프롬프트 출력: `{"question": "...", "personaLabel": "..."}` **(배열 아님)**
- 꼬리질문 프롬프트 출력: `{"shouldFollowUp": bool, "followupType": "...", "followupQuestion": "...", "reasoning": "..."}`
- `parse_object()`는 배열이 오면 `data[0]`을 취하는 방어 로직 있음 — 그래도 단일 객체로 지시할 것

## Guardrails

**Must Have**: Few-Shot 1~2개 제한, 단일 객체 출력, 변수 검증 테스트, v1 파일 보존, 페르소나별 질문 영역 분리
**Must NOT Have**: LLM 호출 횟수 증가, JSON 포맷 변경, schemas.py 변경, 페르소나 경계 침범

---

## 토큰 비용·성능 트레이드오프

| 항목 | v1 (현재) | v2 (예상) | 비고 |
|------|---------|---------|------|
| 프롬프트 토큰 | ~150 | ~800~1,200 | Few-shot + 섹션 구조 |
| 응답 품질 | 일반적·피상적 | 이력서 맞춤·깊이 있음 | Step-Back + CoT |
| 질문 다양성 | 낮음 | 높음 (유형·난이도 분포) | Output Scaffold |
| 페르소나 차별화 | 거의 없음 | 명확한 분리 | Persona Depth + Negative Constraints |
| 환각 (이력서 무관 질문) | 높음 | 낮음 | Self-Reflection |
| 추가 LLM 호출 | 없음 | **없음** | 단일 호출 유지 |
| latency 영향 | - | +1~3초 | 출력 토큰 증가분 |
| context window 영향 | - | 미미 | Gemini 2.5 Flash 1M 토큰 윈도우 |

---

## 참고 문헌

### 학술 논문
1. **ReAct** — Yao et al., "Synergizing Reasoning and Acting in Language Models" (2022)
2. **Tree of Thoughts** — Yao et al., NeurIPS 2023
3. **Self-Reflection in LLM Agents** — Renze & Guven, Johns Hopkins University
4. **Graph of Thoughts** — GoT Framework (2023~2024)
5. **Step-Back Prompting** — Google DeepMind (2023~2024)
6. **Chain-of-Thought** — Wei et al., "Chain-of-Thought Prompting Elicits Reasoning" (2022)
7. **Few-Shot Learning** — Brown et al., GPT-3 "Language Models are Few-Shot Learners" (2020)

### 현업 면접 자료 (Few-Shot 예시 소스)
8. **역량기반 구조화면접 질문지 150문항** — 에이치닷 (JAINWON, 2025) — 30개 역량 × 5문항, STAR 패턴, 추가질문 6개 패턴, 답변 체크포인트
9. **채용 면접 가이드** — MIDAS 채용팀 — 면접 구조, 역량 기반 질문 리스트, 법적 금지사항
10. **수습평가 문항 및 평가표** — MIDAS HR — 성과/관계/적응 3대 분류, 20개 세부 역량
11. **수습평가 리포트 샘플** — MIDAS HR
12. **HR Guide: 채용 성과관리 평가지표** — HRevolution — 면접 중요도 57.4%
