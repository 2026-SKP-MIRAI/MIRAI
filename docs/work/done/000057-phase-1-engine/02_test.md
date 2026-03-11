# [#57] seung Phase 1 — 테스트 현황

> 작성: 2026-03-10 | 총 52개 | 플랜: `01_plan.md`

## 진행 현황 요약

| 구분 | 전체 | 통과 | 실패 | 미구현 |
|------|------|------|------|--------|
| API 단위 (vitest/node) | 24 | 24 | 0 | 0 |
| UI 단위 (vitest/jsdom) | 17 | 17 | 0 | 0 |
| E2E — API 모킹 (Playwright) | 9 | 9 | 0 | 0 |
| E2E — 실제 엔진 연동 (Playwright) | 2 | 2 | 0 | 0 |
| **합계** | **52** | **52** | **0** | **0** |

---

## Vitest — 단위 테스트

### `tests/api/questions.test.ts` — 9개 (기존 6 + 신규 3)

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 1 | 파일 없으면 400 반환 | 🟢 GREEN | |
| 2 | 엔진 성공 응답(200) 그대로 전달 | 🟢 GREEN | |
| 3 | 엔진 400 에러 그대로 전달 | 🟢 GREEN | |
| 4 | 엔진 422 에러 그대로 전달 | 🟢 GREEN | |
| 5 | 엔진 500 에러 그대로 전달 | 🟢 GREEN | |
| 6 | fetch 자체 실패 시 500 반환 | 🟢 GREEN | |
| 7 | 응답에 resumeId 포함 | 🟢 GREEN | Prisma mock |
| 8 | Prisma resume.create 호출 검증 | 🟢 GREEN | resumeText + questions 저장 |
| 9 | PDF 추출 실패 시 resumeId=null 반환 | 🟢 GREEN | best-effort |

### `tests/api/interview-start.test.ts` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 10 | 성공: sessionId + firstQuestion 반환 | 🟢 GREEN | |
| 11 | resumeId 누락 시 400 반환 | 🟢 GREEN | |
| 12 | resume 없으면 404 반환 | 🟢 GREEN | |
| 13 | 엔진 오류 시 500 전파 | 🟢 GREEN | |
| 14 | personas 기본값 동작 확인 | 🟢 GREEN | hr/tech_lead/executive |

### `tests/api/interview-answer.test.ts` — 10개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 15 | 성공: nextQuestion 반환 (main) | 🟢 GREEN | |
| 16 | 꼬리질문: type="follow_up" 반환 | 🟢 GREEN | |
| 17 | sessionComplete=true: nextQuestion=null | 🟢 GREEN | |
| 18 | sessionId 누락 시 400 반환 | 🟢 GREEN | |
| 19 | 빈 답변(공백만) 시 400 반환 | 🟢 GREEN | DB 조회 없이 즉시 거절 |
| 20 | 빈 문자열 답변 시 400 반환 | 🟢 GREEN | DB 조회 없이 즉시 거절 |
| 21 | 5000자 초과 답변은 5000자로 잘라서 엔진에 전달 | 🟢 GREEN | 엔진 contract 준수 |
| 22 | session 없으면 404 반환 | 🟢 GREEN | |
| 23 | 이미 완료된 세션에 답변 시 400 반환 | 🟢 GREEN | 엔진 호출 없이 거절 |
| 24 | 엔진 오류 전파 | 🟢 GREEN | |

### `tests/components/UploadForm.test.tsx` — 7개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 25 | idle 상태: 파일 선택 input + 버튼 렌더링 | 🟢 GREEN | |
| 26 | 파일 미선택 시 버튼 비활성화 | 🟢 GREEN | |
| 27 | uploading 상태: 스피너 + 버튼 비활성화 | 🟢 GREEN | |
| 28 | processing 상태: 분석 중 문구 + 버튼 비활성화 | 🟢 GREEN | |
| 29 | error 상태: 에러 메시지 role="alert" 표시 | 🟢 GREEN | |
| 30 | 파일 선택 후 submit → onSubmit 콜백 호출 | 🟢 GREEN | |
| 31 | 파일 선택 시 파일명 표시 | 🟢 GREEN | |

### `tests/components/QuestionList.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 32 | 카테고리별 그룹핑 후 섹션 렌더링 | 🟢 GREEN | |
| 33 | 질문 개수 표시 | 🟢 GREEN | |
| 34 | 카테고리 제목 표시 | 🟢 GREEN | |
| 35 | 질문 텍스트 렌더링 | 🟢 GREEN | |
| 36 | 다시 하기 버튼 클릭 → onReset 호출 | 🟢 GREEN | |

### `tests/components/InterviewChat.test.tsx` — 5개

| # | 테스트 이름 | 상태 | 비고 |
|---|------------|------|------|
| 37 | 질문 버블 렌더 (페르소나 라벨 포함) | 🟢 GREEN | |
| 38 | type="follow_up" 시 "꼬리질문" 배지 표시 | 🟢 GREEN | |
| 39 | sessionComplete 완료 화면 렌더 | 🟢 GREEN | |
| 40 | 답변 버블 렌더 | 🟢 GREEN | |
| 41 | main 타입 질문에는 꼬리질문 배지 없음 | 🟢 GREEN | |

