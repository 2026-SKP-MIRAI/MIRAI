# chore: [siw] docs/whitepaper/siw 발표 자료 초안 작성

## 목적
MirAI 서비스 대중 발표를 위해 siw 서비스 기준의 발표 자료 초안을 docs/whitepaper/siw 폴더에 정리한다.

## 배경
발표는 siw 서비스 + 엔진 협업 구조를 중심으로 구성하며, 기획 단계부터 기술 구현까지 전 과정을 대중이 이해할 수 있는 수준으로 서술한다.

## 완료 기준
- [x] `docs/whitepaper/siw/` 폴더 생성 및 `.ai.md` 작성
- [x] 기획 단계 문서 — 타겟 선정·시장조사·서비스 기획 배경
- [x] 협업 구조 문서 — 하네스 엔지니어링·엔진 협업 방식·서비스 역할 분담
- [x] siw 기능별 구현 문서 — 각 기능을 어떤 기준으로 구현했는지 의사결정 근거 포함
- [x] 파이프라인·인프라 문서 — 아키텍처 선택 이유 (EC2·Lambda·Airflow·S3·pgvector 등)
- [x] 기술 스택 정리 — 선택 근거 포함

## 구현 플랜
1. `docs/whitepaper/siw/` 폴더 및 `.ai.md` 생성
2. 기획 단계 — `01_planning.md` 작성 (타겟·시장조사·기획 배경)
3. 협업 구조 — `02_engineering.md` 작성 (하네스·엔진·서비스 역할 분담)
4. 기능 구현 — `03_features.md` 작성 (면접 시뮬레이션·RAG·LLM 파이프라인 등 기준)
5. 인프라 — `04_infrastructure.md` 작성 (파이프라인·인프라 선택 근거)
6. 기술 스택 — `05_tech_stack.md` 작성

## 개발 체크리스트
- [x] `docs/whitepaper/siw/.ai.md` 생성

---

## 작업 내역

### 2026-03-28

**현황**: 7/7 완료

**완료된 항목**:
- `docs/whitepaper/siw/` 폴더 생성 및 `.ai.md` 작성 (읽기 순서 가이드)
- 기획 단계 문서 `01_planning.md` (5섹션: 배경·타겟·시장·컨셉·비즈니스모델)
- 협업 구조 문서 `02_engineering.md` (하네스·엔진·개발프로세스·역할분담)
- siw 기능별 구현 문서 `03_features.md` (7기능 + 부가기능 5개)
- 파이프라인·인프라 문서 `04_infrastructure.md` (Docker·CI/CD·Lambda·Airflow)
- 기술 스택 정리 `05_tech_stack.md` (24개 항목, 핵심 6개 대안 비교)
- `docs/whitepaper/.ai.md` siw/ 서브폴더 항목 추가

**미완료 항목**:
- (없음)

**변경 파일**: 6개 신규 생성 (3명 병렬 worker 팀 실행, 01_plan.md Planner·Architect·Critic 합의 플랜 기반)

