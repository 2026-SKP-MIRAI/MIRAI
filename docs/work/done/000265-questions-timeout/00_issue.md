# chore: [siw] 이력서 질문 생성 타임아웃 체인 버그 수정

Issue #265

## 배경
이력서 질문 생성 엔드포인트(`/api/resume/questions`)에서 parse + questions 두 단계 fetch의 `AbortSignal.timeout`이 30초로 설정되어 있었고, Next.js `maxDuration`도 35초였다. 엔진 LLM 타임아웃(30초)과 거의 같아 실제로는 서비스 레벨에서 정상 에러 처리가 불가능한 상황이었다.

## 완료 기준
- [x] Next.js `maxDuration` 35 → 60으로 증가
- [x] parse/questions fetch `AbortSignal.timeout` 30000 → 55000ms로 증가
- [x] 타임아웃 체인 보장: engine(30s) < service fetch(55s) < maxDuration(60s)

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

타임아웃 체인이 `engine 30s < fetch abort 55s < maxDuration 60s`로 올바르게 설정되었다. 엔진이 먼저 타임아웃되어 서비스 레벨에서 에러를 정상 처리할 수 있다.

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/api/resume/questions/route.ts` | `maxDuration` 35→60, `AbortSignal.timeout` 30000→55000 (parse·questions 모두) |

### 기술적 결정
엔진 타임아웃(30s)은 다른 서비스에서도 공유하므로 변경하지 않는다. siw 서비스 fetch abort(55s)와 maxDuration(60s)만 늘려 엔진이 30s에 타임아웃 에러를 반환하면 서비스가 에러를 파싱해 클라이언트에 전달할 수 있도록 한다.
