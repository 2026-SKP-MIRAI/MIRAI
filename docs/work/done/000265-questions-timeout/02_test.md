# 테스트 결과 — #265

## 테스트 환경
- 테스트 실행일: 2026-03-26

## 단위 테스트
| 파일 | 결과 | 비고 |
|------|------|------|
| services/siw/src/app/api/resume/questions/route.ts | SKIP | 타임아웃 상수 변경만 포함, 로직 변경 없음 |
| engine/app/services/llm_service.py | SKIP | 타임아웃 상수 변경만 포함, 로직 변경 없음 |

## 통합/수동 검증
- [x] `maxDuration` 35 → 60으로 증가: Vercel 함수 최대 실행 시간 60초로 확장
- [x] `AbortSignal.timeout` 30000 → 55000ms: parse 및 questions 엔진 호출 타임아웃 55초로 확장
- [x] `timeout_seconds` 30.0 → 50.0: 엔진 LLM 호출 타임아웃 50초로 확장
- [x] 타임아웃 계층 구조 준수: llm(50s) < AbortSignal(55s) < maxDuration(60s)

## 변경 내용 요약
LLM 질문 생성 시 대용량 이력서 처리 또는 LLM 응답 지연으로 인한 30초 타임아웃 오류를 해결하기 위해 세 계층의 타임아웃 값을 모두 증가시켰다. 엔진 Python 서비스(50s) → Next.js AbortSignal(55s) → Vercel maxDuration(60s) 순으로 여유를 두어 정상적인 타임아웃 계단식 처리가 가능하도록 했다.
