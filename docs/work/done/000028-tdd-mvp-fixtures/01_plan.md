# [#28] chore: TDD 기반 MVP 구현을 위한 테스트 fixtures 준비 (engine + services) — 구현 계획

> 작성: 2026-03-07

---

## 디렉토리 구조

```
engine/tests/fixtures/
├── input/
│   ├── sample_resume.pdf   — 파서 테스트 인풋 (실제 자소서)
│   ├── empty.pdf           — edge case: 빈 PDF
│   ├── image_only.pdf      — edge case: 텍스트 레이어 없는 이미지 PDF
│   ├── corrupted.pdf       — edge case: 손상된 PDF (ParseError → 400)
│   ├── many_pages.pdf      — edge case: 11페이지 PDF (PageLimitError → 400)
│   └── large_file.pdf      — edge case: 5MB 초과 파일 (FileSizeError → 400)
└── output/
    ├── expected_parsed.json  — 파서 기대 출력 ({ text, extractedLength })
    └── mock_llm_response.json — Claude raw mock 응답 ([{ category, question }] 배열)

services/{kwan,lww,seung,siw}/tests/fixtures/
└── input/
    ├── mock_engine_response.json — 엔진 HTTP mock 응답 ({ questions, meta })
    └── error_responses.json      — 400/500 에러 mock (한국어 메시지)
```

> 서비스 fixtures는 엔진을 mock하는 인풋만 존재. 기대 아웃풋은 테스트 코드 내 assertion으로 처리.

## 완료 기준

- [ ] `engine/tests/fixtures/input/sample_resume.pdf`
- [ ] `engine/tests/fixtures/input/empty.pdf`
- [ ] `engine/tests/fixtures/input/image_only.pdf`
- [ ] `engine/tests/fixtures/input/corrupted.pdf`
- [ ] `engine/tests/fixtures/input/many_pages.pdf`
- [ ] `engine/tests/fixtures/input/large_file.pdf`
- [ ] `engine/tests/fixtures/output/expected_parsed.json`
- [ ] `engine/tests/fixtures/output/mock_llm_response.json`
- [ ] `services/*/tests/fixtures/input/mock_engine_response.json`
- [ ] `services/*/tests/fixtures/input/error_responses.json`
- [ ] 각 fixtures 디렉토리 `.ai.md` 최신화

---

## 소스 파일

| 역할 | 경로 |
|------|------|
| 원본 자소서 PDF | `/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/mirai_포폴,이력서,자소서/자소서_004_개발자.pdf` |
| 복사 대상 | `engine/tests/fixtures/input/sample_resume.pdf` (로컬 전용, gitignored) |

> **gitignore 정책:** `**/tests/fixtures/**` 패턴으로 PDF·JSON·.ai.md 포함 fixture 전체가 커밋되지 않는다. 테스트 데이터 유출 방지 목적. 팀 공유는 내부 Google Drive를 통한다.

**자소서 요약** (fixtures 내용 설계 근거):
- 지원: 스핀 / 백엔드 개발자 / 2025 하반기
- 기술 스택: Java, Spring Framework, Spring Boot, JSP, MyBatis, Oracle, MySQL
- 경험 1: 영화 추천 웹서비스 A/B 테스트 설계 → 재방문율 57%↑, 찜 비율 39%↑
- 경험 2: 검색 쿼리 구조 개선 → 정확도 60%↑, 성능 57%↑ (서브쿼리 제거 → JOIN + 조건별 인덱스)
- 경험 3: 기존 로그인 로직에 사용자 데이터 저장 기능 확장 (역할 기반 분기)
- 협업: WBS + Agile 스프린트, 팀원 만족도 180%↑

---

## 구현 계획

### Step 1 — sample_resume.pdf 복사

```bash
cp "/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/mirai_포폴,이력서,자소서/자소서_004_개발자.pdf" \
   engine/tests/fixtures/input/sample_resume.pdf
```

- PDF는 gitignored (`**/tests/fixtures/**`), 커밋 안 됨
- `input/` 디렉토리 생성 필요 (없는 경우 `mkdir -p`)

---

### Step 2 — expected_parsed.json

파서(`PyMuPDF/fitz`)가 `input/sample_resume.pdf`를 읽었을 때 반환해야 하는 예상 출력.
위치: `engine/tests/fixtures/output/expected_parsed.json`

```json
{
  "text": "스핀 / 백엔드 개발자 / 2025 하반기\n건국대 / 수학과 / 학점 3.22/4.5 / 토스: 120/IM2 / 한국사검정능력시험: 고급, 컴퓨터활용능력: 1급\n\n[성장을 멈추지 않는 문제 해결 중심 개발자]\n  저는 현실적인 문제를 해결하며 성취감을 얻고, 그 과정을 통해 지속적으로 성장하는 개발자를 목표로 하고 있습니다. ...",
  "extractedLength": 3200
}
```

> `text`는 실제 추출 결과 전문을 넣지 않고 앞 200자 + `...`로 표현. 테스트에서는 `extractedLength` 범위(`2500~4000`)와 특정 키워드 포함 여부만 검증한다.

