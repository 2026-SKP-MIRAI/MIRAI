# [#288] refactor: [engine] resume 라우터 비동기화 + OCR DPI 최적화 — 구현 계획

> 작성: 2026-03-27 | Planner + Architect + Critic 합의 완료

---

## 완료 기준

- [x] `_OCR_DPI` 값을 250으로 변경 (`pdf_parser.py:11`)
- [x] `parse_pdf()` 호출을 `asyncio.to_thread`로 비동기화 + `Semaphore(2)` 적용 (`resume.py`)
- [x] `extract_target_role()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] `generate_questions()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] `generate_resume_feedback()` 호출을 `asyncio.to_thread`로 비동기화 (`resume.py`)
- [x] 기존 테스트 전체 통과 확인 (54 passed, 4 skipped)
- [x] `engine/app/parsers/.ai.md` 최신화
- [x] `engine/app/routers/.ai.md` 최신화

---

## 아키텍처 진단 요약

### 현재 문제

```
async def _validate_and_parse_pdf(...):          # async 핸들러
    parsed = parse_pdf(file_bytes, ...)           # ← sync CPU-bound → event loop 블로킹!
    role   = extract_target_role(parsed.text)     # ← sync LLM 호출 → event loop 블로킹!
    ...
```

10명 동시 이미지 PDF 업로드 시:
```
User1 → OCR 120초 블로킹 ──────────────────────────── 완료
User2 →                   OCR 120초 블로킹 ──────────── 완료
...
User10 → 1,080초 대기 후 → OCR 120초 → 완료  (총 20분)
```

### 해결 방향

`asyncio.to_thread(sync_fn, ...)` — event loop를 블로킹하지 않고 ThreadPool에서 실행.
PyMuPDF는 C extension으로 GIL 해제 → ThreadPool로 실질적 병렬 처리 가능.
`interview_service.py:298,332`에 이미 동일 패턴 사용 중.

### 예상 효과

| 변경 | 단일 요청 OCR 시간 | 10명 동시 처리 |
|------|-------------------|----------------|
| 현재 (DPI 300, blocking) | ~120초 | 완전 직렬, 마지막 20분 대기 |
| 이번 변경 후 (DPI 250 + to_thread) | ~83초 | 병렬 처리, 각자 ~83초 |

---

## 구현 계획

### Step 1 — OCR DPI 변경

**파일**: `engine/app/parsers/pdf_parser.py`

```python
# Before (L11)
_OCR_DPI = 300

# After
_OCR_DPI = 250
```

**왜 250**: 200은 한글 OCR 최소 권장값(품질 마진 없음), 250은 ~31% 속도 향상 + 품질 안전 마진 확보.

---

### Step 2 — resume.py 비동기화

**파일**: `engine/app/routers/resume.py`

#### 2-1. import 추가 (L2 다음)

```python
import asyncio
```

#### 2-2. Semaphore 선언 (모듈 상단, router 선언 아래)

```python
# OCR 동시 실행 제한 — t3a.micro 1GB RAM 기준 안전 한계
_OCR_SEMAPHORE = asyncio.Semaphore(2)
```

#### 2-3. `_validate_and_parse_pdf` — parse_pdf 비동기화 + Semaphore 적용 (L46)

```python
# Before
parsed = parse_pdf(file_bytes, filename=file.filename)

# After
async with _OCR_SEMAPHORE:
    parsed = await asyncio.to_thread(parse_pdf, file_bytes, filename=file.filename)
```

> Semaphore는 OCR(`parse_pdf`)만 감쌈. 텍스트 PDF는 OCR 미실행이므로 Semaphore 진입만 하고 바로 반환.

#### 2-3. `analyze_resume` — extract_target_role 비동기화 (L60)

```python
# Before
role = extract_target_role(parsed.text)

# After
role = await asyncio.to_thread(extract_target_role, parsed.text)
```

#### 2-4. `create_questions` — generate_questions 비동기화 (L80)

```python
# Before
questions, usage = generate_questions(body.resumeText, target_role=body.targetRole)

# After
questions, usage = await asyncio.to_thread(
    generate_questions, body.resumeText, target_role=body.targetRole
)
```

#### 2-5. `create_feedback` — generate_resume_feedback 비동기화 (L99)

```python
# Before
data, usage = generate_resume_feedback(
    body.resumeText,
    body.targetRole,
    job_context=body.job_context,
    resume_context=body.resume_context,
)

# After
data, usage = await asyncio.to_thread(
    generate_resume_feedback,
    body.resumeText,
    body.targetRole,
    job_context=body.job_context,
    resume_context=body.resume_context,
)
```

---

### Step 3 — 테스트 확인

```bash
cd engine && pytest tests/unit/parsers/test_pdf_parser.py tests/integration/test_resume_parse_route.py tests/integration/test_resume_analyze_route.py tests/integration/test_resume_questions_route.py tests/integration/test_resume_feedback_router.py -v
```

**예상 결과**: 전체 통과. 테스트 코드 변경 불필요.
- `patch("app.routers.resume.parse_pdf", ...)` 패치 경로 변경 없음
- DPI 값은 테스트 assertion에 없음

---

### Step 4 — .ai.md 최신화

#### `engine/app/parsers/.ai.md`

- OCR DPI 값 300 → 250 으로 수정

#### `engine/app/routers/.ai.md`

- `async 설계 원칙` 섹션 업데이트:
  - "현재 (Phase 2): 이벤트 루프 블로킹 있음" → `asyncio.to_thread` 적용으로 블로킹 해소됨으로 수정

---

## 변경 파일 목록

| 파일 | 변경 내용 |
|------|----------|
| `engine/app/parsers/pdf_parser.py` | L11: `_OCR_DPI = 300 → 250` |
| `engine/app/routers/resume.py` | `import asyncio` 추가 + 4개 sync 호출 → `asyncio.to_thread` |
| `engine/app/parsers/.ai.md` | DPI 값 업데이트 |
| `engine/app/routers/.ai.md` | async 설계 원칙 업데이트 |

---

## 주의사항

- `generate_resume_feedback` 호출 시 keyword argument(`job_context=`, `resume_context=`)는 `asyncio.to_thread`의 `**kwargs`로 그대로 전달 가능
- `parse_pdf`의 `filename` 파라미터도 keyword-only (`*` 이후)이므로 `asyncio.to_thread(parse_pdf, file_bytes, filename=...)` 형태로 전달
- `extract_target_role`의 반환 타입 확인 — 단일 값 반환이므로 tuple unpacking 없음

---

## 인프라 컨텍스트

- **EC2**: t3a.micro (vCPU 2, RAM 1GB, Storage 8GB)
- **메모리 여유**: OS + uvicorn 1 worker (FastAPI + PyMuPDF + Tesseract) 합산 후 ~300-500MB 여유
- `asyncio.to_thread` — 메모리 공유(ThreadPool), 추가 메모리 비용 없음 → **t3a.micro에 안전**
- DPI 250 변경 — OCR 처리 중 픽셀 버퍼 ~31% 감소 → **메모리 스파이크 완화 효과**

## 범위 외 (영구 제외 / 별도 이슈)

| 구분 | 작업 | 이유 |
|------|------|------|
| **영구 제외** | uvicorn `--workers 2` | t3a.micro RAM 1GB — 워커 추가 시 OOM 위험 |
| 낮음 | OCR 타임아웃 설정 | 별도 이슈로 추적 |
