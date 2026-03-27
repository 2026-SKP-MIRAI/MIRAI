# feat: [seung][DE] 합격 자소서 seed 데이터 수집 및 초기 적재

## 목적

`accepted_resume_embeddings` 테이블에 초기 데이터를 적재하여 RAG 기능을 실제로 활성화한다.

## 배경

유저 기여 방식은 초기 데이터가 없는 cold start 문제와 데이터 부족 문제로 현실적이지 않다. 대신 링커리어 등 공개 합격 자소서 게시판에서 데이터를 직접 수집하여 `build_resume_index.py`로 초기 적재한다.

#293 (임베딩 파이프라인 자동화)의 선행 조건.

## 완료 기준

- [x] 공개 합격 자소서 데이터 수집 (직군별 최소 5건 이상)
- [x] `data/accepted_resumes.json` 형식으로 정리 (`job_role`, `content`, `source` 필드)
- [x] `build_resume_index.py --dry-run` 으로 데이터 유효성 검증
- [x] `build_resume_index.py` 실행으로 `accepted_resume_embeddings` 테이블 초기 적재 완료
- [x] `ENABLE_RAG=true` 환경에서 서류 진단 시 RAG 컨텍스트 실제 반영 확인

## 구현 플랜

### Step 1 — 데이터 수집
링커리어 등 공개 합격 자소서 게시판에서 직군별 자소서 수집 후 JSON 형식으로 정리

### Step 2 — 유효성 검증
```bash
python engine/scripts/build_resume_index.py \
  --input data/accepted_resumes.json \
  --dry-run
```

### Step 3 — 초기 적재
```bash
python engine/scripts/build_resume_index.py \
  --input data/accepted_resumes.json
```

## 개발 체크리스트
- [x] 해당 디렉토리 `.ai.md` 최신화 (`data/.ai.md` 신규 작성)
- [x] 불변식 위반 없음 (임베딩 호출은 engine `/api/embed` 경유 확인)

## 작업 내역

### 2026-03-27

**현황**: 5/5 AC 완료

**실제 신규 작업**:
- `extract_pdf_resumes.py`로 PDF 1000개 → `data/accepted_resumes.json` 변환 (999개 유효)
- `data/.ai.md` 신규 작성

**기확인 사항 (#198에서 기완료)**:
- DB 적재: 공용 Supabase `accepted_resume_embeddings`에 999개 (#198에서 완료됨)
- `build_resume_index.py --dry-run` 검증 및 RAG 파이프라인 E2E 동작 확인 (사후 검증)

> 이슈 #294는 #198 완료 시점에 대부분 해결된 상태였음.
> 이번에 실제로 추가된 산출물은 `data/accepted_resumes.json`, `data/.ai.md` 뿐.

**변경 파일**:
- `data/.ai.md` (신규)
- `.gitignore` — `data/accepted_resumes.json` 추가 (7.20MB 초과, DB 적재 완료로 레포 불필요)

> `data/accepted_resumes.json`은 생성됐으나 5MB 초과로 gitignore 처리. 재생성 시 `extract_pdf_resumes.py` 사용.

