# [#288] 테스트 결과 및 검증 기록

> 작성: 2026-03-27

---

## 자동화 테스트

```
pytest tests/unit/parsers/test_pdf_parser.py
      tests/integration/test_resume_parse_route.py
      tests/integration/test_resume_analyze_route.py
      tests/integration/test_resume_questions_route.py
      tests/integration/test_resume_feedback_router.py
      tests/integration/test_resume_target_role_route.py -v

결과: 54 passed, 4 skipped in 4.27s
```

| 구분 | 결과 |
|------|------|
| 유닛 테스트 (pdf_parser) | 11 passed, 2 skipped (Tesseract 미설치) |
| 통합 테스트 (resume 전체) | 43 passed, 2 skipped (Tesseract 미설치) |
| 실패 | 0 |

**4 skipped 이유**: `@requires_tesseract` 마크 테스트 — 로컬 환경에 Tesseract 미설치 시 자동 skip. 정상 동작.

---

## OCR 품질 테스트 (수동)

### 테스트 파일
- `포트폴리오_005_ai개발자.pdf` (6페이지, 완전 이미지 PDF)
- DPI 250 기준

### 결과
- 총 추출 글자 수: **5,891자**
- 이름, 학교명, 수상 내역, 프로젝트명 등 핵심 텍스트 정상 추출

### 노이즈 발생 원인 (DPI 무관)
디자인 포트폴리오 PDF 특성상 배경 이미지·아이콘·장식 요소가 OCR에서 노이즈 글자(`ae`, `oe`, `SAS` 등)로 인식됨.
DPI 300으로 올려도 동일한 현상 발생 — **DPI 250이 원인이 아님**.

### 결론
- 자소서/이력서 (Word/한글 출력 PDF) → 텍스트 레이어 있음 → OCR 미실행 → 영향 없음
- 디자인 포트폴리오처럼 복잡한 레이아웃의 이미지 PDF → OCR 노이즈는 DPI 아닌 구조 문제
- DPI 250은 한글 OCR 품질 마진 충분히 확보된 수준

---

## 동시성 검증

### asyncio.to_thread 적용 확인
`resume.py` 내 sync 호출 4곳 전부 `asyncio.to_thread` 적용 확인:

| 함수 | 적용 여부 |
|------|----------|
| `parse_pdf()` | ✅ + `Semaphore(2)` |
| `extract_target_role()` | ✅ |
| `generate_questions()` | ✅ |
| `generate_resume_feedback()` | ✅ |

### Semaphore(2) 근거
- t3a.micro RAM 1GB, 기본 상주 ~330MB, 여유 ~670MB
- 이미지 PDF OCR 1회 최대 ~190MB (DPI 250, 10페이지 기준)
- 동시 2개: ~380MB → 여유 내 ✅
- 동시 3개: ~570MB → 여유 133MB (OOM 위험) ⚠️

---

## 인프라 메모

- EC2: t3a.micro (vCPU 2, RAM 1GB, Storage 8GB)
- `--workers` 추가 불가 (워커당 ~300MB, 2개 시 OOM)
- t3a CPU 버스팅 특성: 크레딧 소진 시 베이스라인 10%로 성능 저하 가능
- 배포 후 실측 권장 (로컬 CPU >> t3a.micro)
