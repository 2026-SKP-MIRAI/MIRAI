# chore: [seung] 레포 루트 data/ 디렉토리 제거

## 배경

#294 작업 중 `data/` 디렉토리가 레포 루트에 추가되었으나, 실질적인 역할이 없어 제거한다.

- `data/accepted_resumes.json`은 `.gitignore`에 등록되어 커밋되지 않음
- `data/.ai.md`만 존재 — 문서 내용은 `engine/scripts/.ai.md` 또는 README로 이전 가능
- #293 DAG는 DB에서 직접 읽으므로 이 디렉토리에 의존하지 않음

## 완료 기준

- [x] `data/` 디렉토리 및 `data/.ai.md` 삭제
- [x] `.gitignore`에서 `data/accepted_resumes.json` 항목 제거
- [x] `engine/scripts/build_resume_index.py` 기본 입력 경로 관련 안내를 `engine/scripts/.ai.md`에 이전

## 개발 체크리스트
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

- `data/.ai.md` — `git rm`으로 삭제. `data/accepted_resumes.json`은 이미 `.gitignore` 처리되어 레포에 없으므로 디렉토리 자체가 제거됨.
- `.gitignore` — `data/accepted_resumes.json` 항목 및 관련 주석 제거. 해당 파일은 DB에 적재 완료(`accepted_resume_embeddings`)되어 더 이상 레포에서 관리할 필요 없음.
- `engine/scripts/.ai.md` — 신규 생성. `data/.ai.md`의 입력 데이터 형식·생성 절차·현황·주의사항을 이전하고, 스크립트 목록 및 역할 설명 추가.
- `engine/.ai.md` — 구조 섹션에 `scripts/` 디렉토리 누락 항목 추가.

