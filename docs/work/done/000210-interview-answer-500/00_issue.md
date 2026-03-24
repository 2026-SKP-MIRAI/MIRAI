# fix: [engine] /interview/answer 500 에러 — _check_followup required_keys 완화

## 목적
`/api/interview/answer` 엔드포인트에서 간헐적으로 발생하는 500 에러 수정

## 배경
LLM이 `shouldFollowUp: false`로 판단할 때 `followupQuestion`, `followupType`, `reasoning` 키를 생략하고 응답하는 경우가 있음. `_check_followup`의 `required_keys`에 이 키들이 포함되어 있어 `parse_object`에서 `LLMError`가 발생하고 500 반환됨.

재현 조건: 꼬리질문이 불필요하다고 LLM이 판단할 때 간헐적으로 발생.

관련 파일: `engine/app/services/interview_service.py:68`

## 완료 기준
- [x] `_check_followup` `required_keys`를 `["shouldFollowUp"]`만으로 변경
- [x] `shouldFollowUp: true`일 때 `followupQuestion` 키 누락 시 fallback 처리 추가
- [x] `/interview/answer` 500 재현 케이스 유닛 테스트 추가

## 구현 플랜
1. `interview_service.py:68` — `required_keys=["shouldFollowUp"]`로 축소
2. `process_answer` 136번 라인 `followup_data["followupQuestion"]` → `.get("followupQuestion", "")` fallback 처리
3. `test_interview_service.py`에 `shouldFollowUp:false` + 키 누락 케이스 테스트 추가

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-24

**현황**: 3/3 완료

**완료된 항목**:
- `_check_followup` `required_keys`를 `["shouldFollowUp"]`만으로 변경
- `shouldFollowUp: true`일 때 `followupQuestion` 키 누락 시 fallback 처리 추가
- `/interview/answer` 500 재현 케이스 유닛 테스트 추가

**미완료 항목**:
- (없음)

**변경 파일**: 2개 (interview_service.py, test_interview_service.py)

### 상세 내역

**`engine/app/services/interview_service.py`**
- `_check_followup` `required_keys` 4개 → `["shouldFollowUp"]` 1개로 축소: LLM이 `shouldFollowUp: false` 판단 시 나머지 키를 생략해도 파싱 에러 없이 통과
- `process_answer` line 142: `followup_data["followupQuestion"]` → `.get("followupQuestion", "")`: `shouldFollowUp: true`이지만 followupQuestion 누락 시 빈 문자열로 안전 fallback
- `generate_followup` line 186-188: `followupType`, `followupQuestion`, `reasoning` 직접 접근 → `.get()` fallback: `required_keys` 완화에 따른 일관성 확보

**`engine/tests/unit/services/test_interview_service.py`**
- `test_process_answer_no_500_when_followup_keys_missing`: `{"shouldFollowUp": false}` 만 반환해도 500 없이 다음 질문 반환 검증
- `test_process_answer_followup_question_fallback_when_key_missing`: `{"shouldFollowUp": true}` 만 반환 시 `question=""` fallback 검증

