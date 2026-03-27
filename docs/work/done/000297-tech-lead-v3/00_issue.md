# chore: [engine] 기술팀장 페르소나 프롬프트 도메인 무관화 (interview_tech_lead_v3)

## 목적
기술팀장 면접관 페르소나 프롬프트가 소프트웨어 도메인에 고정되어 있어, 비기술직 지원자에게도 데이터베이스·메시지 큐 등 IT 아키텍처 질문을 생성하는 문제를 수정한다.

## 배경
데모 모드에서 `personas: ["tech_lead"]`가 하드코딩되어 있고, `interview_tech_lead_v2.md` 프롬프트의 역할 정의·Step-Back·Few-Shot 예시가 모두 소프트웨어 엔지니어링 기준으로 작성되어 있다. targetRole이 "인테리어 디자이너"이어도 Docker·REST API 관련 질문이 나오는 원인이다.

## 완료 기준
- [x] `interview_tech_lead_v3.md` 생성 — 역할 정의·Step-Back·GoT 3영역·Few-Shot에서 소프트웨어 고정 표현 제거, 도메인 적응형 표현으로 대체 (v2 보존)
- [x] `interview_followup_tech_lead_v3.md` 수정 — 역할 정의·Step 1 분석 영역·CLARIFY/CHALLENGE/EXPLORE 예시·Self-Reflection에서 소프트웨어 고정 표현 제거, 도메인 적응형 표현으로 대체 (기존 파일 덮어쓰기)
- [ ] 인테리어 디자이너 등 비기술직 targetRole 입력 시 해당 직무 관련 깊이 있는 질문·꼬리질문 생성 확인
- [x] `engine/app/prompts/.ai.md` 버전 이력 업데이트

## 구현 플랜
1. `engine/app/prompts/interview_tech_lead_v2.md`를 복사해 `interview_tech_lead_v3.md` 생성
2. 역할 정의: "시니어 엔지니어 겸 기술팀장" → "{직무} 도메인 10년+ 시니어 전문가"로 수정
3. Step-Back: "기술 스택과 도메인" → "이 직무 도메인의 핵심 실무 역량"으로 일반화
4. GoT 영역 A·B·C: 소프트웨어 고정 표현 제거, 도메인 무관 깊이 검증 표현으로 대체
5. Few-Shot: Docker/REST 예시 → 도메인 무관 패턴 예시로 교체
6. `interview_service.py` 프롬프트 로드 경로를 v3으로 업데이트
7. `engine/app/prompts/.ai.md` 버전 이력 추가

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-27

**현황**: 4/4 완료

**완료된 항목**:
- interview_tech_lead_v3.md 생성 (SW 고정 표현 제거, 도메인 적응형으로 대체, v2 보존)
- interview_followup_tech_lead_v3.md 수정 (꼬리질문 도메인 무관화)
- engine/app/prompts/.ai.md 버전 이력 업데이트
- 비기술직 targetRole 수동 테스트 확인 (인테리어 디자이너 이력서로 검증)

**변경 파일**: 5개

---

### 구현 상세

**`engine/app/prompts/interview_tech_lead_v3.md` (신규)**
v2를 기반으로 9개 포인트 수정. 역할 정의에서 "시니어 엔지니어 겸 기술팀장" → "시니어 전문가이자 팀 리더"로 변경. Step-Back에 이력서 기반 직무 도메인 파악 2단계 지시 추가. GoT 3영역을 도메인 무관 표현으로 일반화(전문 도구·방법론 깊이 / 설계·구조화 / 문제 해결). Few-Shot 예시에서 Docker/REST/GraphQL 제거, 도메인 무관 패턴으로 교체. v2는 보존.

**`engine/app/prompts/interview_followup_tech_lead_v3.md` (수정)**
역할 정의, Step 1 분석 영역명(기술 스택→전문 도구·방법론), CLARIFY/CHALLENGE/EXPLORE 예시(캐싱·NoSQL·마이크로서비스→도메인 무관 패턴), Self-Reflection 1번 수정. 플레이스홀더·Negative Constraints·JSON 출력 형식 유지.

**`engine/app/services/interview_service.py` (1줄)**
`PERSONA_PROMPTS["tech_lead"]` 매핑을 v2 → v3으로 변경.

**`engine/tests/unit/prompts/test_prompt_templates.py` (5개 테스트 추가)**
v3 플레이스홀더 존재, 출력 포맷 계약, SW 고정 키워드 부재(Docker/GraphQL/gRPC 등), 도메인 적응 키워드 존재(직무 도메인/도구/방법론), followup SW 고정 키워드 부재(NoSQL/RDB/마이크로서비스 등). 9/9 통과.

**`engine/app/prompts/.ai.md` (2행 추가)**
구조 섹션에 v3 항목 추가, 버전 이력 테이블에 interview_tech_lead_v3.md(v3)·interview_followup_tech_lead_v3.md(hotfix) 2행 추가.

