# Issue #28 — TDD fixtures 구현 계획

## 목표
TDD 시작 전 결정적(deterministic) 테스트 데이터를 레포에 커밋. PDF는 외부 스토리지 정책에 따라 로컬 전용.

## 완료 기준 (AC)
- [ ] `engine/tests/fixtures/expected_parsed.json` 존재
- [ ] `engine/tests/fixtures/mock_llm_response.json` 존재 (카테고리 4개, 질문 12개)
- [ ] `services/{siw,kwan,lww,seung}/tests/fixtures/mock_engine_response.json` 존재 (4개)
- [ ] `services/{siw,kwan,lww,seung}/tests/fixtures/error_responses.json` 존재 (4개)
- [ ] 모든 `.ai.md` 최신화
- [ ] JSON 유효성 검증 통과

## 핵심 결정
| 항목 | 결정 |
|------|------|
| PDF 커밋 여부 | 금지 (멘토 지침: 외부 스토리지 정책) |
| 커밋 대상 | JSON fixtures + .ai.md 만 |
| 스크립트 | 없음 |
| 새 의존성 | 없음 |

## 파일 구조

```
engine/tests/fixtures/
  expected_parsed.json      ← 신규 (PDF 파싱 기대값)
  mock_llm_response.json    ← 신규 (LLM mock, 카테고리 4개 × 질문 3개)
  .ai.md                    ← 최신화

services/{siw,kwan,lww,seung}/tests/fixtures/
  mock_engine_response.json ← 신규 (엔진 응답 mock, 4개 서비스)
  error_responses.json      ← 신규 (400/413/500 에러 시나리오, 4개 서비스)
  .ai.md                    ← 신규 (4개 서비스)
```

## PDF 로컬 준비 (사용자 직접, 커밋 안함)

```bash
# 실제 자소서 PDF 1개 복사
cp <자소서.pdf> engine/tests/fixtures/sample_resume.pdf

# 빈 PDF 생성 (python 예시)
python -c "
from fpdf import FPDF
pdf = FPDF(); pdf.add_page(); pdf.output('engine/tests/fixtures/empty.pdf')
"

# image_only.pdf — 이미지 스캔 PDF를 직접 준비
```

## 검증 명령

```bash
# JSON 유효성
python -m json.tool engine/tests/fixtures/mock_llm_response.json
python -m json.tool engine/tests/fixtures/expected_parsed.json
python -m json.tool services/siw/tests/fixtures/mock_engine_response.json
python -m json.tool services/siw/tests/fixtures/error_responses.json

# 구조 확인
find engine/tests/fixtures services/*/tests/fixtures -type f | sort
```

## 다음 단계
- Issue #29 이후: 이 fixtures를 사용해 엔진 pytest 테스트 작성 (Red 단계)
