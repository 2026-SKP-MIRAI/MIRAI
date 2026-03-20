# [#97] Pipeline 2-1 — 테스트 결과

> 작성: 2026-03-20

---

## vitest (services/siw)

**결과: 152/152 PASS** (29 파일)

| 테스트 파일 | 케이스 | 결과 |
|-------------|--------|------|
| `tests/unit/role-normalizer.test.ts` | 8 | ✅ |
| `tests/api/trends-route.test.ts` | 2 | ✅ |
| `tests/api/resume-feedback-route.test.ts` | 4 | ✅ |
| 기존 테스트 전체 | 138 | ✅ |

### 신규 테스트 케이스

**role-normalizer.test.ts** (8개)
- 한글 직무명 정규화 ("소프트웨어 개발자" → "백엔드개발자")
- 영어 직무명 정규화 ("backend" → "백엔드개발자")
- 매핑 없는 직무명 → 공백 제거 후 원본 반환
- 빈 문자열 → 기본값 "소프트웨어 개발자"
- 50자 초과 → 잘림 처리
- 대소문자 무관 매핑

**trends-route.test.ts** (2개)
- `ENABLE_RAG` 미설정 시 200 + `{ skills: [], enabled: false }` 반환
- 미인증 시 401

**resume-feedback-route.test.ts** (4개, 기존 수정)
- 200 — feedbackJson 있을 때 `{ feedback: {...}, trendComparison: null }` 반환
- 200+null — feedbackJson=null 시 `{ feedback: null, trendComparison: null }` 반환
- 401 — 미인증
- 404 — resume 없음

---

## pytest (engine)

**결과: 3/3 PASS**

| 테스트 파일 | 케이스 | 결과 |
|-------------|--------|------|
| `tests/integration/test_embed_route.py` | 3 | ✅ |

### 신규 테스트 케이스

**test_embed_route.py** (3개)
- 200 — `{ texts: ["hello"] }` → `embeddings[0]` 768차원 확인
- 400 — 빈 배열 `{ texts: [] }` → 422 Unprocessable Entity
- 422 — `texts` 필드 없음 → 422 Unprocessable Entity

---

## ENABLE_RAG 격리 검증

- `ENABLE_RAG` 미설정 시 기존 152개 전체 테스트 통과 확인
- `trendComparison: null`, `skills: []` 기본값 정상 동작
- 기존 `/api/resumes/*`, `/api/interview/*` 엔드포인트 영향 없음
