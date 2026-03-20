# fix(engine): practice feedback scoreDelta LLM 추정값 불일치 — 서버 계산으로 교체

## 문제

연습 모드 재답변 시 `scoreDelta`가 실제 `score - previousScore`와 다르게 표시됨.

예: 이전 점수 85 → 새 점수 88 → `scoreDelta = 13` (LLM 추정)
수식상 정답은 3점 향상이지만 13점으로 표시됨.

## 원인

`practice_feedback_retry_v1.md` 프롬프트에서 `scoreDelta`를 **추정값**으로 지시하고 있어 LLM이 `score`와 `scoreDelta`를 독립적으로 산출, 불일치 발생.

## 수정 방향

`PracticeFeedbackRequest`에 `previousScore: int | None` 추가 → 엔진 서비스에서 `scoreDelta = new_score - previous_score` 직접 계산, LLM 추정값 무시.

### 필요 변경 파일
- `engine/app/schemas.py`: `previousScore` 필드 추가
- `engine/app/services/practice_service.py`: `generate_practice_feedback(previous_score=)` 파라미터 + delta 오버라이드
- `engine/app/routers/practice.py`: `body.previousScore` 전달
- `services/siw/src/app/api/practice/feedback/route.ts`: `previousScore` 포워딩
- `services/siw/src/app/(app)/interview/[sessionId]/page.tsx`: `lastScore` 상태 추적 + 재답변 요청 시 전달

## AC
- 이전 85점 → 재답변 88점 시 `scoreDelta = +3` 표시
- `previousScore` 없는 첫 답변은 `comparisonDelta = null` 유지

---

## 작업 내역

### 2026-03-20

**현황**: 2/2 완료 ✅

**완료된 항목**:
- 이전 85점 → 재답변 88점 시 `scoreDelta = +3` 표시 ✅
- `previousScore` 없는 첫 답변은 `comparisonDelta = null` 유지 ✅

**미완료 항목**: (없음)

**변경 파일**: 7개
- `engine/app/schemas.py`: `previousScore: int | None = Field(None, ge=0, le=100)` 추가
- `engine/app/services/practice_service.py`: `previous_score` 파라미터 + delta 오버라이드 로직
- `engine/app/routers/practice.py`: `previous_score=body.previousScore` 전달
- `services/siw/src/app/api/practice/feedback/route.ts`: `previousScore` 포워딩
- `services/siw/src/app/(app)/interview/[sessionId]/page.tsx`: `lastScore` 상태 추적 + 재답변 전달 + 초기화
- `engine/tests/unit/services/test_practice_service.py`: 테스트 14, 15, 16 추가 (16/16 PASSED)
- `engine/.ai.md`: API 계약 업데이트 (`previousScore` 필드, scoreDelta 계산 방식)

