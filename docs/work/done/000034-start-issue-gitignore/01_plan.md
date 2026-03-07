# [#34] chore: start-issue 워크트리 생성 시 gitignore 대상 파일 심볼릭 링크 자동 연결 — 구현 계획

> 작성: 2026-03-08

---

## 완료 기준

- [ ] `start-issue` 커맨드의 Worktree 생성(Step 5) 이후에 심볼릭 링크 생성 스텝 추가
- [ ] 링크 대상: `.env`, `.env.*`, `tests/fixtures/`, `.venv/`, `node_modules/`
- [ ] 메인 워크트리에 해당 파일/디렉토리가 존재하는 경우에만 링크 생성
- [ ] 이미 존재하면 skip (덮어쓰기 없음)
- [ ] 생성된 링크 목록을 완료 안내에 출력

---

## 구현 계획

### 수정 대상 파일

- `.claude/commands/start-issue.md` — Step 5 (line 93–97) 이후에 새 스텝 삽입

### 변경 내용

Step 5 (Worktree 생성)와 Step 6 (Work 폴더 생성) 사이에 **Step 5-1** 추가:

```
### 5-1. gitignore 대상 심볼릭 링크 생성

메인 워크트리에 있는 gitignore 파일을 새 워크트리에 심볼릭 링크로 연결한다.

1. 메인 워크트리 루트 조회:
   git worktree list --porcelain | head -1 | sed 's/^worktree //'

2. 링크 대상 목록 (상대 경로 기준):
   - .env
   - .env.* (glob 패턴)
   - tests/fixtures (디렉토리)
   - .venv (디렉토리)
   - node_modules (디렉토리)

3. 각 대상에 대해:
   - MAIN_PATH = {MAIN}/{target}
   - WORKTREE_PATH = {WORKTREE}/{target}
   - MAIN_PATH가 존재하지 않으면 skip
   - WORKTREE_PATH가 이미 존재하면 skip (덮어쓰기 없음)
   - 부모 디렉토리가 없으면 mkdir -p로 생성
   - ln -s {MAIN_PATH} {WORKTREE_PATH}

4. 링크된 항목 목록을 내부 변수(LINKED_FILES)에 저장 → Step 8 완료 안내에서 출력
```

### Step 8 완료 안내 수정

링크된 파일이 1개 이상이면 완료 메시지에 섹션 추가:

```
✓ 심볼릭 링크:
  → .env
  → tests/fixtures
  (없으면 이 섹션 생략)
```

### 엣지 케이스

| 상황 | 처리 |
|------|------|
| 메인 워크트리 == 현재 워크트리 (최초 브랜치) | 동일 경로이므로 링크 불필요, skip |
| `.env.*` glob에 여러 파일 매칭 | 각각 개별 링크 생성 |
| `tests/fixtures`가 여러 위치에 존재 | 프로젝트 루트 기준 `tests/fixtures`만 처리 (depth 제한) |
| 링크 생성 실패 (권한 등) | 오류 메시지 출력 후 계속 진행 (중단 없음) |

---

## 검증 방법

1. `git worktree add` 후 `.env`, `tests/fixtures`가 심볼릭 링크로 생성됐는지 확인:
   ```
   ls -la {WORKTREE}/.env         # -> ../../.env (메인 워크트리 절대경로)
   ls -la {WORKTREE}/tests/fixtures
   ```
2. 이미 링크가 있는 상태에서 재실행해도 오류 없이 skip 되는지 확인
3. 메인 워크트리에 없는 파일(`.venv` 등)은 링크 생성 안 됨을 확인
4. 완료 안내 메시지에 링크된 파일 목록이 출력되는지 확인
