# 테스트 결과 — #268

## 테스트 환경
- vitest (services/siw)
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 케이스 | 결과 |
|------|--------|------|
| tests/ui/interview-char-limit.test.tsx | 글자 수 카운터가 표시된다 | ✅ PASS |
| tests/ui/interview-char-limit.test.tsx | 입력 시 글자 수가 업데이트된다 | ✅ PASS |
| tests/ui/interview-char-limit.test.tsx | 5000자 초과 시 경고 문구가 표시된다 | ✅ PASS |
| tests/ui/interview-char-limit.test.tsx | 5000자 이하일 때 경고 문구가 표시되지 않는다 | ✅ PASS |
| tests/api/report-generate-route.test.ts | 500: saveReport 재시도 후에도 실패 시 500 반환 | ✅ PASS |

## 통합/수동 검증
- [x] 면접 답변 입력 시 글자 수가 표시되며, 5000자 초과 시 경고 문구 표시: `interview/[sessionId]/page.tsx` textarea 하단에 `char-count` 카운터(N / 5000) 및 `char-warning` 경고 텍스트 추가
- [x] 리포트 DB 저장이 재시도 후에도 실패할 경우 500 응답 반환 및 클라이언트에 실패 안내 표시: `api/report/generate/route.ts` saveWithRetry 최종 실패 시 500 응답 + "리포트 저장에 실패했습니다. 다시 시도해주세요." 메시지, `report/page.tsx` 서버 에러 메시지 표시

## 테스트 커버리지
신규 추가 테스트: 5개 (interview-char-limit.test.tsx 4개, report-generate-route.test.ts saveReport 실패 1개)
