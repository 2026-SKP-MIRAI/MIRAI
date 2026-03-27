# refactor: [engine] resume 라우터 비동기화 + OCR DPI 최적화

## 목적
engine의 resume 라우터에서 발생하는 event loop 블로킹을 해소하고, OCR DPI를 최적화하여 처리 성능과 동시성을 개선한다.

## 배경
`resume.py`의 async 핸들러에서 sync 함수들을 `asyncio.to_thread` 없이 직접 호출 중 → event loop 전체 블로킹.
10명 동시 이미지 PDF 업로드 시 완전 직렬 처리 (마지막 사용자 최대 20분 대기).
`interview_service.py:298`에 동일 패턴(`asyncio.to_thread`) 이미 적용된 선례 있음.

DPI는 픽셀 수에 제곱으로 영향 → 250 DPI 시 ~31% OCR 속도 향상. 200 DPI는 한글 OCR 최소 권장값으로 품질 마진 없어 250 채택.

## 완료 기준
- [x] `_OCR_DPI` 값을 250으로 변경 (`pdf_parser.py:11`)
- [x] `parse_pdf()` 호출을 `asyncio.to_thread`로 비동기화 + `Semaphore(2)` 적용 (`resume.py`)
- [x] `extract_target_role()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] `generate_questions()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] `generate_resume_feedback()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] 기존 테스트 전체 통과 확인 (54 passed, 4 skipped)
- [x] `engine/app/parsers/.ai.md` 최신화
- [x] `engine/app/routers/.ai.md` 최신화

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-27

**현황**: 8/8 완료 → PR #299 오픈

**완료된 항목**:
- [x] `_OCR_DPI` 300 → 250 변경
- [x] `parse_pdf()` `asyncio.to_thread` + `Semaphore(2)` 적용
- [x] `extract_target_role()` `asyncio.to_thread` 적용
- [x] `generate_questions()` `asyncio.to_thread` 적용
- [x] `generate_resume_feedback()` `asyncio.to_thread` 적용
- [x] 기존 테스트 전체 통과 (54 passed, 4 skipped)
- [x] `parsers/.ai.md`, `routers/.ai.md` 최신화

**미완료 항목**: 없음

**변경 파일**: 4개
- `engine/app/parsers/pdf_parser.py`
- `engine/app/routers/resume.py`
- `engine/app/parsers/.ai.md`
- `engine/app/routers/.ai.md`

