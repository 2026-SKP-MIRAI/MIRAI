# [#12] MVP 아키텍처·1달 계획·proposal 문서 갱신 — 구현 계획

> 작성: 2026-03-04
> 기준 기획서: `/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/MirAI_기획서_v2.pdf`

---

## 파일 구조 (네이밍 규칙)

> **MVP_ prefix** = 원본 보존 (`git mv`로 이름만 변경, 내용 유지)
> **MirAI_ prefix** = 팀 운영 최신판 (신규 작성, v2 기준)

| 파일 | 역할 | 작업 방식 |
|------|------|---------|
| `docs/whitepaper/MVP_proposal.md` | 기획서 원본 v1 보존 | `git mv MirAI_proposal.md MVP_proposal.md` |
| `docs/whitepaper/MirAI_proposal.md` | 기획서 최신판 — v2 PDF 전체 기능 반영 | 신규 작성 |
| `docs/specs/MVP_dev_spec.md` | 개발 명세 원본 v1 보존 | `git mv MirAI_MVP_dev_spec.md MVP_dev_spec.md` |
| `docs/specs/MirAI_dev_spec.md` | 개발 명세 최신판 — 7개 기능 전체 명세 | 신규 작성 |
| `docs/whitepaper/mirai_project_plan.md` | 1달 운영 계획 | 기능 목록·하네스 환경 최신화 |
| `docs/whitepaper/.ai.md` | 디렉토리 메타데이터 | 파일 목록 반영 |
| `docs/specs/.ai.md` | 디렉토리 메타데이터 | 파일 목록 반영 |

---

## v2 PDF 분석 요약

`MirAI_기획서_v2.pdf`는 **MVP 명세가 아닌 전체 서비스 기획서**다.
기존 `MirAI_proposal.md`(v1)는 4개 기능을 기술했으나, v2 PDF에는 **7개 기능 (4 Step 구조)**가 명시되어 있다.

### 기능 구조 (v2 기준)

| Step | 기능 | 설명 | MVP 여부 |
|------|------|------|---------|
| Step 1 — 서류 분석 | 기능01: PDF 구조화 및 자소서 기반 맞춤 질문 생성 | 파싱·추출·경험 중심 질문 설계 | ⭐ MVP |
| Step 1 — 서류 분석 | 기능02: 서류 강점·약점 분석 | 5개 항목 종합 진단, 직무 적합성, 개선 제안 | post-MVP |
| Step 2 — 실전 시뮬레이션 | 기능03: 3인 1조 패널 면접 시스템 | HR/기술팀장/경영진 페르소나 동시 참여 | post-MVP |
| Step 2 — 실전 시뮬레이션 | 기능04: 실시간 꼬리질문 엔진 | CLARIFY·CHALLENGE·EXPLORE 3가지 유형 | post-MVP |
| Step 3 — 몰입형 환경 | 기능05: 연습 모드 및 즉각 피드백 | 짧은 과제→피드백→교정 순환, 답변 비교 | post-MVP |
| Step 3 — 몰입형 환경 | 기능06: AI 아바타·TTS 몰입형 면접 | 음성 인터랙션, 비언어적 역량 훈련 | post-MVP |
| Step 4 — 심층 피드백 | 기능07: 8축 역량 평가 및 실행형 리포트 | 정량 점수·성장 곡선·실행 로드맵 | post-MVP |

### v1 대비 v2 추가 내용 (비즈니스 모델)

- Revenue streams: 개인 구독 19,900원/월, 대학/기관 단체 계약(B2U), 프리미엄 리포트 건당 9,900원
- Cost: LLM API 유료 1,500원/월, 무료 225원/월, 인프라 매출의 5%
- Unit Economics: LTV 79,000원 / CAC 8,000원 / LTV:CAC 9.8배 / Payback 0.5개월
- B2U 대학 제휴 전략 섹션 신규 추가

---

## 구현 순서 (실제 작업 순서)

### Step 1. 원본 파일 이름 변경 (git mv)
- `git mv docs/whitepaper/MirAI_proposal.md docs/whitepaper/MVP_proposal.md`
- `git mv docs/specs/MirAI_MVP_dev_spec.md docs/specs/MVP_dev_spec.md`
- `MVP_dev_spec.md` 헤더 기준 문서명 → `MVP_proposal.md §3`으로 수정

### Step 2. MirAI_proposal.md 신규 작성
- 제목: `MirAI 서비스 기획서` (MVP 아님)
- §2-2: 7개 기능 4 Step 구조로 전면 재작성
- §4-4 Lean Canvas: Customer Segments에 B2U, Unfair Advantage에 B2U 네트워크 추가
- §4-5 수익 구조 상세 테이블 (LTV/CAC/Payback) 신규 추가
- §4-6 B2U 대학 제휴 전략 섹션 신규 추가

### Step 3. MirAI_dev_spec.md 신규 작성
- 기준: `MirAI_proposal.md` §2-2 전체 7개 기능
- 기능01~07 각각 API 명세, 시스템 흐름, Claude 프롬프트 지침 포함
- 기능06(AI 아바타·TTS)은 Week 3 기술 확정 후 업데이트 예정으로 표시

### Step 4. mirai_project_plan.md 최신화
- 기능 목록: v2 기준 기능 2~4 상태 🔄 (3/5 마감) 반영
- 하네스 환경 현황 섹션 추가 (Claude 스킬 7종, 커스텀 에이전트 7종, 보안 훅)
- Week 1 산출물 현황 컬럼 추가

### Step 5. .ai.md 최신화
- `docs/whitepaper/.ai.md`: MVP_proposal.md, MirAI_proposal.md 파일 목록 반영
- `docs/specs/.ai.md`: MVP_dev_spec.md, MirAI_dev_spec.md 파일 목록 반영

---

## 완료 기준

- [x] `MVP_proposal.md` 존재 (git mv, 원본 내용 보존)
- [x] `MirAI_proposal.md` 존재 (v2 기준, 7개 기능·B2U·LTV/CAC 반영)
- [x] `MVP_dev_spec.md` 존재 (git mv, 헤더 참조 수정)
- [x] `MirAI_dev_spec.md` 존재 (7개 기능 전체 API 명세)
- [x] `mirai_project_plan.md` 최신화 (기능 현황·하네스 환경)
- [x] `docs/whitepaper/.ai.md`, `docs/specs/.ai.md` 최신화

---

## 참고

- 기획서 v2 원본: `/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/MirAI_기획서_v2.pdf`
- 기능06 TTS·STT·아바타 API 선정 후 `MirAI_dev_spec.md` §기능06 업데이트 필요
