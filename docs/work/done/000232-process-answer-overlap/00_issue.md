# fix: [engine] process_answer overlap 검증 누락 — validate_followup_overlap 연결

## 사용자 관점 목표
꼬리질문이 답변의 실제 약점을 정확히 공략한다. (#199에서 만든 품질 검증이 실제 면접 플로우에 작동한다.)

## 배경
#199에서 \`validate_followup_overlap\`을 구현했지만 \`/api/interview/followup\` 전용으로만 연결됐고, 실제 면접 플로우인 \`process_answer\`에는 의도적으로 미적용(NOTE 주석)했다. 그런데 프론트엔드에서 \`/api/interview/followup\`을 호출하지 않아 검증 로직이 한 번도 실행되지 않는 상태다. 결과적으로 꼬리질문 품질 검증이 전혀 작동하지 않고 있다.

## 완료 기준
- [x] \`process_answer\`에서 \`shouldFollowUp=True\`일 때 \`validate_followup_overlap\` 적용 — overlap < 0.5 시 \`_check_followup\` 재호출 (최대 2회)
- [x] \`process_answer\` 경로의 NOTE 주석 제거 및 로그 추가 (overlap score, 재생성 여부)
- [x] pytest 기존 \`test_interview_service.py\` 케이스 통과 + overlap 검증 케이스 추가

## 구현 플랜
1. \`process_answer\` 내 \`shouldFollowUp=True\` 분기에 \`validate_followup_overlap\` 삽입
2. 재생성 클로저: \`_check_followup\` 재호출 후 \`FollowupResponse\` 반환 (방법 A)
3. NOTE 주석 제거, 로그 추가
4. 테스트 케이스 추가

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-24

**현황**: 0/3 완료

**완료된 항목**:
- 없음

**미완료 항목**:
- `process_answer`에서 `validate_followup_overlap` 적용
- NOTE 주석 제거 및 로그 추가
- pytest overlap 검증 케이스 추가

**변경 파일**: 0개 (구현 대기, 01_plan.md 작성 완료)

### 2026-03-25

**현황**: 3/3 완료

**완료된 항목**:
- `process_answer`에서 `validate_followup_overlap` 적용 (overlap < 0.5 시 최대 2회 재생성)
- NOTE 주석 제거 및 `logger.info` 로그 추가
- `TestProcessAnswerOverlap` 클래스 추가 (3개 케이스) + 기존 27개 케이스 유지 (30/30 PASS)

**미완료 항목**:
- 없음

**변경 파일**: 2개 (`interview_service.py`, `test_interview_service.py`)

