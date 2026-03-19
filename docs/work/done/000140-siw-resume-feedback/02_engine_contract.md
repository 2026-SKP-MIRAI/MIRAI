# Engine API 계약서 — /api/resume/feedback

> 작성: 2026-03-19 | 소스: engine/app/schemas.py, feedback_service.py, routers/resume.py

---

## 요청 (Request)

- **Method:** POST
- **Path:** /api/resume/feedback
- **Content-Type:** application/json
- **Body:**
  ```json
  {
    "resumeText": "string (min_length=1, required)",
    "targetRole": "string (min_length=1, required)"
  }
  ```

> ⚠️ `targetRole`은 빈 문자열(`""`) 불가. `"소프트웨어 개발자"` fallback 사용.

---

## 응답 (Response)

### 200 OK
```json
{
  "scores": {
    "specificity": 75,
    "achievementClarity": 80,
    "logicStructure": 70,
    "roleAlignment": 65,
    "differentiation": 60
  },
  "strengths": ["강점1", "강점2"],
  "weaknesses": ["약점1", "약점2"],
  "suggestions": [
    { "section": "경험", "issue": "수치가 없음", "suggestion": "구체적 수치 추가" }
  ]
}
```

### 400 Bad Request
- resumeText 누락/빈 문자열, targetRole 누락/빈 문자열
- 응답: `{ "detail": "..." }`

### 500 Internal Server Error
- LLM 호출 실패, JSON 파싱 실패
- 응답: `{ "detail": "..." }`

---

## ResumeFeedbackScores 정확한 필드명

| 필드 | 타입 | 범위 |
|------|------|------|
| `specificity` | int | 0-100 |
| `achievementClarity` | int | 0-100 |
| `logicStructure` | int | 0-100 |
| `roleAlignment` | int | 0-100 |
| `differentiation` | int | 0-100 |

> ✅ page.tsx `ResumeFeedbackScores` 타입과 완전 일치

---

## SuggestionItem 정확한 필드명

| 필드 | 타입 | 비고 |
|------|------|------|
| `section` | str | ← **"category" 아님** |
| `issue` | str | |
| `suggestion` | str | |

> ✅ page.tsx `SuggestionItem` 타입과 완전 일치

---

## strengths / weaknesses 제약

- `strengths`: list[str], min=2, max=3
- `weaknesses`: list[str], min=2, max=3
- `suggestions`: list[SuggestionItem], min=1

---

## inferredTargetRole

- **feedback 응답에 없음** (ResumeFeedbackResponse 미포함)
- `/api/resume/questions` 응답에도 현재 없음 (#113 미머지)
- siw `create()` 시 `inferredTargetRole`은 항상 `null`

---

## 01_plan.md와의 차이점

| 항목 | 결과 |
|------|------|
| `feedbackData?.inferredTargetRole` | 이미 주석 처리됨 ✅ |
| SuggestionItem.section | plan·engine 모두 `section` ✅ |
| scores 5개 필드명 | 완전 일치 ✅ |
| targetRole "소프트웨어 개발자" | min_length=1 충족 ✅ |

> **결론:** 01_plan.md는 engine 코드와 실질적으로 일치. 추가 수정 불필요.

---

## siw 호출 시 주의사항

1. fetch mock 순서: parse(1번) → Promise.all[questions(2번), feedback(3번)]
2. 기존 테스트 `mockFetch.mockResolvedValueOnce` 2개 → **3개로 확장** 필요
3. `AbortSignal.timeout(30000)` 사용
4. `.then(r => r.ok ? r.json() : null).catch(() => null)` 패턴으로 best-effort
