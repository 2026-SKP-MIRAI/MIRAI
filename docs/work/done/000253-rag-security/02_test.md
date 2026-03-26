# 테스트 결과 — #253

## 테스트 환경
- Node.js / vitest
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 결과 | 비고 |
|------|------|------|
| `src/lib/rag/__tests__/embedding-client.test.ts` | PASS | getEngineBaseUrl, isValidEmbeddingVector 단위 테스트 |
| `src/lib/rag/__tests__/resume-search.test.ts` | PASS | 벡터 guard 로직 테스트 |
| `src/lib/rag/__tests__/vector-search.test.ts` | PASS | 벡터 guard 및 빈 결과 처리 테스트 |
| `tests/unit/vector-search.test.ts` | PASS | 기존 단위 테스트 통과 |

## 통합/수동 검증
- [x] `embedText()` 반환값 검증 (`every(v => typeof v === 'number' && isFinite(v))`): `isValidEmbeddingVector()` 함수 추가 및 `embedText()` 내 적용 완료
- [x] `$queryRaw` 삽입 전 벡터 guard: `resume-search.ts`, `vector-search.ts`에서 삽입 전 검증 추가 — 실패 시 `[]` 반환
- [x] `ENGINE_BASE_URL` localhost fallback 제거: `getEngineBaseUrl()` 헬퍼 추출, fallback 없이 null 반환 또는 명시적 에러 처리로 교체 (10곳)
- [x] 기존 테스트 통과: 기존 테스트 스위트 전체 정상 동작

## 테스트 커버리지
- `embedding-client.ts`: `getEngineBaseUrl()` + `isValidEmbeddingVector()` 신규 함수에 대한 단위 테스트 추가
- `resume-search.ts`, `vector-search.ts`: 벡터 guard 경계 조건 (빈 배열, NaN, Infinity 포함 벡터) 테스트 포함
