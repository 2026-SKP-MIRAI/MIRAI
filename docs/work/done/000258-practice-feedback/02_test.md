# 테스트 결과 — #258

## 테스트 환경
- Node.js / vitest + @testing-library/react
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 결과 | 비고 |
|------|------|------|
| `tests/ui/interview-chat.test.tsx` | PASS | practice 모드 피드백 비표시, real 모드 피드백 표시 테스트 |

## 통합/수동 검증
- [x] `interviewMode === "practice"`일 때 `practiceFeedback` UI 미렌더링: `InterviewChat.tsx` 또는 `page.tsx`에서 `interviewMode === "real"` 조건으로 피드백 렌더링 제한 확인
- [x] `interviewMode === "real"`일 때 피드백 정상 표시: real 모드 테스트 케이스 추가 및 확인
- [x] 기존 연습모드 재시도(retry) 흐름 정상 동작: practice 모드 handleSubmit에서 피드백 API 호출 제거 후 retry 흐름 유지 확인

## 테스트 커버리지
- `interview-chat.test.tsx`: practice 모드와 real 모드 분기에 대한 UI 렌더링 테스트 포함
- `page.tsx` handleSubmit: practice 모드에서 피드백 API 호출 미실행 검증
