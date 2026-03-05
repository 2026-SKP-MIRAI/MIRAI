# [#16] chore: 화이트페이퍼 기준 specs 문서 동기화 — 구현 계획

> 작성: 2026-03-05

---

## 현재 상태 (as-is)

```
docs/specs/
├── .ai.md                  # flat 구조 기준 설명 (구식)
├── MVP_dev_spec.md         # MVP 원본 명세
└── MirAI_dev_spec.md       # MirAI 확장 명세 — 아래 항목들이 outdated
```

**MirAI_dev_spec.md의 문제점:**

| 항목 | dev_spec 현재값 | proposal(v2) 기준값 | 불일치 |
|------|---------------|-------------------|--------|
| 8축 역량 축 이름 | 직무 전문성/경험의 구체성/논리적 사고/커뮤니케이션/조직 적합성/성장 가능성/비즈니스 임팩트/압박 대응력 | 의사소통/문제해결/논리적 사고/직무 전문성/조직 적합성/리더십/창의성/성실성 | 6개 다름 |
| API 응답 키 | `jobExpertise`, `pressureResponse` 등 | 상기 축 이름 기반으로 수정 필요 | 불일치 |
| 로드맵 구조 | Week 1 / Week 2 / Week 3 | MVP / Phase 1~4 | 전면 교체 |
| 기술 스택 | Node.js+Express, pdf-parse, @anthropic-ai/sdk, TypeScript | Python FastAPI, pymupdf 등, anthropic SDK, Pydantic | 전면 교체 |
| UX 흐름 문서 | 없음 | proposal §5에 상세 UX 존재 | 누락 |
| 폴더 구조 | flat (루트에 2개 파일) | mvp/ · mirai/ 분리 | 재편 필요 |

**기술 스택 근거:** `engine/.ai.md` 확인 — FastAPI(Python), Pydantic schemas, `app/services/`(LLM), `app/parsers/`(PDF), pytest, HTTP REST 통신

---

## 목표 상태 (to-be)

```
docs/specs/
├── .ai.md                  # 폴더 구조 변경 반영
├── mvp/
│   ├── .ai.md
│   └── dev_spec.md         # MVP_dev_spec.md 이동 (내용 변경 최소화)
└── mirai/
    ├── .ai.md
    ├── dev_spec.md         # MirAI_dev_spec.md 이동 + 수정
    └── ux_flow.md          # 신규 — proposal §5 기반
```

---

## 완료 기준 (이슈 AC)

- [ ] MirAI_dev_spec.md를 최신 MirAI_proposal.md와 대조해 불일치 항목 업데이트
- [ ] UX 흐름(실전/연습 모드 구분, 화면별 사용자 경험) 별도 문서로 작성
- [ ] dev_spec 기술 스택을 현행 아키텍처(Python FastAPI 엔진 + 서브모듈)에 맞게 현행화
- [ ] docs/specs/.ai.md 최신화

---

## 구현 계획

### Step 1. 폴더 구조 재편 (git mv)

```bash
mkdir -p docs/specs/mvp docs/specs/mirai
git mv docs/specs/MVP_dev_spec.md docs/specs/mvp/dev_spec.md
git mv docs/specs/MirAI_dev_spec.md docs/specs/mirai/dev_spec.md
```

| 파일 | 참조 proposal | 비고 |
|------|-------------|------|
| `mvp/dev_spec.md` | `MVP_proposal.md` (v1) | 이동만, 내용 변경 없음 |
| `mirai/dev_spec.md` | `MirAI_proposal.md` (v2) | 이동 후 Step 2~5에서 수정 |

신규 생성:
- `docs/specs/mvp/.ai.md`
- `docs/specs/mirai/.ai.md`

---

### Step 2. 8축 역량 축 이름 수정

**파일:** `docs/specs/mirai/dev_spec.md`

proposal §5-2 기능07 (line 386) 기준으로 통일:

| # | 변경 전 | 변경 후 |
|---|--------|--------|
| 1 | 직무 전문성 | 의사소통 |
| 2 | 경험의 구체성 | 문제해결 |
| 3 | 논리적 사고 | 논리적 사고 (유지) |
| 4 | 커뮤니케이션 | 직무 전문성 |
| 5 | 조직 적합성 | 조직 적합성 (유지) |
| 6 | 성장 가능성 | 리더십 |
| 7 | 비즈니스 임팩트 | 창의성 |
| 8 | 압박 대응력 | 성실성 |

수정 위치:
- 기능07 역량 축 테이블 (line 306~315)
- API 응답 JSON 키: `jobExpertise`→`communication`, `experienceClarity`→`problemSolving`, `growthPotential`→`leadership`, `businessImpact`→`creativity`, `pressureResponse`→`sincerity` (line 328~331)
- `actionItems` 예시의 axis 값 (line 335)

---

### Step 3. 로드맵 Phase 구조로 변경

**파일:** `docs/specs/mirai/dev_spec.md`

§1 구현 순위 컬럼 및 §4 로드맵 테이블 전면 교체:

| 단계 | 기능 | 사용자에게 전달되는 가치 |
|------|------|--------------------------|
| MVP | 기능 01 — 자소서 맞춤 질문 생성 | "내 서류에서 이런 질문이 나오는구나" |
| Phase 1 | 기능 03·04 — 패널 면접 + 꼬리질문 | 실전 패널 면접 체험, 꼬리질문 대응력 |
| Phase 2 | 기능 07 — 8축 역량 리포트 | 명확한 성장 기준점, 재방문 동기 |
| Phase 3 | 기능 05·02 — 연습 모드 + 서류 진단 | 반복 연습 루프, 원스톱 준비 |
| Phase 4 | 기능 06 — AI 아바타 면접 | 실전 긴장감, 비언어적 역량 |

