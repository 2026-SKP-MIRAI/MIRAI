# chore: [docs] dev_spec.md 명세 현행화 — 엔진 API 변경·OCR fallback·targetRole 반영

## 목적

엔진 API가 고도화되었으나 `docs/specs/mirai/dev_spec.md` 공식 명세서가 코드 현행 상태를 반영하지 못하고 있다. 명세서와 코드가 어긋나면 온보딩·설계 의사결정에서 혼선 발생. 문서가 코드를 정확히 반영하도록 갱신한다.

## 배경

현재 엔진에 다음 변경이 구현·머지되었으나 dev_spec.md에 미반영:

1. **PDF 파싱 분리** — `POST /api/resume/parse` 신규. `/questions`는 multipart → JSON body(`{ resumeText, targetRole? }`)로 전환. 서비스가 parse 결과를 DB 저장과 질문 생성에 동시 사용 가능.
2. **targetRole 자동 추출** — `POST /api/resume/analyze`(PDF → resumeText + targetRole 동시), `POST /api/resume/target-role`(resumeText → targetRole 재추출) 신규. `/questions`·`/feedback`에 targetRole optional 주입.
3. **Tesseract OCR fallback** — 이미지 전용 PDF 대응. PyMuPDF 내장 Tesseract OCR(`dpi=300`, `eng+kor`). Dockerfile에 `tesseract-ocr`, `tesseract-ocr-kor` 패키지 추가.

## 완료 기준

**`docs/specs/mirai/dev_spec.md`:**

- [x] §2 기술 스택 엔진 테이블 — PDF 처리 행에 `Tesseract OCR` fallback 추가 (dpi=300, eng+kor)
- [x] §4 기능01 시스템 흐름 — `/analyze` 진입 → OCR fallback 분기 → targetRole 추론 → `/questions` ∥ `/feedback` 병렬 호출 플로우로 재작성
- [x] §4 기능01 Dockerfile 인프라 참조 — `tesseract-ocr`, `tesseract-ocr-kor` 시스템 패키지 명시
- [x] §4 기능01 `POST /api/resume/parse` — 신규 API 명세 추가 (multipart → `{ resumeText, extractedLength }`)
- [x] §4 기능01 `POST /api/resume/analyze` — 신규 API 명세 추가 (multipart → `{ resumeText, extractedLength, targetRole }`, 추론 불가 시 "미지정") + 타임아웃 정보
- [x] §4 기능01 `POST /api/resume/target-role` — 신규 API 명세 추가 (`{ resumeText }` → `{ targetRole }`, 추론 불가 시 "미지정")
- [x] §4 기능01 `POST /api/resume/questions` — multipart → JSON body 전환, `targetRole` optional 추가, `resumeId` 제거, 에러에서 422 제거
- [x] §4 기능01 프롬프트 지침 — targetRole 주입, resumeText 16K 절삭, 8개 미만 시 500 에러 명시
- [x] §4 기능01 화면 상태 + 프론트엔드 플로우 — 2단계 플로우(analyze → confirm role → questions ∥ feedback) 반영
- [x] §4 기능02 `POST /api/resume/feedback` — `targetRole` optional 명시 (미입력·빈값 시 "미지정 직무")
- [x] §4 기능02 에러·프롬프트 지침 — 에러 코드 추가, strict 검증(5개 점수·강약점 개수), targetRole·16K 절삭 명시
- [x] 최종 업데이트 날짜 갱신

**공통:**
- [ ] `engine/.ai.md`는 변경하지 않음 (이미 정확)
- [ ] `docs/specs/mvp/dev_spec.md`는 변경하지 않음 (MVP 명세서 범위 밖)
- [ ] 기존 마크다운 포맷(테이블 정렬, 코드 블록 스타일, 헤더 레벨) 유지

## 개발 체크리스트
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] `engine/.ai.md` API 계약과 정합성 확인

## 참조
- `engine/.ai.md` — 엔진 API 계약 (정합성 기준)
- `engine/app/routers/resume.py` — 현행 엔드포인트 구현
- `engine/app/schemas.py` — 현행 스키마 정의

---

## 작업 내역

### 2026-03-20

**현황**: 12/12 완료

**완료된 항목**:
- §2 기술 스택 엔진 테이블 — Tesseract OCR fallback 추가
- §4 기능01 시스템 흐름 재작성
- §4 기능01 Dockerfile 인프라 참조
- §4 기능01 POST /api/resume/parse 신규 추가
- §4 기능01 POST /api/resume/analyze 신규 추가
- §4 기능01 POST /api/resume/target-role 신규 추가
- §4 기능01 POST /api/resume/questions 수정
- §4 기능01 프롬프트 지침 업데이트
- §4 기능01 화면 상태 + 프론트엔드 플로우
- §4 기능02 POST /api/resume/feedback 수정
- §4 기능02 에러·프롬프트 지침 보강
- 최종 업데이트 날짜 갱신

**미완료 항목**:
- 없음

**변경 파일**: 2개 (`docs/specs/mirai/dev_spec.md`, `docs/specs/mirai/.ai.md`)

---

**상세 작업 내역:**

**`docs/specs/mirai/dev_spec.md` (+98/-11줄)**
- §2 기술 스택 테이블: PyMuPDF 행에 Tesseract OCR fallback (dpi=300, eng+kor) 추가 — 이미지 PDF 처리 능력 명시
- §4 기능01 시스템 흐름: 구 단일 `/questions` 흐름 → 2단계 플로우(analyze → confirm role → questions ∥ feedback)로 재작성. 엔진은 stateless, 병렬 호출은 서비스 레이어 오케스트레이션임을 명시
- §4 기능01 Dockerfile 인프라 참조: `tesseract-ocr`, `tesseract-ocr-kor` 시스템 패키지 필요 명시
- §4 기능01 신규 API 3개 추가: `/parse`, `/analyze`, `/target-role` — 각 입력 제약·에러 코드·"미지정" 200 OK 의미론 포함. `/analyze` 타임아웃 주의(15s) 명시
- §4 기능01 `/questions` 수정: multipart → JSON body, `resumeId` 제거, 422 에러 제거, `targetRole` optional, 입력 제약 명시
- §4 기능01 프롬프트 지침: targetRole 주입, 16K 절삭, 8개 미만 → LLMError(500) 추가
- §4 기능01 화면 상태: 1단계 → 2단계 플로우(`analyzing`, `role-confirm`, `generating`)
- §4 기능02 `/feedback` 수정: `targetRole` optional, 빈값 `"미지정 직무"` 처리, 입력 제약 추가
- §4 기능02 프롬프트 지침: timeout·max_tokens, strict 검증 규칙(scores 5개·범위·strengths/weaknesses 2개 이상·suggestions 1개 이상), 16K 절삭 추가

**`docs/specs/mirai/.ai.md`**
- 최종 수정일 2026-03-12 → 2026-03-20 갱신

