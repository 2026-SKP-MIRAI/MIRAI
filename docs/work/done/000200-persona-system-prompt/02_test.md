# [#200] 페르소나 System Prompt 강화 — 테스트 결과

> 작성: 2026-03-24

---

## 테스트 실행 결과

### 전체 요약

| 항목 | 결과 |
|------|------|
| 총 테스트 수 | 24개 |
| 통과 | 24개 |
| 실패 | 0개 |
| 신규 모듈 커버리지 | 100% |

---

## 테스트 파일별 상세

### 1. `tests/unit/analyzers/test_pressure_controller.py` — 12 tests

| 테스트 | 설명 |
|--------|------|
| `test_calc_answer_quality_all_zeros` | 모든 점수 0 → quality = 0.0 |
| `test_calc_answer_quality_all_max` | star=1.0, spec=1.0, ach=1.0 → quality = 100.0 |
| `test_calc_answer_quality_weighted` | 가중치 검증: star*0.5 + spec*0.3 + ach*0.2 |
| `test_calc_answer_quality_partial` | 일부 점수만 있을 때 계산 정확성 |
| `test_classify_pressure_no_content` | has_content=False → CLARIFY |
| `test_classify_pressure_high_vague` | vague_ratio > 0.04 → CLARIFY |
| `test_classify_pressure_no_agency_verb` | agency_verb_count == 0 → CLARIFY |
| `test_classify_pressure_low_quality` | answer_quality < 60 → CHALLENGE |
| `test_classify_pressure_explore` | 정상 답변 → EXPLORE |
| `test_classify_pressure_boundary_vague` | vague_ratio = 0.04 경계값 (CLARIFY 미발동) |
| `test_classify_pressure_boundary_quality` | answer_quality = 60.0 경계값 (CHALLENGE 미발동) |
| `test_classify_pressure_deterministic` | 동일 입력 10회 반복 → 항상 동일 결과 |

**커버리지**: `pressure_controller.py` 100%

---

### 2. `tests/unit/analyzers/test_answer_signals.py` — 6 tests

| 테스트 | 설명 |
|--------|------|
| `test_format_persona_signals_hr` | HR 페르소나 — teamwork_count, star_score, agency_verb_count 포함 확인 |
| `test_format_persona_signals_tech` | 기술팀장 페르소나 — technical_count, specificity_score, agency_verb_count 포함 확인 |
| `test_format_persona_signals_exec` | 경영진 페르소나 — business_count, achievement_score, star_score 포함 확인 |
| `test_format_persona_signals_unknown_falls_back` | 알 수 없는 페르소나 → HR 포맷 fallback |
| `test_format_persona_signals_empty_answer` | 빈 답변 → 0값 정상 처리 |
| `test_format_persona_signals_deterministic` | 동일 입력 → 항상 동일 출력 (결정론성) |

**커버리지**: `answer_signals.py` 100%

---

### 3. `tests/unit/services/test_interview_service_persona.py` — 6 tests

| 테스트 | 설명 |
|--------|------|
| `test_hr_persona_uses_hr_prompt` | HR 페르소나 → `interview_followup_hr_v3.md` 로드 확인 |
| `test_tech_lead_persona_uses_tech_prompt` | 기술팀장 → `interview_followup_tech_lead_v3.md` 로드 확인 |
| `test_executive_persona_uses_exec_prompt` | 경영진 → `interview_followup_executive_v3.md` 로드 확인 |
| `test_unknown_persona_fallback` | 알 수 없는 페르소나 → `interview_followup_v2.md` fallback |
| `test_persona_signals_injected_in_prompt` | `{persona_signals}` 플레이스홀더 치환 확인 |
| `test_pressure_type_injected_in_prompt` | `{pressure_type}` 플레이스홀더 치환 확인 |

---

## 커버리지 상세

```
Name                                          Stmts   Miss  Cover
-----------------------------------------------------------------
app/analyzers/pressure_controller.py             18      0   100%
app/analyzers/answer_signals.py                  24      0   100%
app/services/interview_service.py               ~85    ~51    40%
-----------------------------------------------------------------
```

> `interview_service.py` 40%: 신규 추가 로직만 테스트. 기존 라인은 별도 테스트(`test_interview_service.py` 22개)에서 커버.

---

## 주요 설계 결정 및 근거

### vague_ratio 임계값 0.04 (이슈 원문 0.4에서 수정)
- `text_analyzer` 코퍼스 실측 범위: 0 ~ 0.0483 (최대값)
- 원문 스펙 0.4는 dead-on-arrival (실제로 절대 도달 불가)
- p90 기준 0.04 적용 → 실제로 의미 있는 분류 가능

### answer_quality 가중치 공식
```python
(star_score * 0.5 + specificity_score * 0.3 + achievement_score * 0.2) * 100
```
- STAR 완성도(star)가 가장 중요 → 50%
- 구체성(specificity) → 30%
- 성취 표현(achievement) → 20%

### 프롬프트 파일명 컨벤션
- 기존: `interview_followup_v2.md` (단일 프롬프트, 내부 페르소나 분기)
- 변경: `interview_followup_{persona}_v3.md` (페르소나별 독립 파일)
- 이유: 기존 `interview_{role}_{version}` 네이밍 패턴 준수, v2 다음 버전이므로 v3

---

## 회귀 테스트

기존 `test_interview_service.py` 22개 테스트 전원 통과 확인 (신규 변경으로 인한 regression 없음).
