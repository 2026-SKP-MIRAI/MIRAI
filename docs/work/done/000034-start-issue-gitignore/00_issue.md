# chore: start-issue 워크트리 생성 시 gitignore 대상 파일 심볼릭 링크 자동 연결

## 목적
워크트리 생성 후 gitignore된 파일(`.env`, `tests/fixtures/` 등)이 없어 개발 환경을 별도로 세팅해야 하는 불편함 해소. 심볼릭 링크로 메인 워크트리의 gitignore 파일을 자동 연결한다.

## 배경
`git worktree add`로 생성된 워크트리에는 gitignore 파일이 복사되지 않는다. 현재 프로젝트에서 gitignore 대상 중 개발 시 필요한 파일/디렉토리는 다음과 같다:
- `.env`, `.env.*` — 환경변수 (엔진 `ANTHROPIC_API_KEY`, 서비스 `ENGINE_BASE_URL` 등)
- `tests/fixtures/` — 테스트용 샘플 PDF 등 (gitignore 처리됨)
- `.venv/` — Python 가상환경
- `node_modules/` — Node 의존성

메인 워크트리에 이미 존재하는 경우, 워크트리마다 중복 생성 대신 심볼릭 링크로 공유하면 된다.

## 완료 기준
- [x] `start-issue` 커맨드의 완료 단계(Step 5 이후)에 심볼릭 링크 생성 스텝 추가
- [x] 링크 대상: `.env`, `.env.*`, `**/tests/fixtures/`, `.venv/`, `node_modules/`
- [x] 메인 워크트리에 해당 파일/디렉토리가 존재하는 경우에만 링크 생성
- [x] 이미 존재하면 skip (덮어쓰기 없음)
- [x] 생성된 링크 목록을 완료 안내에 출력

## 구현 플랜
1. `start-issue.md`의 Step 5 (Worktree 생성) 이후에 심볼릭 링크 스텝 추가
2. 메인 워크트리 루트(`git worktree list` 첫 번째 항목)에서 대상 탐색
3. `find {MAIN} -name ".env" -o -name ".env.*"` 등으로 파일 목록 수집
4. 각 파일에 대해 `ln -s {MAIN_PATH} {WORKTREE_PATH}` 실행
5. 완료 안내 메시지에 연결된 파일 목록 포함

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### `.claude/commands/start-issue.md` — Step 5-1 삽입 + Step 8 완료 안내 수정

**변경 이유**: `git worktree add`로 생성된 워크트리에는 gitignore 파일이 복사되지 않아 개발 환경을 매번 별도 세팅해야 했음. 메인 워크트리의 파일을 심볼릭 링크로 공유하면 이 불편을 해소할 수 있다.

**변경 내용**:
- Step 5 (Worktree 생성)와 Step 6 (Work 폴더 생성) 사이에 **Step 5-1** 추가
  - `git worktree list --porcelain | head -1`로 메인 워크트리 루트 조회
  - `.env`, `.env.*`, `tests/fixtures`, `.venv`, `node_modules` 5종 대상
  - 각 대상에 대해 존재 여부 확인 후 `ln -s` 실행 (없으면 skip, 이미 있으면 skip)
  - 메인 워크트리 == 신규 워크트리인 경우 스텝 전체 skip
  - 링크 성공 항목을 `LINKED_FILES`에 수집
- Step 8 완료 안내에 `✓ 심볼릭 링크: ...` 섹션 추가 (링크 없으면 생략)

### `.claude/commands/.ai.md` — start-issue.md 설명 업데이트

심볼릭 링크 자동 연결 기능 추가 사실을 반영.

### `.claude/commands/finish-issue.md` — Step 10 사용자 확인 개선

커밋 메시지 확인 시 `git diff --stat` 기반 변경 파일 목록을 함께 출력하도록 수정. 커밋 전 포함 파일을 한눈에 확인 가능.

