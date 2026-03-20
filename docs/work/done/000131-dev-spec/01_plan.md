# [#131] chore: [docs] dev_spec.md 명세 현행화 — 엔진 API 변경·OCR fallback·targetRole 반영 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

**`docs/specs/mirai/dev_spec.md`:**

- [ ] §2 기술 스택 엔진 테이블 — PDF 처리 행에 `Tesseract OCR` fallback 추가 (dpi=300, eng+kor)
- [ ] §4 기능01 시스템 흐름 — `/analyze` 진입 → OCR fallback 분기 → targetRole 추론 → `/questions` ∥ `/feedback` 병렬 호출 플로우로 재작성
- [ ] §4 기능01 Dockerfile 인프라 참조 — `tesseract-ocr`, `tesseract-ocr-kor` 시스템 패키지 명시
- [ ] §4 기능01 `POST /api/resume/parse` — 신규 API 명세 추가 (multipart → `{ resumeText, extractedLength }`)
- [ ] §4 기능01 `POST /api/resume/analyze` — 신규 API 명세 추가 (multipart → `{ resumeText, extractedLength, targetRole }`, 추론 불가 시 "미지정") + 타임아웃 정보
- [ ] §4 기능01 `POST /api/resume/target-role` — 신규 API 명세 추가 (`{ resumeText }` → `{ targetRole }`, 추론 불가 시 "미지정")
- [ ] §4 기능01 `POST /api/resume/questions` — multipart → JSON body 전환, `targetRole` optional 추가, `resumeId` 제거, 에러에서 422 제거
- [ ] §4 기능01 프롬프트 지침 — targetRole 주입, resumeText 16K 절삭, 8개 미만 시 500 에러 명시
- [ ] §4 기능01 화면 상태 + 프론트엔드 플로우 — 2단계 플로우(analyze → confirm role → questions ∥ feedback) 반영
- [ ] §4 기능02 `POST /api/resume/feedback` — `targetRole` optional 명시 (미입력·빈값 시 "미지정 직무")
- [ ] §4 기능02 에러·프롬프트 지침 — 에러 코드 추가, strict 검증(5개 점수·강약점 개수), targetRole·16K 절삭 명시
- [ ] 최종 업데이트 날짜 갱신

**공통:**
- [ ] `engine/.ai.md`는 변경하지 않음 (이미 정확)
- [ ] `docs/specs/mvp/dev_spec.md`는 변경하지 않음 (MVP 명세서 범위 밖)
- [ ] 기존 마크다운 포맷(테이블 정렬, 코드 블록 스타일, 헤더 레벨) 유지

**개발 체크리스트:**
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] `engine/.ai.md` API 계약과 정합성 확인

---

## 구현 계획

> 검토: Planner → Architect → Critic (APPROVE), 2026-03-20
> 코드 변경 없음. 수정 파일: `docs/specs/mirai/dev_spec.md` 1개.
> 정합성 기준: `engine/.ai.md` (읽기 전용, 변경 금지)

---

### Step 1: 메타데이터 및 §2 기술 스택 업데이트

**수정 위치:** `docs/specs/mirai/dev_spec.md` 최상단 + §2 엔진 기술 스택 테이블

**작업:**
- 최종 업데이트 날짜: `2026-03-12` → `2026-03-20`
- §2 엔진 테이블 PDF 처리 행 수정:
  - 기술: `PyMuPDF (fitz)` → `PyMuPDF (fitz) + Tesseract OCR fallback`
  - 용도: `텍스트 추출 (app/parsers/에서만)` → `텍스트 추출 (app/parsers/에서만) — 이미지 PDF는 OCR fallback (dpi=300, eng+kor)`

**주의:** 테이블 파이프 정렬 스타일 유지

---

### Step 2: §4 기능01 시스템 흐름 재작성 + Dockerfile 인프라 참조 추가

**수정 위치:** §4 기능01 `시스템 흐름` 코드블록 + 인프라 참조

