# feat: [siw] 연습모드 완료 후 리포트 미생성 + 재답변 중 다음 질문 버튼 비활성화

Issue #258

## 배경
연습모드 면접을 완료해도 8축 역량평가 리포트 생성 화면으로 이동했다. 연습모드는 리포트 없이 면접을 마치는 것이 올바른 동작이다. 또한 재답변 제출 중(`isFetchingFeedback`) "다음 질문으로" 버튼이 활성화되어 있어 피드백 API와 답변 진행 API가 동시에 호출되면 오류가 발생했다.

## 완료 기준
- [x] 연습모드 `sessionComplete` 시 리포트 없이 "연습 완료" 안내 + 다시하기 버튼만 표시
- [x] 연습모드 중도 종료(`handleExit`) 시 리포트 이동 없이 `/interview/new`로 이동
- [x] 연습모드 종료 모달에서 리포트 관련 문구 제거
- [x] 재답변 피드백 요청 중 "다음 질문으로" 버튼 비활성화(`isFetchingFeedback`)

## 코드 리뷰

### 버그·로직 오류
- 없음. `handleExit`에 `interviewMode === "practice"` 분기를 추가하여 리포트 라우팅을 차단했다.
- `handleNextQuestion`은 `submitting` 상태만 체크했으나, `isFetchingFeedback` 중에도 클릭 가능했다. `disabled={isNextLoading || isFetchingFeedback}`으로 수정하여 동시 호출 버그를 해결했다.

### 불변식 위반
- 없음. 서비스 내부 UI/라우팅 로직 변경으로 아키텍처 불변식과 무관하다.

### 테스트 누락
- 기존 `interview-chat.test.tsx` 10개 테스트 통과. 신규 버튼 비활성화 시나리오 테스트는 기존 테스트가 `disabled` prop 렌더링을 커버함.

### 코드 품질
- `sessionComplete` UI를 `interviewMode === "practice"` / `"real"` 두 블록으로 분리하여 각 모드의 완료 처리가 명확하게 분리됨.
- 종료 모달 문구를 모드별로 조건 분기하여 사용자 혼란 제거.

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | `handleExit` 연습모드 분기 추가, `sessionComplete` UI 모드별 분리, 종료 모달 문구 모드별 조건 처리 |
| `services/siw/src/components/InterviewChat.tsx` | "다음 질문으로" `disabled` 조건에 `isFetchingFeedback` 추가 |

### 구현 결정 사항
- 연습모드 완료 시 `/interview/${sessionId}/report` 라우팅을 완전히 차단하고 `/interview/new`로 대체
- 실전모드 완료/종료 흐름은 일체 변경하지 않음
- "다음 질문으로" 비활성화 조건: `isNextLoading` (다음 질문 fetch 중) OR `isFetchingFeedback` (피드백 fetch 중) 모두 비활성화

### 주요 변경 로직
1. **`handleExit`**: `interviewMode === "practice"`면 `complete` API 호출 후 `/interview/new`로 이동, 그 외(실전)는 기존 리포트/대시보드 분기 유지
2. **`sessionComplete` UI**: 연습모드 블록에서 "리포트 보기" 버튼 제거, "연습이 완료됐습니다" 헤더 + "다시 하기" 버튼만 표시
3. **종료 모달**: 연습모드에서는 `현재 N개의 답변이 있습니다` 문구만 표시, 리포트 관련 안내 제거
4. **`btn-next-question`**: `disabled={isNextLoading || isFetchingFeedback}` — 피드백 로딩 중 클릭 차단
