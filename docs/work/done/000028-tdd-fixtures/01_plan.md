# [#28] chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services) — 구현 계획

> 작성: 2026-03-06

---

## 완료 기준

- [ ] `engine/tests/fixtures/sample_resume.pdf` — 팀 공유로 별도 취득 (git 제외)
- [ ] `engine/tests/fixtures/empty.pdf` — 팀 공유로 별도 취득 (git 제외)
- [ ] `engine/tests/fixtures/image_only.pdf` — 팀 공유로 별도 취득 (git 제외)
- [x] `engine/tests/fixtures/expected_parsed.json` — 파서 예상 출력 (`text`, `extractedLength`)
- [x] `engine/tests/fixtures/mock_llm_response.json` — Claude mock 응답 (카테고리 4개, 8~20개 질문, §5-1 형식)
- [x] `services/*/tests/fixtures/mock_engine_response.json` — 엔진 full 응답 mock `{ questions, meta }` (API 라우트 단위테스트용)
- [x] `services/*/tests/fixtures/error_responses.json` — 400/500 에러 mock (한국어 메시지 포함)
- [x] 각 fixtures 디렉토리 `.ai.md` 최신화

---

## 구현 내역

### 생성 일자: 2026-03-06

### PDF 파일 (git 제외 — 팀 공유)
`*.pdf` 커밋 금지 규칙(CLAUDE.md)에 따라 git에 포함하지 않음.
팀 공유 채널에서 받아 `engine/tests/fixtures/`에 직접 배치.
취득 방법은 `engine/tests/fixtures/.ai.md` 참조.

| 파일 | 설명 |
|------|------|
| `sample_resume.pdf` | 텍스트 기반 한국어 자기소개서 (1페이지) |
| `empty.pdf` | 빈 페이지 — parser edge case |
| `image_only.pdf` | 텍스트 레이어 없는 이미지 PDF — parser edge case |

### 엔진 fixtures (`engine/tests/fixtures/`)

| 파일 | 내용 |
|------|------|
| `expected_parsed.json` | PyMuPDF 실제 추출 결과 기반: `extractedLength=781`, `pageCount=1` |
| `mock_llm_response.json` | 카테고리 4개 × 2개 = 8개 질문, `meta.extractedLength=781` |

### 서비스 fixtures (`services/{siw,kwan,lww,seung}/tests/fixtures/`)

| 파일 | 내용 |
|------|------|
| `mock_engine_response.json` | 엔진 API 성공 응답 mock (mock_llm_response.json과 동일 구조) |
| `error_responses.json` | 400×4·413×1·500×2 에러 응답, 한국어 메시지 |

### 스펙 참조
- `docs/specs/mvp/dev_spec.md` §5-1 — 응답 구조·에러 코드 기준
