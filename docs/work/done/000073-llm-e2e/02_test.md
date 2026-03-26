# [#73] feat: [고도화] LLM 테스트 에이전트 — E2E 자동 면접 시뮬레이션 및 점수 향상 지표 측정 — 테스트 결과

> 작성: 2026-03-25

---

## 최종 테스트 결과

### pytest 단위 테스트 (engine/tests/e2e/test_agent_unit.py)

```
27 passed in 0.18s
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/e2e/test_agent_unit.py` | 27 | ✅ 전체 통과 | CandidateAgent 11개 + TestFormatFeedback 3개 + compute_stats 9개 + save_result 4개 |

### 기존 테스트 회귀 확인

```
250 passed, 2 skipped (기존 4개 실패는 이 이슈 이전부터 존재하는 워크트리 인코딩 문제)
```

| 범위 | 결과 | 비고 |
|------|------|------|
| `tests/unit/services/` (report 제외) | ✅ 회귀 없음 | 기존 통과 유지 |
| `tests/unit/analyzers/` | ✅ 회귀 없음 | 변경 없음 |
| `tests/unit/prompts/` | ✅ 회귀 없음 | 변경 없음 |
| `tests/integration/` (report/practice 제외) | ✅ 회귀 없음 | 변경 없음 |

> **기존 4개 실패** (`test_interview_service.py` — overlap 관련): 내 변경 전부터 존재하는 인코딩 오류. `git diff --name-only HEAD` 결과 해당 파일 미포함 확인.

### E2E 통합 테스트 (engine/tests/e2e/test_agent_session.py)

```
실행 환경: uvicorn app.main:app (localhost:8000) + OpenRouter google/gemini-2.5-flash
```

**TestSingleSession (3개):**

| 테스트 | 결과 | 소요 | 비고 |
|--------|------|------|------|
| `test_session_completes` | ✅ | ~176s | 총점 74, 10턴 완주 |
| `test_session_history_not_empty` | ✅ | ~176s | history 10개 Q&A 정상 포함 |
| `test_session_scores_in_valid_range` | ✅ | ~176s | 전 축 0~100 범위 내 |

**TestFeedbackLoop (1개) — 피드백 루프 핵심 시나리오:**

| 테스트 | 결과 | 비고 |
|--------|------|------|
| `test_feedback_loop_completes` | ✅ | 세션1 74점 → 세션2 80점 (+6 delta) |

검증 방법:
1. `agent2.prompt_log` — 피드백 텍스트가 실제 LLM 프롬프트에 포함됐는지 assert
2. 세션2 전체 Q&A 콘솔 출력 — 사람이 눈으로 답변 개선 여부 확인

**실제 측정 점수 (v1 신입 페르소나, 합성 자소서):**

| 세션 | 총점 | 비고 |
|------|------|------|
| 세션1 (피드백 없음) | 74 | 신입 지원자 페르소나, ~70-80점 목표 |
| 세션2 (피드백 주입) | 80 | 피드백 반영, +6 delta |