**작업:**
- 기존 단일 `/questions` 흐름을 2단계 플로우로 교체:
  ```
  [1단계: 분석]
  PDF 업로드
    → POST /api/resume/analyze (Next.js 서비스 → FastAPI 엔진)
    → engine/app/parsers/: PDF → 텍스트 추출 (PyMuPDF)
        이미지 PDF → Tesseract OCR fallback (dpi=300, eng+kor)
    → engine/app/services/: resumeText → targetRole 추론 (LLM)
    → 결과: { resumeText, extractedLength, targetRole }

  [2단계: 질문 + 피드백 — 서비스 레이어에서 병렬 호출]
  사용자가 targetRole 확인/수정
    → POST /api/resume/questions  (JSON: resumeText + targetRole?)  ┐ Next.js 서비스가
    → POST /api/resume/feedback   (JSON: resumeText + targetRole?)  ┘ 병렬 호출
    → 결과 화면: 카테고리별 질문 리스트 + 서류 피드백
  ```
  > 병렬 호출은 서비스(Next.js) 레이어의 오케스트레이션 패턴. 엔진은 각 요청을 독립적으로 처리.

- Dockerfile 인프라 참조 추가 (Week 1 MVP 박스 근처):
  - `tesseract-ocr`, `tesseract-ocr-kor` 시스템 패키지 필요

---

### Step 3: §4 기능01 신규 API 3개 추가

**수정 위치:** §4 기능01, 기존 `/questions` API 명세 앞에 순서대로 삽입

**POST /api/resume/parse 추가:**
- 요청: `multipart/form-data`, `file` (PDF, 최대 5MB / 10페이지)
- 응답(200): `{ "resumeText": "...", "extractedLength": 3200 }`
- 에러: 400 (파일없음·비PDF·크기초과·페이지초과), 422 (빈PDF·OCR실패 이미지PDF), 500 (예기치않은오류)
- OCR: 이미지 PDF는 Tesseract OCR fallback 시도, 성공 시 200, 실패 시 422

