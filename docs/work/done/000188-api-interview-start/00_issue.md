# fix: /api/interview/start 500 에러 — interview 프롬프트 Step 3 질문 분포 문구 수정

## 목적
interview 프롬프트 Step 3의 질문 분포 문구가 LLM에게 wrapper 구조의 여러 질문을 생성하도록 유도하여 발생하는 500 에러 수정

## 배경
`engine/app/prompts/interview_hr/tech_lead/executive_v2.md`의 Step 3에 "아래 비율을 따르세요 (40%/30%/20%/10%)" 문구가 있어, LLM이 비율에 맞춰 여러 질문을 `{"questions": [...]}` 또는 `{"star": {...}, "situational": {...}}` 같은 wrapper 구조로 반환하는 경우가 발생.
`_parse_object`는 최상위에 `"question"` 키가 없으면 `LLMError`를 raise하여 500 응답.
이력서 내용에 따라 LLM 출력이 달라지므로 일부 사용자만 재현되는 비결정적 버그.

## 완료 기준
- [x] `interview_hr_v2.md`, `interview_tech_lead_v2.md`, `interview_executive_v2.md` Step 3 문구를 "아래 유형 중 하나를 골라 질문 1개만 생성"으로 수정
- [x] 엔진 재시작 후 다양한 이력서로 `/api/interview/start` 반복 호출 시 500 미발생 확인
- [x] 해당 디렉토리 `.ai.md` 최신화

## 구현 플랜
1. `engine/app/prompts/interview_hr_v2.md` Step 3 문구 수정
2. `engine/app/prompts/interview_tech_lead_v2.md` 질문 분포 섹션 문구 수정
3. `engine/app/prompts/interview_executive_v2.md` Step 3 문구 수정
4. 엔진 재시작 후 다양한 이력서로 테스트

## 개발 체크리스트
- [x] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### 2026-03-21

**현황**: 3/3 완료

**완료된 항목**:
- `interview_hr_v2.md`, `interview_tech_lead_v2.md`, `interview_executive_v2.md` Step 3 문구 수정
- 엔진 재시작 후 다양한 이력서로 `/api/interview/start` 반복 호출 시 500 미발생 확인
- 해당 디렉토리 `.ai.md` 최신화

**미완료 항목**: 없음

**변경 파일**: 4개

---

### 구현 내용

**근본 원인**: 3개 프롬프트의 Step 3 "질문 분포" 섹션이 비율(40%/30%/20%/10%)로 기술되어 LLM이 여러 질문을 `{"questions": [...]}` 또는 `{"star": {...}, "situational": {...}}` wrapper 구조로 반환하는 경우 발생. `_parse_object`는 최상위 `"question"` 키가 없으면 `LLMError` → 500.

**수정 방법**: 비율 문구를 제거하고 "아래 유형 중 하나를 골라 질문 1개만 생성하세요"로 교체. 유형 목록은 유지.

| 파일 | 변경 내용 |
|------|-----------|
| `interview_hr_v2.md` | Step 3 비율(40/30/20/10%) 제거 → 단일 유형 선택 지시 |
| `interview_tech_lead_v2.md` | 질문 분포 비율(40/30/20/10%) 제거 → 단일 유형 선택 지시 |
| `interview_executive_v2.md` | Step 3 비율(30/30/25/15%) 제거 → 단일 유형 선택 지시 |
| `engine/app/prompts/.ai.md` | 버전 이력에 hotfix 항목 3건 추가 |

