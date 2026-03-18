# feat: [기능 01 고도화] PDF 파서 OCR — 이미지 PDF에서 텍스트 추출

## 사용자 관점 목표
스캔본·이미지 기반 자소서 PDF를 업로드해도 텍스트를 정상 추출하여, 기능 01의 맞춤 질문 생성까지 막힘 없이 이어진다.

## 배경
`docs/specs/mirai/dev_spec.md` §4 기능 01 및 `docs/specs/mvp/dev_spec.md` §5-1 기준, 현재 PDF 파서는 PyMuPDF(`fitz`)의 텍스트 레이어(`page.get_text()`)만 추출한다.

> dev_spec §5-1 에러 명세:
> `422` — 빈 PDF(텍스트 0자), **이미지 전용 PDF** — 형식은 유효하나 처리 불가, 재업로드 유도

현재는 이미지만 포함된 PDF(스캔 자소서 등)를 업로드하면 `ImageOnlyPDFError(422)`로 처리되고 사용자에게 재업로드를 요구한다. OCR을 도입하면 이 제약을 제거할 수 있다.

> **이 이슈는 모든 주요 기능(기능 01~07) 구현 완료 후 고도화 단계에서 진행한다.**
> 현재 단계에서는 dev_spec에 정의된 `ImageOnlyPDFError(422)` 동작을 유지한다.

## 완료 기준
- [x] 이미지만 포함된 PDF 업로드 시 OCR을 통해 텍스트 추출 성공 및 정상 응답 반환
- [x] 기존 텍스트 레이어 PDF의 파싱 동작·성능에 영향 없음
- [x] OCR 실패(판독 불가·빈 결과) 시 기존 `ImageOnlyPDFError(422)` 예외 계층 준수
- [x] 이미지 PDF 샘플 픽스처를 `engine/tests/fixtures/`에 추가하고 TDD로 구현
- [x] `ParsedResume` 응답 스키마 변경 없음 (인터페이스 불변)

## 구현 플랜
1. OCR 라이브러리 선택 및 `engine/pyproject.toml` 의존성 추가
   - 후보: `pytesseract` + Tesseract-OCR, `pymupdf4llm`, Vision API (비용·속도 트레이드오프 검토)
2. `engine/app/parsers/pdf_parser.py`의 `ImageOnlyPDFError` 분기에 OCR fallback 추가
   - 텍스트 레이어 추출 실패 시 → 페이지별 이미지 렌더링 → OCR → 텍스트 합산
3. OCR 결과를 기존 `ParsedResume` 스키마로 반환 (인터페이스 변경 없음)
4. `engine/tests/fixtures/`에 이미지 PDF 샘플 추가
5. TDD: Red → Green → Refactor, 기존 테스트 회귀 없음 확인
6. `engine/app/parsers/.ai.md` 최신화

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음 (PDF 파싱은 반드시 `engine/app/parsers/`에서만 — `engine/.ai.md` 불변식 2번)

---

## 작업 내역

### OCR 라이브러리 선택
PyMuPDF 내장 OCR(`page.get_textpage_ocr()`) 채택. pytesseract는 추가 pip 의존성이 필요하고, Vision API는 `engine/.ai.md` 불변식 1번(LLM API 호출은 services/에서만) 위반. PyMuPDF는 시스템 Tesseract 바이너리만 있으면 동작하고 추가 Python 의존성이 없음.

### 핵심 구현 — `engine/app/parsers/pdf_parser.py`
- `_ocr_fallback(doc)` 헬퍼 추가: 페이지별 `get_textpage_ocr(language="eng+kor", dpi=300)` 호출, 예외 시 빈 문자열 반환
- `parse_pdf()`의 `has_images` 분기에 OCR fallback 삽입: OCR 성공 시 `ParsedResume` 반환, 실패 시 기존 `ImageOnlyPDFError(422)` 유지
- `with doc:` 컨텍스트 매니저로 리소스 누수 방지, `_OCR_DPI = 300` 모듈 상수화, `logger.warning` 로깅 추가

### 인프라 — `engine/Dockerfile`
- multi-stage 빌드 도입 (`base` → `production` / `base` → `test`)
- `base`: Tesseract apt 설치 + 프로덕션 deps
- `production`: non-root user + uvicorn CMD
- `test`: tests/ 복사 + dev deps + pytest CMD (프로덕션 이미지에 테스트 코드·dev deps 미포함)

### CI — `.github/workflows/engine-ci.yml`
- 방안 A (Docker 기반) 확정: `docker/build-push-action@v5`의 `target: test`로 test 스테이지 빌드
- GHA 레이어 캐시(`type=gha`) 적용으로 반복 실행 시 빌드 시간 최소화
- `engine/**` path filter로 엔진 변경 시에만 트리거

### 테스트 — 23개 (단위 14개 + 통합 9개), 0 skipped
- OCR 픽스처 2개 런타임 합성 (`conftest.py`): `ocr_target_pdf_bytes` (800×200, 36pt 폰트), `unreadable_image_pdf_bytes` (1×1 흰색 픽셀)
- OCR 단위 테스트 5개 추가: `@requires_tesseract` 마커로 Tesseract 미설치 환경 skip 처리
- OCR 통합 테스트 1개 추가: `test_200_ocr_pdf_success`
- 중복 테스트 1개 제거 (`test_empty_pdf_no_images_raises_empty_pdf_error` — 동일 입력·동일 assertion)

### 의존성
- `engine/pyproject.toml` dev: `Pillow>=10.0.0` 추가 (픽스처 이미지 합성용)
- 프로덕션 의존성 변경 없음 (`pymupdf>=1.24.0` 유지)

### 향후 이슈 주의사항
- `#113`: `feedback_service._build_prompt()`에서 `target_role=None` 시 `TypeError` — None 가드 필수
- `#118`: `/questions` multipart→JSON 전환 시 기존 통합 테스트 9개 전면 수정 필요

