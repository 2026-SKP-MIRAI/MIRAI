# feat: [고도화] LLM 테스트 에이전트 — E2E 자동 면접 시뮬레이션 및 점수 향상 지표 측정

## 사용자 관점 목표
MirAI 서비스 내부에서 LLM 테스트 에이전트가 실제 지원자처럼 자동으로 면접 세션을 완주하고, 8축 역량 점수 변화를 측정함으로써 프롬프트 개선·엔진 고도화 효과를 정량 지표로 검증할 수 있다.

## 배경
현재 테스트는 단위(pytest, mocked LLM) + 통합(TestClient, mocked LLM) 수준이다. 실제 LLM 응답을 포함한 E2E 흐름 — PDF 업로드 → 질문 생성 → 면접 답변 → 8축 리포트 — 을 자동으로 실행하고, 점수를 시계열로 비교하는 테스트 에이전트가 없다.

dev_spec §5 구현 로드맵상 기능 01~07이 모두 완성된 이후, 고도화 단계에서 프롬프트 품질·모델 변경 효과를 측정하는 기반 인프라로 이 이슈를 구현한다.

> **이 이슈는 모든 주요 기능(기능 01~07) 구현 완료 후 고도화 단계에서 진행한다.**

## 완료 기준
- [x] 테스트 에이전트가 샘플 PDF를 업로드하고 질문 목록을 수신한다
- [x] 테스트 에이전트가 LLM을 사용해 각 질문에 대한 답변을 자동 생성한다 (페르소나: 지원자 역할)
- [x] 꼬리질문(followup) 흐름까지 포함한 완전한 면접 세션을 자동 완주한다
- [x] 세션 종료 후 `POST /api/report/generate`를 호출하여 8축 점수를 수집한다
- [x] 복수 실행 결과를 JSON으로 저장하고 점수 평균·표준편차를 리포트한다
- [x] 프롬프트 버전 A/B 비교 실행을 지원한다 (동일 PDF, 다른 프롬프트)
- [x] CI에서 선택적으로 실행 가능하도록 환경변수 플래그(`RUN_E2E_AGENT=true`)로 제어한다

## 구현 플랜
1. `engine/tests/e2e/` 디렉토리 생성, `test_agent_session.py` 구현
   - 실제 `ENGINE_BASE_URL`에 HTTP 요청 (TestClient 아님, 실제 서버 대상)
   - 또는 `pytest-asyncio` + 실제 OpenAI 클라이언트로 엔진 내부 직접 호출 선택 검토
2. 테스트 에이전트 LLM 역할 구성
   - System prompt: "당신은 면접을 준비하는 지원자입니다. 자연스럽고 구체적인 답변을 생성하세요."
   - 입력: 질문 텍스트 + 자소서 컨텍스트 → 출력: 답변 텍스트
3. 전체 흐름 자동화
   ```
   샘플 PDF 업로드 → questions 수신 → interview/start →
   answer 루프 (+ followup 포함) → report/generate → 점수 수집
   ```
4. 점수 결과 저장: `engine/tests/e2e/results/{timestamp}.json`
5. 비교 리포트 출력: 점수 평균, 표준편차, 이전 실행 대비 delta
6. `engine/tests/e2e/.ai.md` 작성

## 개발 체크리스트
- [ ] 테스트 코드 포함 (에이전트 자체도 단위 테스트 가능하게 설계)
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (LLM 호출은 엔진 내부에서만, 테스트 에이전트는 외부 HTTP 클라이언트)
- [ ] 실제 API 비용 발생 — `RUN_E2E_AGENT=true` 플래그 없이는 CI에서 자동 실행 금지

---

## 작업 내역

### 신규 파일

**`engine/tests/e2e/agent.py`** — `CandidateAgent`
지원자 역할 LLM 답변 생성기. `llm_fn` 주입 패턴으로 단위 테스트 시 mock 사용 가능. `app.*` 임포트 금지 — 엔진 내부에 의존하지 않고 `openai.OpenAI`를 직접 사용. 답변은 `InterviewAnswerRequest.currentAnswer max_length=5000` 제한에 맞게 절단.

**`engine/tests/e2e/runner.py`** — `run_session()`
전체 면접 HTTP 흐름 자동 실행 (parse → start → answer loop → report). 엔진이 업데이트된 history를 반환하지 않으므로 runner가 매 턴 직접 `history.append()`. `currentQuestion` / `currentPersona`는 엔진 스키마 필수 필드로 명시적 전달. `MAX_TURNS=15` 안전 리밋 및 `MIN_HISTORY_FOR_REPORT=5` 검증 포함.

**`engine/tests/e2e/reporter.py`** — `SessionResult` + 통계
`SessionResult` dataclass, `save_result()` (JSON 저장), `compute_stats()` (8축 mean/std/delta), `print_report()` (콘솔 출력). `statistics.stdev` 1개 입력 시 `StatisticsError` 방어를 위해 `len >= 2` 가드 적용.

**`engine/tests/e2e/conftest.py`** — pytest 픽스처
`pytest` 프로세스는 `.env`를 자동 로드하지 않으므로 `engine/.env`를 수동 파싱해 `os.environ.setdefault()`로 주입. `RUN_E2E_AGENT` 없으면 `test_agent_session.py` 자동 skip, `test_agent_unit.py`는 항상 실행. `e2e_pdf_bytes` 픽스처는 실제 PDF 없으면 fitz로 합성 생성.

**`engine/tests/e2e/test_agent_unit.py`** — 단위 테스트 22개
mock LLM 사용, 실제 서버 불필요. CI 항상 실행. CandidateAgent 9개 + compute_stats 9개 + save_result 4개. 전체 통과 확인.

**`engine/tests/e2e/test_agent_session.py`** — E2E 통합 테스트 7개
`RUN_E2E_AGENT=true` + 실제 서버 필요. TestSingleSession 3개 실제 실행 완료 — 10턴, 총점 89, 전 축 0~100 범위 확인.

**`engine/tests/e2e/prompts/candidate_v1.md`** — STAR 구조 200~400자 페르소나
**`engine/tests/e2e/prompts/candidate_v2.md`** — 간결 80~200자 A/B 비교용 페르소나
**`engine/.gitignore`** — `tests/e2e/results/` 추가 (이력서 텍스트 포함 JSON 커밋 방지)

### 수정 파일

**`engine/tests/.ai.md`** — e2e/ 디렉토리 구조·역할 추가

### 주요 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| HTTP 방식 | `httpx.Client` (실제 서버) | TestClient + mocked LLM은 프롬프트 효과 측정 불가 |
| `app.*` 임포트 금지 | `openai.OpenAI` 직접 사용 | 테스트 코드가 엔진 내부에 의존하면 불변식 취지 훼손 |
| history 누적 | runner가 직접 append | 엔진은 업데이트된 history를 반환하지 않음 |
| `stdev` 가드 | `len >= 2` 체크 | 1개 입력 시 `StatisticsError` 발생 |
| conftest `.env` 로드 | `os.environ.setdefault` 수동 파싱 | pytest 프로세스는 `.env` 자동 로드 안 함 → 실행 중 401 발견·수정 |