실제 파일 작성 시 기준값:
- `extractedLength`: PDF에서 추출한 실제 문자 수 (파이썬으로 측정 후 기입)
- `text`: 전문 (또는 테스트 대상 범위만)

---

### Step 3 — mock_llm_response.json

Claude가 이 자소서를 받았을 때 반환해야 할 질문 목록 mock.
위치: `engine/tests/fixtures/output/mock_llm_response.json`
카테고리 4개, 각 2~5개, 총 12개. 자소서에 없는 내용은 묻지 않는다.

> **형식 결정:** Claude raw 응답인 **배열** 형태. `meta`(`extractedLength`, `categoriesUsed`) 조합은 엔진(라우트/서비스 레이어) 책임 — Claude가 줄 수 없는 정보이므로.

```json
[
  {
    "category": "직무 역량",
    "question": "영화 추천 웹서비스에서 A/B 테스트를 설계할 때 출연진 기반 추천을 추가하기로 결정한 근거는 무엇이었나요?"
  },
  {
    "category": "직무 역량",
    "question": "유저 ID 홀/짝수로 A/B 그룹을 나눈 방식 외에 고려했던 분할 기준이 있었나요? 왜 해당 방식을 선택했나요?"
  },
  {
    "category": "직무 역량",
    "question": "사용자 활동 데이터를 일 단위로 집계 저장하는 방식으로 변경해 데이터를 96.67% 줄였다고 하셨는데, 이 수치는 어떻게 측정했나요?"
  },
  {
    "category": "경험의 구체성",
    "question": "검색 쿼리에서 서브쿼리를 제거하고 JOIN 중심으로 리팩토링하면서 가장 어려웠던 부분은 무엇이었나요?"
  },
  {
    "category": "경험의 구체성",
    "question": "기존 팀원이 작성한 로그인 코드에 사용자 데이터 저장 기능을 추가할 때, 코드를 분석하고 기능을 연결하는 과정에서 어떤 어려움이 있었나요?"
  },
  {
    "category": "경험의 구체성",
    "question": "두 팀 프로젝트에서 첫 번째 경험의 문제를 두 번째에 적용했다고 하셨는데, 구체적으로 어떤 문제가 반복될 것을 예상했고 어떻게 사전에 대비했나요?"
  },
  {
    "category": "성과 근거",
    "question": "A/B 테스트 결과 재방문율이 57% 높았다고 하셨는데, 측정 기간과 샘플 크기는 어느 정도였나요?"
  },
  {
    "category": "성과 근거",
    "question": "검색 정확도 60% 향상과 응답 시간 35초→15초 개선을 어떤 방식으로 측정했나요? 실제 서비스 환경에서도 동일하게 재현되었나요?"
  },
  {
    "category": "성과 근거",
    "question": "협업 프로세스 개선 후 팀원 만족도가 180% 상승했다는 수치의 측정 기준과 방법을 설명해 주세요."
  },
  {
    "category": "기술 역량",
    "question": "Spring Framework와 Spring Boot를 모두 사용하셨는데, 프로젝트에서 두 가지를 선택하는 기준이 있었나요?"
  },
  {
    "category": "기술 역량",
    "question": "MyBatis를 사용하면서 쿼리 최적화(서브쿼리 제거, 조건별 인덱스)를 직접 작성하셨는데, 인덱스 설계 시 어떤 컬럼을 기준으로 판단했나요?"
  },
  {
    "category": "기술 역량",
    "question": "MATLAB을 통해 처음 개발에 매력을 느끼셨다고 하셨는데, 수학과 전공 배경이 백엔드 개발 업무에서 실제로 도움이 된 사례가 있나요?"
  }
]
```

---

### Step 4 — edge case PDFs 복사

```bash
cp "/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/mirai_포폴,이력서,자소서/empty.pdf" \
   engine/tests/fixtures/input/empty.pdf

cp "/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/mirai_포폴,이력서,자소서/image_only.pdf" \
   engine/tests/fixtures/input/image_only.pdf
```

- `empty.pdf` — 텍스트 없는 빈 PDF (파서 edge case)
- `image_only.pdf` — 텍스트 레이어 없는 이미지 전용 PDF (파서 edge case)
- 두 파일 모두 gitignored (`**/tests/fixtures/**`), 커밋 안 됨

---

### Step 4b — 추가 edge case PDFs 생성

`FileSizeError`, `PageLimitError`, `ParseError(손상)` 케이스용 파일을 `engine/tests/fixtures/input/`에 생성한다. Google Drive로 팀 공유.

