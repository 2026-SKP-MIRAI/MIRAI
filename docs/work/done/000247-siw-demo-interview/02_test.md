# [#247] feat: [siw] 비로그인 데모 면접 체험 — 테스트 명세

> 작성: 2026-03-26

---

## 테스트 파일 위치

| 파일 | 대상 |
|------|------|
| `services/siw/src/app/api/demo/__tests__/question.test.ts` | 질문 생성 + rate limit |
| `services/siw/src/app/api/demo/__tests__/feedback.test.ts` | 답변 피드백 프록시 |
| `services/siw/src/app/api/demo/__tests__/evaluate.test.ts` | 8축 평가 프록시 |

---

## question.test.ts (10개)

### 검증 대상
- IP 기반 rate limit 6개 시나리오
- 엔진 페르소나·resumeText 전달값 검증

### 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 1 | targetRole 미입력 | 400 |
| 2 | 같은 IP, 같은 날 1회 | 200 + remaining=2 |
| 3 | 같은 IP, 같은 날 2회 | 200 + remaining=1 |
| 4 | 같은 IP, 같은 날 3회 | 200 + remaining=0 |
| 5 | 같은 IP, 같은 날 4회 | 429 + resetAt (엔진 호출 없음) |
| 6 | 다른 IP, 같은 날 | 200 + remaining=2 |
| 7 | 같은 IP, 다른 날 (count=1) | 200 + remaining=2 |
| 8 | 엔진 오류 | 502 |
| 9 | 엔진 호출 시 personas=['tech_lead'] 전달 | 검증 |
| 10 | resumeText에 '이력서 미제출' 포함 | 검증 |

---

## feedback.test.ts (7개)

### 검증 대상
- 필수 파라미터 검증
- 비로그인 허용 (인증 미필요)
- 엔진 응답 passthrough (usage 제거)
- 엔진 오류 처리

### 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 1 | question 미입력 | 400 |
| 2 | answer 미입력 | 400 |
| 3 | answer 공백만 | 400 |
| 4 | 비로그인 정상 호출 | 200 |
| 5 | 엔진 응답 passthrough (usage 제외) | score·feedback·keywords·improvedAnswerGuide 반환, usage 없음 |
| 6 | 엔진 실패 | 502 |
| 7 | 네트워크 오류 | 502 |

---

## evaluate.test.ts (11개)

### 검증 대상
- 필수 파라미터 검증 (4개)
- 비로그인 허용
- 8축 scores + axisFeedbacks 반환 구조
- personaLabel PERSONA_LABELS 변환 검증
- history 5개 패딩 검증
- resumeText 이력서 미제출 안내 포함
- 엔진 오류 처리

### 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 1 | targetRole 미입력 | 400 |
| 2 | question 미입력 | 400 |
| 3 | answer 미입력 | 400 |
| 4 | persona 미입력 | 400 |
| 5 | 비로그인 정상 호출 | 200 |
| 6 | 8축 scores + axisFeedbacks 반환 (usage 없음) | 검증 |
| 7 | tech_lead → '기술팀장' personaLabel 변환 | 검증 |
| 8 | history 5개 패딩 (모두 같은 항목) | 검증 |
| 9 | resumeText에 '이력서 미제출' 포함 | 검증 |
| 10 | 엔진 실패 | 502 |
| 11 | 네트워크 오류 | 502 |

---

## 실행 결과

```
✓ feedback.test.ts  (7 tests)
✓ evaluate.test.ts (11 tests)
✓ question.test.ts (10 tests)

Test Files  3 passed (3)
      Tests 29 passed (29)
```
