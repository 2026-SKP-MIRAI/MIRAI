# fix: [siw] 면접 데이터 무통보 손실 방지 — 답변 초과 경고 + 리포트 저장 실패 처리

Issue #268

## 배경
면접 답변이 5000자를 초과해도 사용자에게 경고 없이 잘려 저장되었다. 또한 `saveWithRetry` 재시도 후에도 저장 실패 시 엔진 리포트를 그냥 반환해 사용자가 리포트를 봤지만 DB에는 저장되지 않는 상황이 발생했다.

## 완료 기준
- [x] 면접 답변 입력 시 글자 수가 표시되며, 5000자 초과 시 경고 문구 표시
- [x] 리포트 DB 저장이 재시도 후에도 실패할 경우 500 응답 반환 및 클라이언트에 실패 안내 표시

---

## 코드 리뷰

### 검토 결과
특이사항 없음.

- `data-testid="char-count"` / `data-testid="char-warning"` — 테스트 접근성 확보
- `saveWithRetry` 내부에서 `throw err2` 추가 후 외부 try-catch에서 500 반환 — 기존 silent fail 해결
- 리포트 페이지의 에러 메시지 표시 개선(`error` 텍스트 포함)

---

## 작업 내역

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/(app)/interview/[sessionId]/page.tsx` | 5000자 카운터 + 초과 경고 UI 추가 |
| `services/siw/src/app/api/report/generate/route.ts` | `saveWithRetry` 최종 실패 시 500 반환 |
| `services/siw/src/app/(app)/interview/[sessionId]/report/page.tsx` | 에러 메시지 텍스트 표시 추가 |
| `services/siw/src/app/api/report/generate/.ai.md` | saveWithRetry 500 반환 동작 기술 |
| `services/siw/tests/api/report-generate-route.test.ts` | saveReport 2회 실패 시 500 반환 테스트 추가 |

### 구현 상세
답변 textarea 하단에 `{answer.length} / 5000` 카운터를 추가하고, 5000자 초과 시 `text-amber-600` 색상으로 경고 메시지를 표시한다. `saveWithRetry`는 재시도 실패 시 `throw err2`로 에러를 상위로 전파하고, 외부 try-catch에서 `{ message, status: 500 }`을 반환한다.