---

## Playwright — E2E 테스트

### `tests/e2e/upload-flow.spec.ts` — 4개 (API 모킹)

| # | 테스트 이름 | 상태 | 소요 | 비고 |
|---|------------|------|------|------|
| 42 | 성공: PDF 업로드 후 카테고리별 질문 표시 | 🟢 GREEN | 2.5s | API 모킹 |
| 43 | 422 에러: 텍스트 없는 PDF 에러 메시지 표시 | 🟢 GREEN | 2.5s | API 모킹 |
| 44 | 500 에러: 서버 오류 메시지 표시 | 🟢 GREEN | 2.6s | API 모킹 |
| 45 | 다시 하기: 결과 화면에서 업로드 폼으로 복귀 | 🟢 GREEN | 2.6s | API 모킹 |

### `tests/e2e/interview-flow.spec.ts` — 5개 (API 모킹)

| # | 테스트 이름 | 상태 | 소요 | 비고 |
|---|------------|------|------|------|
| 46 | 업로드 → 면접 시작 → 첫 질문 버블 표시 | 🟢 GREEN | 3.5s | API 모킹 |
| 47 | 답변 제출 → 꼬리질문 배지 표시 | 🟢 GREEN | 2.8s | API 모킹 |
| 48 | 답변 제출 → 다른 페르소나 질문 전환 | 🟢 GREEN | 2.5s | API 모킹 |
| 49 | sessionComplete → 면접 완료 화면 표시 | 🟢 GREEN | 2.5s | API 모킹 |
| 50 | sessionId 없이 /interview 접근 → /resume 리다이렉트 | 🟢 GREEN | 2.4s | API 모킹 |

### `tests/e2e/real-flow.spec.ts` — 1개 (실제 엔진 연동)

| # | 테스트 이름 | 상태 | 소요 | 비고 |
|---|------------|------|------|------|
| 51 | 실제 자소서 업로드 → 질문 생성 | 🟢 GREEN | 13.1s | 엔진 실제 연동 |

### `tests/e2e/real-interview-flow.spec.ts` — 1개 (실제 엔진 + Supabase 연동)

| # | 테스트 이름 | 상태 | 소요 | 비고 |
|---|------------|------|------|------|
| 52 | 이슈 #57: 자소서 업로드 → 패널 면접 → 꼬리질문 전체 플로우 | 🟢 GREEN | 24.8s | 엔진 + Supabase 실제 연동, **영상 녹화** |

---

## 녹화 영상

| 파일 | 내용 |
|------|------|
| `test-results/real-interview-flow-.../video.webm` | 이슈 #57 전체 플로우: PDF 업로드 → resumeId 생성 → 면접 시작 → 첫 질문(페르소나) → 답변 → 꼬리질문/다음 페르소나 질문 |

---

## 아키텍처 불변식 검증

| 항목 | 상태 |
|------|------|
| LLM 직접 호출 없음 (`grep openai\|OPENROUTER services/seung/src`) | ✅ |
| `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` 없음 | ✅ |
| 엔진 코드 변경 없음 | ✅ |
| `interviewMode: "practice"` 미구현 (Phase 3 예정) | ✅ |

---

## 작업 로그

| 시각 | 내용 |
|------|------|
| 2026-03-10 | Prisma 스키마 + Supabase 마이그레이션 완료 |
| 2026-03-10 | API 라우트 TDD: /interview/start, /answer, /session 구현 |
| 2026-03-10 | InterviewChat, AnswerInput 컴포넌트 구현 |
| 2026-03-10 | /resume 완료 화면 "면접 시작" 버튼 추가 |
| 2026-03-10 | Vitest 38개 통과 (기존 18 + 신규 20) |
| 2026-03-10 | Playwright E2E 모킹 9개 통과 |
| 2026-03-10 | real-interview-flow.spec.ts 추가 — 실제 연동 E2E 통과 (24.8s, 영상 녹화) |
| 2026-03-10 | 검증 단계 버그 수정 3건: currentQuestionType 페이지 복원, E2E mock resumeId 누락, engine/.ai.md 필드 누락 |
| 2026-03-10 | prisma migrate add-question-type 적용 완료 |
| 2026-03-11 | 시니어 리뷰 반영: UX 오류 피드백(submitError), 완료 세션 400 가드, 타입 나로잉(PersonaType/QuestionType), console.error 컨텍스트 로깅, 인증 TODO 문서화 |
| 2026-03-11 | 코드 리뷰 전체 반영 (HIGH 2건 + MEDIUM 5건 + LOW 3건): practice 타입 제거, TOCTOU 방어(P2025), 빈 답변 조기 거절, URL 인코딩, 더블클릭 ref 가드, select 절 최적화, 엔진 응답 검증, React key 수정 — Vitest 41/41 통과 |

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 리팩토링 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |
