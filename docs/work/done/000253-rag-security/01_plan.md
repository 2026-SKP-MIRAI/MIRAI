# [#253] fix: RAG 보안 — vectorStr 런타임 검증 + ENGINE_BASE_URL localhost fallback 제거 — 구현 계획

> 작성: 2026-03-26

---

## 배경

PR #242 코드 리뷰에서 발견된 siw RAG 서비스 내 보안/안정성 이슈 2건:
1. `embedText()` 반환값(NaN, Infinity, 비숫자)이 `$queryRaw`에 직접 삽입될 때 SQL injection 위험
2. `ENGINE_BASE_URL` 미설정 시 localhost fallback이 자동 사용되어 잘못된 요청이 나감

## 완료 기준

- [x] `embedText()` 반환값을 `$queryRaw` 삽입 직전에 `every(v => typeof v === 'number' && isFinite(v))` 검증 추가 — 실패 시 `[]` 반환
- [x] `ENGINE_BASE_URL` 미설정 시 localhost fallback 대신 `null` 반환 또는 명시적 에러 처리
- [x] 기존 테스트 통과 + 검증 로직 단위 테스트 추가

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/lib/rag/embedding-client.ts` | `getEngineBaseUrl()` 헬퍼, `isValidEmbeddingVector()` 함수 추가 |
| `services/siw/src/lib/rag/resume-search.ts` | `$queryRaw` 전 guard 추가 |
| `services/siw/src/lib/rag/vector-search.ts` | `$queryRaw` 전 guard 추가 |
| `services/siw/src/lib/interview/interview-service.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/resume/questions/route.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/resumes/analyze/route.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/resumes/route.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/report/generate/route.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/practice/feedback/route.ts` | localhost fallback 제거 |
| `services/siw/src/app/api/demo/evaluate/route.ts` | 직접 null 체크 |
| `services/siw/src/app/api/demo/feedback/route.ts` | 직접 null 체크 |
| `services/siw/src/app/api/demo/question/route.ts` | 직접 null 체크 |
| `services/siw/src/lib/rag/__tests__/embedding-client.test.ts` | 신규 단위 테스트 |
| `services/siw/src/lib/rag/__tests__/resume-search.test.ts` | NaN/빈/Infinity 벡터 테스트 |
| `services/siw/src/lib/rag/__tests__/vector-search.test.ts` | NaN/빈 벡터 테스트 |

### 구현 상세

**isValidEmbeddingVector:**
```typescript
export function isValidEmbeddingVector(vector: unknown[]): vector is number[] {
  return vector.length > 0 && vector.every(v => typeof v === 'number' && Number.isFinite(v));
}
```

**getEngineBaseUrl:**
```typescript
export function getEngineBaseUrl(): string | null {
  return process.env.ENGINE_BASE_URL ?? null;
}
```

demo route 3개는 인증 없는 단순 프록시이므로 `process.env.ENGINE_BASE_URL` 직접 읽기 유지. 나머지 인증 필요 route는 `requireEngineBaseUrl()` 래퍼로 null 시 throw.

### 테스트 전략
- 빈 배열, NaN, Infinity, 비숫자 타입을 `isValidEmbeddingVector()`가 모두 거부하는지 확인
- `getEngineBaseUrl()` 미설정 시 null 반환 확인
