# [#253] fix: RAG 보안 — vectorStr 런타임 검증 + ENGINE_BASE_URL localhost fallback 제거 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [x] vectorStr 런타임 검증 추가 (isValidEmbeddingVector)
- [x] ENGINE_BASE_URL localhost fallback 제거 (getEngineBaseUrl 헬퍼)
- [x] 단위 테스트 추가

---

## 구현 계획

1. `embedding-client.ts`에 `getEngineBaseUrl()` 헬퍼 + `isValidEmbeddingVector()` 검증 함수 추가
2. `embedText()`에서 벡터 검증 강화
3. `resume-search.ts`, `vector-search.ts`에서 `$queryRaw` 삽입 전 벡터 guard 추가
4. ENGINE_BASE_URL localhost fallback 참조 전체 교체 (10곳)
5. 단위 테스트 추가
