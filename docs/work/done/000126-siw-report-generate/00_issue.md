# fix: SIW report/generate 멱등성 & 동기화 수정 (saveWithRetry await 누락)

## 목적
`POST /api/report/generate` 라우트의 fire-and-forget 저장 버그와 race condition을 수정한다.

## 배경
`saveWithRetry()`에 `await`가 없어 응답 반환 후 DB 저장이 실행됨.
저장 실패 시 다음 요청에서 캐시 miss → 엔진 중복 호출 + AI API 비용 낭비.
또한 동시 요청 시 첫 요청 저장 완료 전에 두 번째 요청이 들어오면 race condition 발생.
내부 retry 재시도도 fire-and-forget으로 되어 있어 동일 문제 존재.

## 완료 기준
- [x] `saveWithRetry()`에 `await` 추가 → 저장 완료 보장 후 응답 반환
- [x] retry 내부의 fire-and-forget도 `await` + try/catch로 교체
- [x] `sessionComplete === false` → 400 응답 체크 추가
- [x] `sessionComplete=false → 400` 테스트 케이스 추가 및 기존 테스트 통과

## 구현 플랜
1. `services/siw/src/app/api/report/generate/route.ts`
   - `sessionComplete` 체크 추가 (sessionId 검증 직후)
   - `saveWithRetry()` → `await saveWithRetry()`
   - retry 내부: `.catch()` → `await` + try/catch
2. `services/siw/tests/api/report-generate-route.test.ts`
   - `sessionComplete: false → 400` 테스트 케이스 추가

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-18

**현황**: 4/4 완료

**완료된 항목**:
- `saveWithRetry()`에 `await` 추가
- retry 내부 fire-and-forget `await` + try/catch 교체
- `sessionComplete === false` → 400 응답 체크 추가
- `sessionComplete=false → 400` 테스트 케이스 추가

**미완료 항목**:
- 없음

**변경 파일**: 4개 (route.ts, error-messages.ts, report-generate-route.test.ts, services/siw/.ai.md)

**비고**: 코드 리뷰(superpowers:code-reviewer) 후 테스트 보강 — fetch mock `ok: true` 누락 수정, `saveReport` 호출 단언 추가, 400 응답 `message` 본문 검증 추가

