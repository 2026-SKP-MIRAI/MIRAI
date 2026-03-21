# [#188] fix: /api/interview/start 500 에러 — interview 프롬프트 Step 3 질문 분포 문구 수정 — 구현 계획

> 작성: 2026-03-21

---

## 완료 기준

- [ ] `interview_hr_v2.md`, `interview_tech_lead_v2.md`, `interview_executive_v2.md` Step 3 문구를 "아래 유형 중 하나를 골라 질문 1개만 생성"으로 수정
- [ ] 엔진 재시작 후 다양한 이력서로 `/api/interview/start` 반복 호출 시 500 미발생 확인
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 구현 계획

### 근본 원인
3개 프롬프트의 "질문 분포" 섹션이 비율(40%/30%/20%/10% 등)로 여러 유형을 나열하여
LLM이 비율에 맞춰 여러 질문을 `{"questions": [...]}` 또는 wrapper 구조로 반환하는 경우 발생.
`_parse_object`는 최상위에 `"question"` 키가 없으면 `LLMError` → 500.

### 수정 전략
분포 비율 문구를 제거하고 **"아래 유형 중 하나를 골라 질문 1개만 생성"** 지시로 교체.
각 유형 목록은 유지하되, 퍼센트 표기를 없애고 단일 선택 지시를 명시.

### Step 1 — interview_hr_v2.md 수정
- 파일: `engine/app/prompts/interview_hr_v2.md`
- 대상: Step 3 "질문 분포 기준 (Output Scaffold)" 섹션 (line 24~31)
- 변경: `"아래 비율을 따르세요"` → `"아래 유형 중 하나를 골라 질문 1개만 생성하세요"`
- 퍼센트 수치 제거, 유형 목록은 유지

### Step 2 — interview_tech_lead_v2.md 수정
- 파일: `engine/app/prompts/interview_tech_lead_v2.md`
- 대상: "질문 분포 (Output Scaffold)" 섹션 (line 27~32)
- 변경: 동일 패턴 — 비율 제거, 단일 선택 지시 추가

### Step 3 — interview_executive_v2.md 수정
- 파일: `engine/app/prompts/interview_executive_v2.md`
- 대상: Step 3 "질문 분포 (Output Scaffold)" 섹션 (line 16~22)
- 변경: 동일 패턴 — 비율 제거, 단일 선택 지시 추가

### Step 4 — 검증
- 엔진 재시작 후 다양한 이력서로 `/api/interview/start` 반복 호출 → 500 미발생 확인
- 응답 JSON에 `"question"` 키가 단일 문자열로 반환되는지 확인

### Step 5 — .ai.md 최신화
- `engine/app/prompts/` 디렉토리의 `.ai.md` 업데이트
  - 수정된 프롬프트 파일 목록 및 변경 내용 반영

### 주의사항
- 출력 포맷 지시(`반드시 아래 단일 JSON 객체 형식만 반환`)는 이미 각 파일에 존재 — 건드리지 않음
- 유형 목록(STAR/상황판단/동기/문화핏 등)은 삭제하지 않고 퍼센트만 제거
- `interview_followup_v2.md`는 이슈 범위 외 — 수정 제외
