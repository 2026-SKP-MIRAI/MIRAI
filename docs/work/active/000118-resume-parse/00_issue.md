# feat: [engine] 기능 01 고도화 — /api/resume/parse 신규 엔드포인트 + /questions JSON 수신 전환

## 사용자 관점 목표
이력서 PDF 파싱을 엔진 단일 엔드포인트로 통합하여 서비스가 파싱 결과를 재사용할 수 있게 한다.

## 배경
현재 `/api/resume/questions`는 PDF 파일(multipart)을 수신하여 내부에서 파싱 + 질문 생성을 일체형으로 처리한다. 서비스가 DB 저장용 텍스트를 위해 별도 파싱해야 하므로 이중 파싱 발생(siw/kwan/seung 3개 서비스 모두 해당). `/parse`와 `/questions`를 분리하면 서비스는 parse 결과를 DB 저장과 질문 생성에 동시 사용 가능.

## 완료 기준
- [x] `POST /api/resume/parse` — PDF 파일(multipart) 수신 시 `{ resumeText, extractedLength }` 200 반환
- [x] `/parse` 에러: 파일 없음/비PDF → 400, 빈PDF/이미지PDF → 422, 파싱 실패 → 500
- [x] `POST /api/resume/questions` — `{ resumeText }` JSON body 수신으로 변경 (multipart 제거)
- [x] `/questions` 에러: `resumeText` 누락/빈값 → 400, LLM 오류 → 500
- [x] `engine/.ai.md` API 계약에 `/api/resume/parse` 추가, `/questions` 입력 스펙 변경 반영
- [x] `routers/.ai.md`, `schemas` 관련 `.ai.md` 최신화
- [x] 단위 테스트 6개 이상 (14개) + 통합 테스트 4개 이상 (14개)

## 구현 플랜
1. `schemas.py` — `ParseResponse(resumeText: str, extractedLength: int)`, `QuestionsRequest(resumeText: str)` 추가
2. `routers/resume.py` — `/parse` 신규 (기존 `/questions`의 파일 수신+파싱 로직 이동), `/questions`를 JSON body 수신으로 변경
3. 기존 `parsers/pdf_parser.py`의 `parse_pdf()` 그대로 재사용
4. 테스트 작성 + `.ai.md` 최신화

## 개발 체크리스트
- [x] 테스트 코드 포함 (통합 14개: /parse 9개 + /questions 5개)
- [x] 해당 디렉토리 `.ai.md` 최신화 (engine/.ai.md, routers/.ai.md, tests/.ai.md, app/.ai.md)
- [x] 불변식 위반 없음 (LLM 호출은 `services/`에서만, engine stateless 유지)

---

## 작업 내역

- 2026-03-18: `git merge main` — fast-forward (#71 OCR, seung phase3 포함)
- 2026-03-18: `engine/app/schemas.py` — `ParseResponse`, `QuestionsRequest` 추가
- 2026-03-18: `engine/app/routers/resume.py` — `/parse` 신규, `/questions` JSON 전환
- 2026-03-18: `engine/tests/integration/test_resume_parse_route.py` — 신규 (9개 테스트)
- 2026-03-18: `engine/tests/integration/test_resume_questions_route.py` — JSON body 전면 교체 (5개)
- 2026-03-18: `engine/.ai.md` — `/parse` 계약 추가, `/questions` 계약 수정
- 2026-03-18: `engine/app/routers/.ai.md` — resume.py 엔드포인트 목록 최신화
- 2026-03-18: `engine/tests/.ai.md` — `test_resume_parse_route.py` 목록 추가
- 2026-03-18: `engine/app/.ai.md` — ANTHROPIC_API_KEY → OPENROUTER_API_KEY 수정
- 비고: 서비스 4개(siw/kwan/seung/lww)의 `/questions` FormData → JSON 전환은 별도 PR 예정

