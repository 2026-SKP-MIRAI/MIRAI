# [#317] chore: [seung] 레포 루트 data/ 디렉토리 제거 — 구현 계획

> 작성: 2026-03-28

---

## 완료 기준

- [ ] `data/` 디렉토리 및 `data/.ai.md` 삭제
- [ ] `.gitignore`에서 `data/accepted_resumes.json` 항목 제거
- [ ] `engine/scripts/build_resume_index.py` 기본 입력 경로 관련 안내를 `engine/scripts/.ai.md`에 이전
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 구현 계획

### Step 1 — `data/` 디렉토리 삭제

```bash
git rm data/.ai.md
```

### Step 2 — `.gitignore` 정리

`data/accepted_resumes.json` 항목 및 관련 주석 제거

### Step 3 — `engine/scripts/.ai.md` 안내 이전

`data/.ai.md` 내용 중 `build_resume_index.py` 입력 경로 규약을 `engine/scripts/.ai.md`에 추가
