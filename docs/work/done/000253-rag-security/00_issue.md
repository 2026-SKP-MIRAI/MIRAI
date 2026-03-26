# fix: [siw] RAG 보안 — vectorStr 런타임 검증 + ENGINE_BASE_URL localhost fallback 제거

## 목적
PR #242 코드 리뷰에서 발견된 siw RAG 서비스 내 보안/안정성 이슈 2건을 수정한다.

## 완료 기준
- [x] `embedText()` 반환값을 사용하기 전, 또는 `$queryRaw` 삽입 직전에 `every(v => typeof v === 'number' && isFinite(v))` 검증 추가 — 실패 시 `[]` 반환
- [x] `ENGINE_BASE_URL` 미설정 시 localhost fallback 대신 `null` 반환 또는 명시적 에러 처리 (공통 헬퍼 `getEngineBaseUrl()` 추출)
- [x] 기존 테스트 통과 + 검증 로직 단위 테스트 추가

---

## 작업 내역
- `embedding-client.ts`: `getEngineBaseUrl()` 헬퍼 추가 (localhost fallback 제거), `isValidEmbeddingVector()` 검증 함수 추가
- `resume-search.ts`, `vector-search.ts`: `$queryRaw` 삽입 전 벡터 guard 추가, 실패 시 `[]` 반환
- ENGINE_BASE_URL localhost fallback 참조 10곳 전체 교체
- 단위 테스트 추가: `embedding-client.test.ts`, `resume-search.test.ts`, `vector-search.test.ts`