---

### Step 4. 기술 스택 현행화

**파일:** `docs/specs/mirai/dev_spec.md` — §2 공통 기술 스택

`engine/.ai.md` 기준으로 전면 교체:

| 구분 | 변경 전 | 변경 후 |
|------|--------|--------|
| 서버 | Node.js + Express | Python FastAPI |
| 언어 | TypeScript (strict) | Python 3.12+ |
| PDF 처리 | `pdf-parse` (npm) | PyMuPDF (`fitz`) |
| LLM 클라이언트 | `@anthropic-ai/sdk` | `anthropic` (Python SDK) |
| 타입 시스템 | TypeScript 인터페이스 | Pydantic 모델 (`schemas.py`) |
| 설정 관리 | dotenv | pydantic-settings (`config.py`) |
| 아키텍처 | 모놀리식 | 엔진(서브모듈) + 서비스(서브모듈) 분리 |
| 통신 방식 | 직접 import | HTTP REST (`ENGINE_BASE_URL`, 타임아웃 30초) |
| 테스트 (엔진) | Jest | pytest |

**파일:** `docs/specs/mirai/dev_spec.md` — §2에 서비스 측 스택도 추가:

| 구분 | 추가 항목 | 비고 |
|------|---------|------|
| 인증 | Better Auth | 서비스(Next.js)에서만 처리 |
| ORM | Prisma + PostgreSQL | 서비스가 DB 소유 (엔진은 stateless) |
| 테스트 (서비스) | Vitest | Next.js 서비스 단위 테스트 |

**파일:** `docs/specs/mvp/dev_spec.md` — 기술 스택 섹션도 동일하게 반영

---

### Step 5. API 보완

**파일:** `docs/specs/mirai/dev_spec.md`

1. **`POST /api/interview/start`에 `interviewMode` 추가**

   ```json
   {
     "resumeId": "session-abc",
     "mode": "panel",
     "personas": ["hr", "tech_lead", "executive"],
     "interviewMode": "real"
   }
   ```

   - `"real"`: 세션 중 즉각 피드백 차단, 종료 후 8축 리포트만 제공
   - `"practice"`: 매 답변 후 즉각 피드백 포함

2. **꼬리질문 흐름 명확화**
   - `/api/interview/answer` 응답에 꼬리질문이 포함되는 것이 기본 흐름 (기능04 내장)
   - `/api/interview/followup` — 수동 재요청 또는 별도 꼬리질문 트리거 용도로 역할 명시

---

### Step 6. UX 흐름 문서 작성

**파일:** `docs/specs/mirai/ux_flow.md` (신규)

proposal §5 내용을 개발 관점에서 재구성. 구성:

1. **전체 사용자 여정** — 4 Step 흐름도 (proposal §5-1)
2. **기능 간 데이터 흐름** — 기능01 출력 → 기능03/04 입력 연결 관계
3. **모드 구분 규칙** — 실전 vs 연습, 모드별 기능 활성화 매트릭스 (proposal §5-2 기능03·04·05 테이블)
4. **화면별 구성** — 기능별 UI 상태·와이어프레임 (proposal §5-2 전체)
5. **Phase별 UX 범위** — 어떤 Phase에서 어떤 화면이 활성화되는지
6. **Open Questions** — 미결 사항 (향후 구현 시 결정)

**Scope 규칙:**
- 기능05 하위 3개 모드(가이드/자유/비교) → "연습 모드" 통칭, 상세는 dev_spec 기능05 참조
- 비언어 분석(시선/속도/침묵) → "Phase 4 이후 검토"로 scope-out
- 성장 곡선 그래프 → "DB 도입 이후 제공 예정"으로 scope-out

**Open Questions (ux_flow.md에 포함):**
- [ ] 실전/연습 모드 선택 시점: 기능01 완료 후 vs 기능03 세션 시작 시?
- [ ] 기능05 하위 3개 모드는 연습 모드의 서브모드인가, 별도 개념인가?
- [ ] 기능01 생성 질문 → 기능03/04 전달 방식: 질문 배열 직접 vs resumeId 기반 재생성?
- [ ] 패널 면접 페르소나: 3명 고정 vs 사용자가 1~2명 선택?
- [ ] 세션 중 브라우저 새로고침 시 데이터 소실 허용 여부 (1차 출시 세션/메모리 기반)
- [ ] 면접관 페르소나 질문 순서: 고정(HR→기술팀장→경영진) vs 동적 조율?
- [ ] 세션 종료 조건: 질문 수 기반? 사용자 수동 종료? 시간 제한?

---

### Step 7. .ai.md 최신화

- `docs/specs/.ai.md` — 폴더 구조 변경 반영 (mvp/, mirai/ 설명)
- `docs/specs/mvp/.ai.md` — MVP 원본 보존 목적 설명
- `docs/specs/mirai/.ai.md` — dev_spec.md(API/기술 명세) + ux_flow.md(UX 설계) 역할 설명

---

## 작업 순서

1. Step 1: 폴더 구조 재편 (git mv)
2. Step 2: 8축 역량 축 이름 수정
3. Step 3: 로드맵 Phase 구조 교체
4. Step 4: 기술 스택 현행화 (mirai + mvp)
5. Step 5: API 보완 (interviewMode, 꼬리질문 경로)
6. Step 6: ux_flow.md 신규 작성
7. Step 7: .ai.md 최신화 (3개 파일)