**POST /api/resume/analyze 추가 (#113):**
- 요청: `multipart/form-data`, `file` (PDF)
- 응답(200): `{ "resumeText": "...", "extractedLength": 3200, "targetRole": "백엔드 개발자" }`
- 에러: 400 (파일없음·비PDF·크기초과·페이지초과), 422 (빈PDF·OCR실패), 500 (LLM오류)
- targetRole 추론 불가 시 `"미지정"` 반환 — 에러 아님 (200 OK)
- **타임아웃 주의:** 내부 LLM timeout=15s, 클라이언트 fetch timeout 30s 이상 권장

**POST /api/resume/target-role 추가 (#113):**
- 요청: JSON `{ "resumeText": "..." }` (min 1자, max 50,000자)
- 응답(200): `{ "targetRole": "백엔드 개발자" }`
- 에러: 400 (resumeText 누락/빈값/50,000자 초과), 500 (LLM오류)
- 추론 불가 시 `"미지정"` 반환 — 에러 아님 (200 OK)

---

### Step 4: §4 기능01 /questions API 명세 수정

**수정 위치:** §4 기능01 `API: POST /api/resume/questions` 섹션

**작업:**
- 요청 형식: `multipart/form-data` → JSON body
  - `{ "resumeText": "...", "targetRole": "..." }` (resumeText min 1자·max 50,000자 / targetRole max 100자, 선택)
- 응답 예시에서 `"resumeId"` 필드 및 TODO 주석 제거
- 에러 목록: `422` 제거 → 400·500만 유지
  - 400: resumeText 누락/빈값/50,000자 초과, targetRole 100자 초과
  - 500: LLM오류
- targetRole 동작 추가: 전달 시 해당 직무 맞춤 질문, 미입력 시 resume 기반 자체 생성

---

### Step 5: §4 기능01 프롬프트 지침 + 화면 상태 업데이트

**수정 위치:** §4 기능01 `Claude 프롬프트 지침` + `화면 상태` 섹션

**프롬프트 지침 추가 (기존 4개 항목 유지 후 추가):**
- `targetRole`이 전달되면 해당 직무 맞춤 질문 생성에 반영 (미전달 시 자소서 내용 기반 자체 추론)
- `resumeText`는 16,000자 초과 시 앞에서 절삭하여 프롬프트에 주입 (`question_generation_v1.md` 지침 5번)
- 질문 생성 결과가 8개 미만이면 LLMError → 500 (서비스 레이어 검증, `output_parser.py`)

**화면 상태 변경:**
- 기존: `idle → uploading → processing → done / error`
- 변경: 2단계 플로우
  - [1단계] `idle → uploading → analyzing → role-confirm`
  - [2단계] `role-confirm → generating → done / error`
  - `analyzing`: /analyze 호출 중 (PDF 파싱 + targetRole 추론)
  - `role-confirm`: 사용자 targetRole 확인/수정
  - `generating`: /questions ∥ /feedback 병렬 호출 중

---

### Step 6: §4 기능02 /feedback API + 프롬프트 지침 수정

**수정 위치:** §4 기능02 전체

**API 요청 수정:**
- `targetRole`을 optional로 명시: 미입력 또는 빈값(`""`) 시 `"미지정 직무"`로 처리
- 입력 제약 추가: resumeText min 1자·max 50,000자, targetRole max 100자

**에러 코드 추가:**
- 400: resumeText 누락/빈값/50,000자 초과, targetRole 100자 초과
- 500: LLM오류·JSON파싱실패

**프롬프트 지침 보강:**
- timeout: 30s, max_tokens: 2048
- `targetRole` 전달 시 해당 직무 기준 평가, 미입력 시 `"미지정 직무"` 기준
- `resumeText`는 16,000자 초과 시 앞에서 절삭
- scores 엄격 검증: 5개 키(specificity·achievementClarity·logicStructure·roleAlignment·differentiation) 중 하나라도 누락/null → `ResumeFeedbackParseError`(500). silent fallback 없음
- scores 범위 검증: 0 미만 또는 100 초과 → `ResumeFeedbackParseError`(500). clamp 보정 없음
- strengths·weaknesses 최소 2개 보장: 미달 시 `ResumeFeedbackParseError`(500)
- suggestions 최소 1개 보장: 빈 배열 → `ResumeFeedbackParseError`(500)

---

### Step 7: 최종 정합성 검증 체크리스트

**검증 항목 (모두 pass여야 완료):**

| # | 검증 항목 | 확인 방법 |
|---|-----------|-----------|
| 1 | engine/.ai.md의 모든 `/api/resume/*` 엔드포인트(parse, analyze, target-role, questions, feedback)가 dev_spec.md에 존재 | 경로·메서드 1:1 대조 |
| 2 | 각 API의 요청 필드·타입·제약(min/max 자수, optional 여부)이 engine/.ai.md와 일치 | 필드별 대조 |
| 3 | 각 API의 응답 필드 구조가 engine/.ai.md와 일치 | JSON 예시 대조 |
| 4 | 각 API의 에러 코드(400/422/500 조합)가 engine/.ai.md와 일치 | 에러 목록 대조 |
| 5 | "미지정" 반환이 200 OK (에러 아님)으로 명시됨 (/analyze, /target-role) | 텍스트 확인 |
| 6 | engine/.ai.md가 변경되지 않음 | git diff 확인 |
| 7 | docs/specs/mvp/dev_spec.md가 변경되지 않음 | git diff 확인 |
| 8 | 기존 마크다운 포맷(테이블 정렬, 코드블록 언어 태그, 헤더 레벨) 유지됨 | 육안 확인 |
| 9 | 기능03~07 섹션, §5 로드맵, §6 환경변수가 변경되지 않음 | git diff 확인 |

---

### 의존성 순서

```
Step 1 ─── 독립 (언제든 가능)
Step 2 ─── 독립 (Step 1과 병렬 가능)
Step 3 ─┐
Step 4 ─┘ 순서대로 (같은 섹션)
Step 5 ─── Step 2 완료 후 (화면 상태가 시스템 흐름과 일관되어야 함)
Step 6 ─── 독립
Step 7 ─── Steps 1~6 모두 완료 후
```

### 작업 범위 요약

- **수정 파일:** 1개 (`docs/specs/mirai/dev_spec.md`)
- **참조 파일(읽기 전용):** `engine/.ai.md`, `engine/app/services/output_parser.py`, `engine/app/prompts/question_generation_v1.md`
- **변경 금지:** `engine/.ai.md`, `docs/specs/mvp/dev_spec.md`
