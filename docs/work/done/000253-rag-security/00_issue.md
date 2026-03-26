# fix: [siw] RAG 보안 — vectorStr 런타임 검증 + ENGINE_BASE_URL localhost fallback 제거

## 목적
PR #242 코드 리뷰에서 발견된 siw RAG 서비스 내 보안/안정성 이슈 2건을 수정한다.

## 완료 기준
- [x] `embedText()` 반환값을 사용하기 전, 또는 `$queryRaw` 삽입 직전에 `every(v => typeof v === 'number' && isFinite(v))` 검증 추가 — 실패 시 `[]` 반환
- [x] `ENGINE_BASE_URL` 미설정 시 localhost fallback 대신 `null` 반환 또는 명시적 에러 처리 (공통 헬퍼 `getEngineBaseUrl()` 추출)
- [x] 기존 테스트 통과 + 검증 로직 단위 테스트 추가

## 코드 리뷰

### 버그·로직 오류
- 없음. `isValidEmbeddingVector()` 함수가 빈 배열, NaN, Infinity, 비숫자 타입을 모두 정확히 거부한다.
- `getEngineBaseUrl()`은 `process.env.ENGINE_BASE_URL ?? null`로 미설정 시 null을 반환하며, 각 호출 지점에서 null 체크 후 500 에러 또는 throw를 수행한다.

### 불변식 위반
- 없음. 서비스(siw)가 엔진 API를 호출하는 구조를 그대로 유지하며, LLM 직접 호출 없음.

### 테스트 누락
- 없음. `embedding-client.test.ts` (getEngineBaseUrl, isValidEmbeddingVector), `resume-search.test.ts` (NaN/빈/Infinity 벡터), `vector-search.test.ts` (NaN/빈 벡터) 테스트 추가됨.

### 코드 품질
- `getEngineBaseUrl()`이 `embedding-client.ts`에 위치한 것은 다소 의외이나, 이미 엔진 통신 로직이 집중된 모듈이므로 합리적이다.
- demo route 3개(evaluate, feedback, question)에서는 `getEngineBaseUrl()` 헬퍼를 import하지 않고 `process.env.ENGINE_BASE_URL`을 직접 읽는다. 일관성 면에서 헬퍼를 사용하면 좋겠으나, demo route는 단순 프록시라 현재 방식도 수용 가능하다.

---

## 작업 내역

### 변경 파일
- `services/siw/src/lib/rag/embedding-client.ts`: `getEngineBaseUrl()` 헬퍼 추가 (미설정 시 null), `isValidEmbeddingVector()` 검증 함수 추가, `embedText()` 내 벡터 응답 검증 강화
- `services/siw/src/lib/rag/resume-search.ts`: `$queryRaw` 삽입 전 `isValidEmbeddingVector()` guard 추가
- `services/siw/src/lib/rag/vector-search.ts`: `$queryRaw` 삽입 전 `isValidEmbeddingVector()` guard 추가
- `services/siw/src/lib/interview/interview-service.ts`: `ENGINE_BASE_URL` localhost fallback을 `requireEngineBaseUrl()` 래퍼로 교체
- `services/siw/src/app/api/resume/questions/route.ts`: 동일 교체
- `services/siw/src/app/api/resumes/analyze/route.ts`: 동일 교체
- `services/siw/src/app/api/resumes/route.ts`: 동일 교체
- `services/siw/src/app/api/report/generate/route.ts`: 동일 교체
- `services/siw/src/app/api/practice/feedback/route.ts`: 동일 교체
- `services/siw/src/app/api/demo/evaluate/route.ts`: `process.env.ENGINE_BASE_URL` 직접 읽기 + null 체크
- `services/siw/src/app/api/demo/feedback/route.ts`: 동일 교체
- `services/siw/src/app/api/demo/question/route.ts`: 동일 교체
- `services/siw/src/lib/rag/__tests__/embedding-client.test.ts`: 신규 — getEngineBaseUrl, isValidEmbeddingVector 단위 테스트
- `services/siw/src/lib/rag/__tests__/resume-search.test.ts`: NaN/빈/Infinity 벡터 guard 테스트 추가
- `services/siw/src/lib/rag/__tests__/vector-search.test.ts`: NaN/빈 벡터 guard 테스트 추가
- `services/siw/src/lib/rag/.ai.md`: isValidEmbeddingVector, getEngineBaseUrl 설명 추가

### 구현 결정 사항
- `isValidEmbeddingVector()`를 `embedding-client.ts`에 배치하여 RAG 관련 유틸을 한 곳에 집중
- demo route 3개는 인증 없는 단순 프록시이므로 `getEngineBaseUrl()` 헬퍼 대신 `process.env.ENGINE_BASE_URL` 직접 읽기 유지
- 나머지 인증 필요 route에서는 `requireEngineBaseUrl()` 로컬 래퍼로 null 시 throw

### 주요 변경 로직
1. **벡터 검증**: `isValidEmbeddingVector()`가 `vector.length > 0 && vector.every(v => typeof v === 'number' && Number.isFinite(v))`로 SQL injection 가능한 비정상 벡터를 차단한다. `resume-search.ts`와 `vector-search.ts`의 `$queryRaw` 삽입 전에 호출되어, 실패 시 빈 배열을 반환한다.
2. **ENGINE_BASE_URL 안전 처리**: `getEngineBaseUrl()`이 미설정 시 null을 반환하여 localhost fallback으로 잘못된 요청이 나가는 것을 방지한다. 각 route에서 null 체크 후 500 에러를 반환한다.
