# [#54] feat: [Phase 2][Engine] 기능07 — 8축 역량 평가 및 실행형 리포트 엔진 구현 — 구현 계획

> 작성: 2026-03-11

---

## 완료 기준

- [x] `POST /api/report/generate` 엔드포인트가 존재하고 동작한다
- [x] `history` 5개 이상 → `200` + `{ scores(8축), totalScore, summary, axisFeedbacks(8개) }` 반환
- [x] `history` 5개 미만 → `422` + 한국어 안내 메시지 반환
- [x] LLM 호출 실패 → `500` 반환
- [x] 필수 필드 누락 → `400` 반환
- [x] `AxisScores` 각 축 값이 0–100 범위를 보장한다 (클램핑 포함)
- [x] `axisFeedbacks`는 항상 8개 (8축 빠짐없이) 반환한다
- [x] `score >= 75`이면 `type="strength"` + 칭찬 피드백, `score < 75`이면 `type="improvement"` + 실행형 피드백
- [x] `growthCurve`는 항상 `null` 반환 (Phase 3 확장 포인트로 보존)
- [x] `engine/app/prompts/report_evaluation_v1.md` 파일이 버전 관리된다
- [x] `pytest` 전체 통과 (신규 단위 16개 + 통합 8개, 전체 86개)

---

## 구현 계획

### 아키텍처 결정

| 결정 | 선택 | 이유 |
|------|------|------|
| LLM 호출 방식 | 싱글 1회 호출 | 비용 ~7.5배 절감, 축간 일관성 유지 |
| LLM 공통화 | `llm_client.py` 추출 | `interview_service` · `report_service` 중복 제거 |
| 최소 답변 검증 | Pydantic(`min_length=1`) + 서비스 로직 2단 | 방어적 설계 |
| 에러 메시지 | `call_llm(error_message=...)` 파라미터 | 서비스 맥락별 메시지 분리 |

### 에러 처리 전략

| 상황 | 예외 | HTTP |
|------|------|------|
| `history` 1~4개 | `InsufficientAnswersError` | 422 |
| `history=[]` | Pydantic `ValidationError` | 400 |
| 필수 필드 누락 | Pydantic `ValidationError` | 400 |
| LLM API 오류 | `LLMError` | 500 |
| JSON 파싱 실패 | `ReportParseError` (LLMError 상속) | 500 |
| `axisFeedbacks != 8` | `ReportParseError` | 500 |
| 축 점수 범위 초과 | — | 200 (클램핑 자동 처리) |

### 구현 단계 (TDD: Red → Green → Refactor)

| 단계 | 내용 | 상태 |
|------|------|------|
| 1 | 스키마 + 예외 추가 (`schemas.py`, `exceptions.py`) | ✅ |
| 2 | `llm_client.py` 공통화, `interview_service` 교체 | ✅ |
| 3 | 프롬프트 작성 (`report_evaluation_v1.md`) | ✅ |
| 4 | `report_service.py` 구현 | ✅ |
| 5 | `report.py` 라우터 + `main.py` 등록 | ✅ |
| 6 | 테스트 작성 (단위 16 + 통합 8) | ✅ |
| 7 | `.ai.md` 최신화 | ✅ |

### 파싱 로직 (`_parse_report`)

1. JSON 파싱 실패 → `ReportParseError`
2. 축 점수 누락 → 50점 fallback
3. `axisFeedbacks != 8` → `ReportParseError`
4. 점수 클램핑: `max(0, min(100, int(val)))`
5. type 강제 보정: `score >= 75` → `"strength"`, `< 75` → `"improvement"` (LLM 오분류 방지)
6. `totalScore` = 8개 축 평균 (정수 반올림)

### `llm_client.call_llm` 파라미터

```python
call_llm(
    prompt: str,
    *,
    model: str | None = None,        # None → settings.openrouter_model
    timeout: float = 30.0,           # 기본값. report_service는 60.0 전달
    max_tokens: int = 1024,          # 기본값. report_service는 2048 전달
    error_message: str = "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",  # 서비스별 커스텀 메시지
) -> str
```

- `interview_service`: 기본값 사용 (timeout=30s, max_tokens=1024)
- `report_service`: `timeout=60.0, max_tokens=2048` 명시적 전달 (출력이 길어 필요)

### Phase 3 확장 포인트

**growthCurve**

`growthCurve`는 현재 항상 `null`. Phase 3에서:
1. 서비스가 `/api/report/generate` 호출 후 결과를 Supabase에 저장
2. 서비스가 과거 점수 이력 조회 → `growthCurve` 계산
3. 서비스가 `growthCurve`를 붙여 프론트에 응답

엔진은 stateless 유지 — `growthCurve` 계산은 서비스 레이어 책임.

**async 설계 결정**

현재 라우터는 `async def` + 동기 `OpenAI` 클라이언트 조합이다. 동기 클라이언트가 이벤트 루프를 블로킹하는 MVP 수준의 한계가 있지만, **의도적으로 `async def`를 유지**한다.

이유: Phase 3에서 8축 병렬 평가로 전환 시 `AsyncOpenAI + await`로 내부 구현만 교체하면 된다. 라우터 시그니처(`async def`)는 변경 불필요.

```python
# 현재 (Phase 2 MVP)
client = OpenAI(...)                          # 동기
response = client.chat.completions.create(...)  # 블로킹

# Phase 3 전환 시 (내부만 교체)
client = AsyncOpenAI(...)
response = await client.chat.completions.create(...)  # 진짜 비동기
# + asyncio.gather로 8축 병렬 호출 가능
```
