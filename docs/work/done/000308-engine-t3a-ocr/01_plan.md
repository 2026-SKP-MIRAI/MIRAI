# [#308] chore: [engine] t3a.small 업그레이드에 맞춰 OCR 세마포어 상한 상향 및 DPI 하향 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] `engine/app/routers/resume.py`의 `_OCR_SEMAPHORE` 값을 t3a.small 메모리 기준으로 적절히 상향 (예: 4)
- [x] 변경 값에 대한 근거 주석 추가 (인스턴스 스펙 기준)
- [x] `engine/app/parsers/pdf_parser.py`의 `_OCR_DPI` 값을 250 → 200으로 하향
- [x] DPI 변경에 대한 근거 주석 추가 (세마포어 상향에 따른 메모리 안전 마진)
- [ ] 기존 테스트 통과

---

## 변경 근거 (값 산정)

**세마포어:**
- t3a.micro: 1GB RAM → `Semaphore(2)` (1건당 ~400–500MB 여유)
- t3a.small: 2GB RAM, OS + 앱 오버헤드 ~400MB 제외 → ~1.6GB 가용
- OCR 1건당 피크 메모리 추정 ~300–400MB (PyMuPDF fitz + Tesseract)
- 2GB 기준 안전 동시 처리: **4건** (400MB × 4 = 1.6GB)

**DPI:**
- PR #288에서 300→250으로 하향 (속도 개선)
- 세마포어를 4로 상향하면 동시 처리 건수 증가 → 페이지당 메모리 사용량 절감 필요
- DPI는 면적에 비례해 메모리 사용 (200/250)² ≈ 0.64 → 페이지당 ~36% 절감
- 한글 OCR 품질은 200 DPI에서도 충분한 마진 유지 (PR #288 근거 동일)

## 구현 계획

### 1. `engine/app/routers/resume.py` (line 22–23)

**Before:**
```python
# OCR 동시 실행 제한 — t3a.micro 1GB RAM 기준 안전 한계 (동시 2개 초과 시 OOM 위험)
_OCR_SEMAPHORE = asyncio.Semaphore(2)
```

**After:**
```python
# OCR 동시 실행 제한 — t3a.small 2GB RAM 기준 안전 한계
# (OCR 1건당 피크 ~400MB 추정, 2GB 가용 메모리에서 동시 4개까지 허용)
# t3a.micro(1GB) 시절 Semaphore(2) → t3a.small(2GB) 업그레이드로 Semaphore(4)로 상향 (PR #299 참고)
_OCR_SEMAPHORE = asyncio.Semaphore(4)
```

### 2. `engine/app/parsers/pdf_parser.py` (line 10–11)

**Before:**
```python
# OCR 렌더링 해상도 — ~19MB/페이지, max_pages=10 기준 최대 ~190MB
_OCR_DPI = 250
```

**After:**
```python
# OCR 렌더링 해상도 — ~12MB/페이지, max_pages=10 기준 최대 ~120MB
# Semaphore(4) 상향에 따른 동시 처리 증가 → 페이지당 메모리 절감 목적 (250→200, ~36% 감소)
# 한글 OCR 품질은 200 DPI에서도 충분 (PR #288 근거 동일)
_OCR_DPI = 200
```

### 3. `engine/.ai.md`

`parsers/.ai.md` 내 dpi=250 언급을 200으로 최신화.

## 검증

```bash
cd engine
pytest tests/ -v
```

- `test_parse_200_ocr_pdf` 포함 기존 OCR 관련 테스트 통과 확인
- DPI·세마포어 값 변경은 기능 변경이 아니므로 별도 신규 테스트 불필요
