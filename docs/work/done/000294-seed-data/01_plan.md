# [#294] feat: [seung][DE] 합격 자소서 seed 데이터 수집 및 초기 적재 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] 공개 합격 자소서 데이터 수집 (직군별 최소 5건 이상)
- [x] `data/accepted_resumes.json` 형식으로 정리 (`job_role`, `content`, `source` 필드)
- [x] `build_resume_index.py --dry-run` 으로 데이터 유효성 검증
- [x] `build_resume_index.py` 실행으로 `accepted_resume_embeddings` 테이블 초기 적재 완료
- [x] `ENABLE_RAG=true` 환경에서 서류 진단 시 RAG 컨텍스트 실제 반영 확인

---

## 구현 계획

### 사전 파악 사항

- 파이프라인 스크립트 **3개 모두 이미 완성됨** — 새 코드 작성 불필요
  - `engine/scripts/extract_pdf_resumes.py` — PDF → JSON 변환 (파일명에서 job_role 자동 추출)
  - `engine/scripts/build_resume_index.py` — JSON → 엔진 임베딩 → Supabase upsert
- PDF 파일명 패턴: `{id}_{company}_{job_role}.pdf` (예: `23969_서울우유협동조합_연구개발.pdf`)
  - `job_role` = 파일명 3번째 파트, `source` = 2번째 파트(회사명) 자동 추출
- `data/` 디렉토리 미존재 — 스크립트가 자동 생성 (`mkdir parents=True`)
- `.gitignore`는 `.json` 미제외 → `data/accepted_resumes.json` 커밋 가능
- RAG 활성화 조건: `ENABLE_RAG=true` + `RAG_DATABASE_URL` (공용 Supabase) + `ENGINE_BASE_URL`

---

### Step 1 — PDF → JSON 변환

PDF 약 1000개를 `data/accepted_resumes.json`으로 변환한다.

```bash
python engine/scripts/extract_pdf_resumes.py \
  --input-dir "D:/path/to/pdfs" \
  --output data/accepted_resumes.json
```

**확인 사항:**
- `완료: N개 레코드 → data/accepted_resumes.json` 출력
- `건너뜀: M개 (텍스트 100자 미만)` — 이미지 PDF 등 추출 실패 건은 자동 제외됨
- 출력 JSON의 `job_role` 필드가 파일명에서 올바르게 추출됐는지 샘플 확인

---

### Step 2 — dry-run 유효성 검증

```bash
python engine/scripts/build_resume_index.py \
  --input data/accepted_resumes.json \
  --dry-run
```

**확인 사항:**
- `[로드] 총 N개 레코드` 출력 확인
- `[dry-run] 검증 완료` 출력 확인
- `[경고]` 항목(job_role·content 누락) 없음

---

### Step 3 — DB 초기 적재

**사전 조건:**
- 엔진 로컬 구동(`docker run`) 또는 EC2 엔진 접근 가능
- `RAG_DATABASE_URL` 환경변수 설정 (공용 Supabase — 팀 공유 `.env` 참조, 개인 DB 아님)

```bash
export ENGINE_BASE_URL=http://localhost:8000   # 또는 EC2 엔진 URL
export RAG_DATABASE_URL=postgresql://...       # 공용 Supabase

python engine/scripts/build_resume_index.py \
  --input data/accepted_resumes.json
```

**확인 사항:**
- `완료: 총 N개 레코드 삽입` 출력
- 재실행 시 `ON CONFLICT DO NOTHING`으로 0개 삽입 (멱등성)

---

### Step 4 — RAG 컨텍스트 반영 확인

**서비스:** `services/seung` (서류 진단 경로)
**RAG 코드:** `services/seung/src/lib/rag/`, `src/app/api/resume/feedback/route.ts`

```bash
# services/seung .env 설정
ENABLE_RAG=true
RAG_DATABASE_URL=...  # Step 3와 동일
ENGINE_BASE_URL=...
```

서비스 로컬 실행 후 서류 진단 요청 → 엔진 `/api/resume/feedback` 응답의 `resume_context` 배열에 유사 자소서 포함 여부 확인.

---

### Step 5 — `.ai.md` 최신화

- `data/.ai.md` 작성 (목적·구조·역할)

---

## 주의사항

- `RAG_DATABASE_URL`은 개인 `DATABASE_URL`이 아닌 **공용 Supabase** 사용
- `data/accepted_resumes.json`은 7.20MB로 5MB 초과 → `.gitignore` 처리 (레포 미포함)
- 임베딩 호출은 엔진 `/api/embed` 경유 (불변식 #2) — `build_resume_index.py` 이미 준수
