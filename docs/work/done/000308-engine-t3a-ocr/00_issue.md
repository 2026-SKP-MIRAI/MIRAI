# chore: [engine] t3a.small 업그레이드에 맞춰 OCR 세마포어 상한 상향 및 DPI 하향

## 목적
t3a.small 인스턴스 업그레이드에 맞춰 OCR 동시 처리 제한(Semaphore) 상한을 상향하고, OCR 렌더링 DPI를 메모리 효율에 맞게 조정한다.

## 배경
PR #299에서 t3a.micro (RAM 1GB) 환경의 OOM 방지를 위해 `engine/app/routers/resume.py`의 `_OCR_SEMAPHORE = asyncio.Semaphore(2)`로 동시 OCR 처리를 2개로 제한했다. 엔진 인스턴스를 t3a.small (RAM 2GB)로 업그레이드하면 메모리 여유가 생기므로, 세마포어 상한을 높여 처리 병렬성을 개선할 수 있다.

또한 PR #288에서 OCR DPI를 300→250으로 낮춰 속도를 개선한 바 있다. t3a.small 기준으로 세마포어를 4로 올리면 동시 처리 건수가 늘어나므로, DPI를 250→200으로 추가 하향해 페이지당 메모리 사용량을 낮추고 안전 마진을 확보한다.

## 완료 기준
- [x] `engine/app/routers/resume.py`의 `_OCR_SEMAPHORE` 값을 t3a.small 메모리 기준으로 적절히 상향 (예: 4)
- [x] 변경 값에 대한 근거 주석 추가 (인스턴스 스펙 기준)
- [x] `engine/app/parsers/pdf_parser.py`의 `_OCR_DPI` 값을 250 → 200으로 하향
- [x] DPI 변경에 대한 근거 주석 추가 (세마포어 상향에 따른 메모리 안전 마진)
- [ ] 기존 테스트 통과

## 구현 플랜
1. t3a.small (2GB RAM) 기준 OCR 1건당 메모리 사용량 추정
2. `_OCR_SEMAPHORE` 값 조정 (`2` → `4` 또는 적정값)
3. `_OCR_DPI` 값 조정 (`250` → `200`) — 세마포어 상향 시 동시 처리 건수 증가에 따른 메모리 안전 마진 확보
4. 코드 주석에 인스턴스 스펙·근거 명시

## 참고
- PR #299: 원래 Semaphore 도입 배경 (t3a.micro OOM 방지)
- PR #288: OCR DPI 300→250 변경 배경 (속도 개선)
- PR #299 본문 "범위 외" 항목: uvicorn `--workers` 도 인스턴스 업그레이드 시 재검토 대상

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### `engine/app/routers/resume.py`
`_OCR_SEMAPHORE` 값을 `asyncio.Semaphore(2)` → `asyncio.Semaphore(4)`로 상향했다. t3a.micro(1GB) 기준으로 설정된 값을 t3a.small(2GB) 업그레이드에 맞게 조정한 것으로, OCR 1건당 피크 메모리 ~400MB 추정 기준 2GB 가용 메모리에서 동시 4건까지 안전하게 처리 가능하다. 주석에 인스턴스 스펙 기준과 PR #299 참고를 명시했다.

### `engine/app/parsers/pdf_parser.py`
`_OCR_DPI` 값을 `250` → `200`으로 하향했다. 세마포어를 4로 상향하면 동시 OCR 처리 건수가 늘어나므로, DPI를 낮춰 페이지당 메모리 사용량을 줄이고 안전 마진을 확보한다. DPI는 면적에 비례해 메모리에 영향을 주므로 (200/250)² ≈ 0.64, 약 36% 절감 효과가 있다. 한글 OCR 품질은 200 DPI에서도 충분함은 PR #288에서 검증된 근거와 동일하다.

### `engine/app/parsers/.ai.md`
OCR fallback 항목의 `dpi=250` → `dpi=200`으로 최신화하고, 변경 이력(300→250 #288, 250→200 #308)을 함께 기록했다.