> **참고**: TestFollowupIncluded, TestABComparison, TestMultipleRunsStats는 추가 비용 발생으로 선택적 실행 대상. TestFeedbackLoop이 이 이슈의 핵심 AC.

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `engine/tests/e2e/__init__.py` | 패키지 초기화 | ✅ |
| `engine/tests/e2e/.ai.md` | 디렉토리 목적·실행방법·불변식·환경변수 문서 | ✅ |
| `engine/tests/e2e/agent.py` | `CandidateAgent` — 지원자 역할 LLM 답변 생성기 (app.* 임포트 금지, llm_fn 주입 가능) | ✅ |
| `engine/tests/e2e/runner.py` | `SessionRunner.run_session()` — parse → start → answer loop → report 전체 HTTP 흐름 | ✅ |
| `engine/tests/e2e/reporter.py` | `SessionResult` dataclass + `save_result` + `compute_stats` + `print_report` | ✅ |
| `engine/tests/e2e/conftest.py` | `RUN_E2E_AGENT` skip 제어, `base_url` / `e2e_pdf_bytes` 픽스처, `engine/.env` 자동 로드 (pytest 프로세스는 .env를 자동으로 읽지 않으므로 conftest에서 직접 로드) | ✅ |
| `engine/tests/e2e/test_agent_unit.py` | 단위 테스트 27개 (mock LLM, CI 항상 실행) | ✅ |
| `engine/tests/e2e/test_agent_session.py` | E2E 통합 테스트 8개 (RUN_E2E_AGENT=true 필요) — TestFeedbackLoop 포함 | ✅ |
| `engine/tests/e2e/prompts/candidate_v1.md` | 신입 지원자 페르소나 (~70-80점), `{prior_feedback}` 플레이스홀더 포함 | ✅ |
| `engine/tests/e2e/prompts/candidate_v2.md` | A/B 비교용 페르소나 (간결, 80~200자) | ✅ |
| `engine/tests/e2e/results/.gitkeep` | 결과 디렉토리 자리지기 (gitignored) | ✅ |
| `engine/.gitignore` | `tests/e2e/results/` 추가 (이력서 텍스트 포함 JSON 커밋 방지) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `engine/tests/.ai.md` | e2e/ 디렉토리 구조·역할 추가 | ✅ |
| `docs/work/active/000073-llm-e2e/01_plan.md` | 검토 후 수정: 불필요 step 제거, 필수 필드 명시, stdev 가드, app.* 금지 명시 | ✅ |

---

## TDD 사이클

### RED → GREEN

- `test_agent_unit.py` 27개 작성 → `agent.py` / `runner.py` / `reporter.py` 구현 → 27/27 통과
- `test_feedback_loop_completes` — `prior_feedback` 주입 + `prompt_log` assert 추가
- 기존 테스트 250개 회귀 없음

---

## 주요 설계 결정 및 리뷰 수정 내역

| 항목 | 결정 | 이유 |
|------|------|------|
| HTTP 방식 | `httpx.Client` (실제 서버) | TestClient + mocked LLM은 프롬프트 효과 측정 불가 |
| agent.py `app.*` 임포트 금지 | `openai.OpenAI` 직접 사용 | 테스트 코드가 엔진 내부에 의존하면 불변식 취지 훼손 |
| `currentAnswer[:5000]` 절단 | runner에서 강제 적용 | `InterviewAnswerRequest.currentAnswer max_length=5000` 위반 방지 |
| history 누적 | runner가 직접 append | 엔진은 업데이트된 history를 반환하지 않음 |
| `stdev` 가드 | `len >= 2` 체크 | `statistics.stdev` 1개 입력 시 `StatisticsError` 발생 |
| `/resume/questions` 제거 | 플랜에서 삭제 | 인터뷰 흐름과 무관 — `interview/start`가 직접 첫 질문 생성 |
| `RUN_E2E_AGENT` 플래그 | CI 기본 skip | 실제 API 비용 발생, 의도치 않은 CI 실행 방지 |
| conftest `.env` 로드 | `os.environ.setdefault` 수동 파싱 | pytest 프로세스는 pydantic-settings와 달리 `.env`를 자동 로드하지 않아 `AuthenticationError: 401` 발생 → 실행 중 발견·수정 |
| 피드백 루프 검증 | `prompt_log` assert | 점수 상승만으로는 피드백 주입 여부 불확실 — 프롬프트에 실제로 포함됐는지 직접 검증 |
| v1 페르소나 점수대 | ~70-80점 (신입 수준) | 초기 점수가 너무 높으면 피드백 루프 효과 측정 불가; 개선 여지 확보 |
| `AxisScores` flat dict | `isinstance(dict)` 분기 제거 | 스키마 확인 결과 중첩 dict 아님 — dead code 제거 |
