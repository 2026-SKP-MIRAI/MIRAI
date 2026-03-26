# chore: [siw/engine] 이력서 질문 생성 타임아웃 체인 버그 수정

Issue #265

## 배경
이력서 질문 생성 엔드포인트(`/api/resume/questions`)에서 parse + questions 두 단계 fetch의 `AbortSignal.timeout`이 30초로 설정되어 있었고, Next.js `maxDuration`도 35초였다. 엔진 LLM 타임아웃(30초)과 거의 같아 실제로는 항상 엔진이 먼저 타임아웃되고 서비스 레벨에서는 정상 에러 처리가 불가능한 상황이었다.

## 완료 기준
- [x] Next.js `maxDuration` 35 → 60으로 증가
- [x] parse/questions fetch `AbortSignal.timeout` 30000 → 55000ms로 증가
- [x] 엔진 `llm_service.py` `timeout_seconds` 30.0 → 50.0으로 증가
- [x] 타임아웃 체인 보장: engine(50s) < service fetch(55s) < maxDuration(60s)

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

타임아웃 체인이 `engine 50s < fetch abort 55s < maxDuration 60s`로 올바르게 설정되었다. 엔진이 먼저 타임아웃되어 서비스 레벨에서 에러를 정상 처리할 수 있다.

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/api/resume/questions/route.ts` | `maxDuration` 35→60, `AbortSignal.timeout` 30000→55000 (parse·questions 모두) |
| `engine/app/services/llm_service.py` | `timeout_seconds` 기본값 30.0→50.0 |

### 기술적 결정
타임아웃 3계층(engine → fetch abort → maxDuration)이 순서대로 작동해야 의미 있는 에러 메시지를 사용자에게 전달할 수 있다. 엔진이 50s에 타임아웃 에러를 반환 → 서비스 fetch가 55s 전에 응답 수신 → 서비스가 에러를 파싱해 클라이언트에 전달 → maxDuration 60s는 전체 안전망 역할.
