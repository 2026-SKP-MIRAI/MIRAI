# chore: [siw] 면접 데이터 무통보 손실 방지 — 답변 초과 경고 + 리포트 저장 실패 처리

## 완료 기준
- [x] 면접 답변 입력 시 글자 수가 표시되며, 5000자 초과 시 경고 문구 표시
- [x] 리포트 DB 저장이 재시도 후에도 실패할 경우 500 응답 반환 및 클라이언트에 실패 안내 표시

---

## 작업 내역

1. interview/[sessionId]/page.tsx: textarea 하단에 글자 수 카운터 (N / 5000) 추가, 5000자 초과 시 경고 텍스트 노출
2. api/report/generate/route.ts: saveWithRetry 최종 실패 시 throw → 500 응답 반환
3. interview/[sessionId]/report/page.tsx: 에러 상태에서 서버 에러 메시지를 함께 표시
4. 테스트: interview-char-limit.test.tsx 4개, report-generate-route.test.ts saveReport 실패 테스트 1개 추가
