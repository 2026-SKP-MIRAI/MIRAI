# fix: [siw] /api/resumes questions fetch 타임아웃 버그 수정

## 목적
/api/resumes 엔드포인트의 fetch 타임아웃을 엔진 타임아웃보다 충분히 크게 설정해 에러를 정상 처리할 수 있도록 한다.

## 배경
services/siw/src/app/api/resumes/route.ts에서 엔진 호출 시 AbortSignal 타임아웃이 짧게 설정되어 있다.
- questions fetch: AbortSignal.timeout(30000) → 엔진 LLM 타임아웃(30s)과 동일, race condition 발생
- feedback fetch: AbortSignal.timeout(35000) → 엔진 타임아웃 대비 여유 5초뿐, 불안정

올바른 체인: engine(30s) < fetch abort(55s) < ALB(300s)

## 완료 기준
- [x] resumes/route.ts questions fetch AbortSignal.timeout 30000 → 55000
- [x] resumes/route.ts feedback fetch AbortSignal.timeout 35000 → 55000
- [x] 타임아웃 체인 보장: engine(30s) < service fetch(55s) < ALB(300s)

## 구현 플랜
services/siw/src/app/api/resumes/route.ts
- L89: AbortSignal.timeout(30000) → AbortSignal.timeout(55000)
- fetchFeedback 내 AbortSignal.timeout(35000) → AbortSignal.timeout(55000)

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/api/resumes/route.ts` | questions fetch AbortSignal.timeout 30000→55000, feedback fetch 35000→55000 |
| `services/siw/src/app/api/resumes/.ai.md` | 신규 생성 — 디렉토리 목적·구조·타임아웃 체인 기술 |

### 기술적 결정
엔진 타임아웃(30s)은 변경하지 않는다. questions fetch와 feedback fetch의 AbortSignal을 모두 55s로 통일해 엔진이 30s에 에러를 반환하면 서비스가 정상 수신·처리할 수 있도록 한다.
