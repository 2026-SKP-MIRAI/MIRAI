# [#210] fix: [engine] /interview/answer 500 에러 — _check_followup required_keys 완화 — 구현 계획

> 작성: 2026-03-23

---

## 완료 기준

- [x] `_check_followup` `required_keys`를 `["shouldFollowUp"]`만으로 변경
- [x] `shouldFollowUp: true`일 때 `followupQuestion` 키 누락 시 fallback 처리 추가
- [x] `/interview/answer` 500 재현 케이스 유닛 테스트 추가

---

## 구현 계획

### Step 1. `required_keys` 축소
- `engine/app/services/interview_service.py:68`
- `required_keys=["shouldFollowUp", "followupType", "followupQuestion", "reasoning"]` → `required_keys=["shouldFollowUp"]`

### Step 2. `followupQuestion` fallback 처리
- `process_answer` 함수 136번 라인 근처
- `followup_data["followupQuestion"]` → `followup_data.get("followupQuestion", "")` 로 변경

### Step 3. 유닛 테스트 추가
- `engine/tests/unit/services/test_interview_service.py`
- `shouldFollowUp: false` + 꼬리질문 키 누락 케이스 테스트 추가
- `shouldFollowUp: true` + `followupQuestion` 키 누락 케이스 fallback 테스트 추가

---

## 해결 내용 (2026-03-24)

### 문제
LLM이 `shouldFollowUp: false`로 판단할 때 `followupQuestion`, `followupType`, `reasoning` 키를 응답에서 생략하는 경우가 있었다. `_check_followup`의 `_parse_object`가 이 키들을 `required_keys`로 요구하고 있어 키 누락 시 `LLMError` → 500 반환.

### 근본 원인
`required_keys`의 역할은 **파싱 필수 키 검증**인데, `shouldFollowUp: false`일 때 꼬리질문 관련 키는 실제로 사용되지 않음에도 불구하고 required로 선언되어 있었음.

### 수정
| 위치 | 변경 전 | 변경 후 |
|------|---------|---------|
| `interview_service.py:68` | `required_keys=["shouldFollowUp", "followupType", "followupQuestion", "reasoning"]` | `required_keys=["shouldFollowUp"]` |
| `interview_service.py:142` | `followup_data["followupQuestion"]` | `followup_data.get("followupQuestion", "")` |

### 테스트
- `test_process_answer_no_500_when_followup_keys_missing` — `{"shouldFollowUp": false}` 만 반환해도 500 없이 다음 질문 반환
- `test_process_answer_followup_question_fallback_when_key_missing` — `{"shouldFollowUp": true}` 만 반환 시 `question=""` fallback 확인
- 전체 19개 테스트 통과