```python
import os
import fitz

# corrupted.pdf — 손상된 PDF (ParseError 테스트용)
with open("engine/tests/fixtures/input/corrupted.pdf", "wb") as f:
    f.write(b"%PDF-1.4 corrupted content \x00\xFF\xFE invalid data")

# many_pages.pdf — 11페이지 빈 PDF (PageLimitError 테스트용)
doc = fitz.open()
for _ in range(11):
    doc.new_page()
doc.save("engine/tests/fixtures/input/many_pages.pdf")
doc.close()

# large_file.pdf — 실제 5MB 초과 파일 복사 (FileSizeError 테스트용)
# 포트폴리오_006_5MB넘는파일.pdf (6.1MB) 사용
import shutil
shutil.copy(
    "/home/dev_00/sharedfolder/260228_SKP_MIRAI/2026_1Q/260308/mirai_포폴,이력서,자소서/포트폴리오_006_5MB넘는파일.pdf",
    "engine/tests/fixtures/input/large_file.pdf"
)
```

| 파일 | 대응 예외 | HTTP |
|------|-----------|------|
| `corrupted.pdf` | `ParseError` | 400 |
| `many_pages.pdf` | `PageLimitError` | 400 |
| `large_file.pdf` | `FileSizeError` | 400 |

- 3개 파일 모두 gitignored, Google Drive 공유

---

### Step 5 — 서비스 fixtures (4개 서비스 동일)

대상: `services/{kwan,lww,seung,siw}/tests/fixtures/input/`

**mock_engine_response.json** — 엔진 full 응답 mock (`{ questions, meta }`, §5-1 형식):
```json
{
  "questions": [
    { "category": "직무 역량", "question": "A/B 테스트 설계 시 출연진 기반 추천을 추가하기로 결정한 근거는 무엇이었나요?" },
    { "category": "직무 역량", "question": "사용자 활동 데이터를 일 단위 집계로 변경해 데이터를 96.67% 줄인 방식을 구체적으로 설명해 주세요." },
    { "category": "경험의 구체성", "question": "서브쿼리를 제거하고 JOIN으로 리팩토링할 때 가장 어려운 지점은 어디였나요?" },
    { "category": "경험의 구체성", "question": "다른 팀원이 작성한 로그인 코드에 기능을 추가할 때 코드를 분석한 방법을 설명해 주세요." },
    { "category": "성과 근거", "question": "재방문율 57% 향상의 측정 기간과 샘플 크기는 어느 정도였나요?" },
    { "category": "성과 근거", "question": "검색 응답 시간을 35초에서 15초로 줄인 수치는 어떤 환경에서 측정했나요?" },
    { "category": "기술 역량", "question": "MyBatis에서 조건별 인덱스를 설계할 때 어떤 컬럼을 기준으로 판단했나요?" },
    { "category": "기술 역량", "question": "Spring Framework와 Spring Boot 중 프로젝트에서 선택 기준이 있었나요?" }
  ],
  "meta": {
    "extractedLength": 3200,
    "categoriesUsed": ["직무 역량", "경험의 구체성", "성과 근거", "기술 역량"]
  }
}
```

**error_responses.json** — 에러 mock (HTTP 코드 기준: `engine/.ai.md` 계약 기준):
```json
{
  "noFile": {
    "status": 400,
    "body": { "detail": "파일이 없습니다. PDF 파일을 업로드해 주세요." }
  },
  "notPdf": {
    "status": 400,
    "body": { "detail": "PDF 파일만 업로드 가능합니다." }
  },
  "tooLarge": {
    "status": 400,
    "body": { "detail": "파일 크기가 너무 큽니다. 5MB 이하의 파일을 업로드해 주세요." }
  },
  "corruptedPdf": {
    "status": 400,
    "body": { "detail": "PDF 파일을 읽을 수 없습니다. 다른 파일을 업로드해 주세요." }
  },
  "emptyPdf": {
    "status": 422,
    "body": { "detail": "PDF에 텍스트가 포함되어 있지 않습니다. 텍스트가 있는 PDF를 업로드해 주세요." }
  },
  "imageOnlyPdf": {
    "status": 422,
    "body": { "detail": "이미지만 포함된 PDF입니다. 텍스트가 포함된 PDF를 업로드해 주세요." }
  },
  "llmError": {
    "status": 500,
    "body": { "detail": "질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." }
  }
}
```

---

### Step 6 — .ai.md 최신화

- `engine/tests/fixtures/.ai.md` — input/output 구조 설명, 각 파일 용도, PDF 소스 경로 기록
- `services/*/tests/fixtures/.ai.md` — input/ 구조 설명, 엔진 응답 형식 버전 명시

---

## 실행 순서

1. ✅ `cp` 명령으로 sample_resume.pdf 복사
2. ✅ `cp` 명령으로 empty.pdf, image_only.pdf 복사
3. ✅ Python 스크립트로 corrupted.pdf, many_pages.pdf 생성
4. ✅ `cp` 명령으로 large_file.pdf 복사 (포트폴리오_006_5MB넘는파일.pdf, 6.1MB)
5. Python으로 extractedLength 실측 → expected_parsed.json 작성
6. mock_llm_response.json 작성 (위 초안 그대로)
7. 서비스 4개 fixtures 디렉토리 생성 + JSON 파일 작성
8. 각 .ai.md 업데이트
