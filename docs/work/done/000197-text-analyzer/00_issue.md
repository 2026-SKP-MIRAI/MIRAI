# [#197] feat: [engine] 규칙 기반 텍스트 분석 엔진 구현

> 저장: 2026-03-23

---

## 완료 기준

### 규칙 기반 측정 엔진
- [x] 동일 텍스트 입력 시 항상 동일 점수 반환 (결정론적)
- [x] 응답에 `signals` 필드 추가 (기존 scores 유지, 근거 데이터 추가)
- [x] 8축 점수에 측정 근거 포함
- [x] followup 유형 분류가 규칙 기반으로 동작 (LLM 보조)
- [x] pytest 커버리지 80% 이상

### not_evaluated 타입 도입 (구 #72)
- [x] 8축별 채점 루브릭 명시 (측정값 기반 해석 기준)
- [x] `AxisFeedback`에 `not_evaluated` 추가 — 답변 근거 없는 축 명시적 구분
- [x] `not_evaluated` 축은 `totalScore` 계산에서 제외
- [x] `not_evaluated` 축의 `score`는 `null` 반환 (AxisScores·AxisFeedback 스키마 수정)
- [x] `report_evaluation_v1.md` 삭제하지 않고 보존 (버전 이력 유지)

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------:|
| `engine/app/analyzers/__init__.py` | 신규 생성 |
| `engine/app/analyzers/keywords.py` | 신규 생성 (출처 주석 포함, 1000개 합격 자소서 분석 기반 임계값) |
| `engine/app/analyzers/text_analyzer.py` | `TextSignals` 추가, `analyze()` 함수 |
| `engine/app/prompts/report_evaluation_v2.md` | 루브릭 + few-shot + not_evaluated |
| `engine/app/services/report_service.py` | 규칙 기반 8축 채점 + not_evaluated 처리 |
| `engine/app/services/interview_service.py` | followup 규칙 기반 분류 |
| `engine/app/schemas.py` | `not_evaluated` FeedbackType 추가, `AxisScores`/`AxisFeedback` nullable, `signals` 필드 |
| `engine/.ai.md` | analyzers/ 추가, API 계약 최신화 |
| `engine/scripts/analyze_accepted_resumes.py` | 합격 자소서 1000개 분석 스크립트 (임계값 도출) |

## 작업 내역

### 문제 정의

기존 report_service는 LLM에 점수를 직접 요청했다. 이 방식은:
- **비결정론적**: 동일 면접 기록도 LLM 호출마다 다른 점수 반환
- **불투명**: 왜 그 점수인지 근거 데이터 없음
- **no_evaluated 없음**: 짧은/빈 답변도 강제로 채점됨 → 왜곡된 점수

### 해결 전략

```
면접 답변 → analyze() → TextSignals → 8축 루브릭 공식 → 결정론적 점수
                                                        ↓
                                             LLM에 점수 전달 → 피드백 텍스트만 생성
```

- **`app/analyzers/`**: 규칙 기반 텍스트 분석 모듈 신규 생성
  - `keywords.py`: VAGUE_WORDS, AGENCY_VERB_STEMS, SPECIFICITY_PATTERNS, STAR_KEYWORDS, ACHIEVEMENT_PATTERNS 등 상수 정의. 1000개 합격 자소서 분석으로 임계값 도출 (`HAS_CONTENT_MIN_CHARS=50`, `VAGUE_RATIO_THRESHOLD=0.03`, `STAR_CLARIFY_THRESHOLD=0.4`)
  - `text_analyzer.py`: `TextSignals` frozen dataclass (8개 신호), `analyze()` 순수 함수

- **`report_service.py`**: v1(LLM 채점) → v2(규칙 채점 + LLM 피드백) 전환
  - `_aggregate_signals()`: 히스토리 전체 답변 TextSignals 집계 (float: 최댓값, int: 합산, vague_ratio: 평균)
  - `_score_*()` 8개 함수: 각 축별 루브릭 공식으로 0~100 점수 계산
  - `_parse_report_v2()`: LLM 응답(피드백 텍스트) + 규칙 점수 조합
  - `not_evaluated`: `has_content=False` 시 score=None, type="not_evaluated", totalScore 계산 제외

- **`interview_service.py`**: `_classify_followup_type()` 추가
  - star_score < 0.4 또는 agency_verb_count == 0 → CLARIFY
  - vague_ratio > 0.03 또는 원인·대안 없음 → CHALLENGE
  - 이외 → EXPLORE
  - LLM은 followupQuestion·reasoning 텍스트만 생성

- **`schemas.py`**: `FeedbackType`에 `"not_evaluated"` 추가, `AxisScores`/`AxisFeedback.score`를 `int | None`으로 변경, `AxisFeedback.signals: dict | None` 추가

- **`scripts/analyze_accepted_resumes.py`**: 로컬 PDF 1000개 → fitz로 텍스트 추출 → TextSignals 분포 분석 → 임계값 추천. 결과: `scripts/analysis_output.json`

### 테스트 결과

- 234 passed, 4 skipped (1.85s)
- 커버리지: 93.54% (목표 80%)
- 신규 테스트:
  - `tests/unit/analyzers/test_text_analyzer.py` (15개 — 결정론, 경계값, 각 점수 함수)
  - `tests/unit/services/test_report_service.py` not_evaluated 분기 (5개 추가)
  - `tests/integration/test_report_router.py` not_evaluated·signals 검증 (2개 추가)
