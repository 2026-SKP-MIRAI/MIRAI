---
description: Ready 이슈 작업을 시작한다. 워크트리, 브랜치, work 폴더를 생성하고 이슈를 assign한다. 사용법: /start-issue <이슈번호|짧은이름> [짧은이름]
---

## 인수 형식 (유연하게 지원)

`$ARGUMENTS`는 다음 형식 중 하나다:

| 형식 | 예시 | 동작 |
|------|------|------|
| 이슈번호만 | `15` | 이슈 조회 → 제목에서 type·짧은이름 자동 추출 |
| 이슈번호 + 짧은이름 | `15 my-feature` | type은 이슈 제목에서 추출 |
| 6자리 패딩 + 짧은이름 | `000015-my-feature` | 이슈번호·짧은이름 분리 후 type 조회 |
| 제목 문자열 | `claude-code-harness 패턴 검토` | `gh issue list --search`로 이슈 검색 |

## 실행 순서

### 1. 인수 파싱 및 이슈 조회

**이슈번호(정수)만 있는 경우:**
```
gh issue view {번호} --json number,title,labels
```
제목에서 type 추출 규칙:
- `[FEAT]` 또는 `feat:` 접두사 → `feat`
- `[FIX]` 또는 `fix:` → `fix`
- `[CHORE]` 또는 `chore:` → `chore` (→ `refactor` 사용)
- `[DOCS]` 또는 `docs:` → `docs`
- 접두사 없으면 labels에서 추출, 없으면 `feat` 기본값

짧은이름 자동 생성 규칙 (짧은이름 미제공 시):
- 제목에서 접두사(`[...]`, `feat:` 등) 제거
- 영문+숫자만 남기고 소문자 변환, 공백→하이픈
- 3단어 이내로 자름
- 예: `[CHORE] claude-code-harness 패턴 검토` → `claude-code-harness`

**`000015-my-feature` 형식인 경우:**
- 앞 6자리 숫자 = 이슈번호, 나머지 = 짧은이름
- `gh issue view`로 type 조회

**제목 문자열인 경우:**
```
gh issue list --search "{제목}" --json number,title
```
첫 번째 결과를 사용. 여러 개이면 목록 출력 후 선택 요청.

### 2. 이슈 상태 검증

이슈 상태를 확인한다:
```
gh issue view {이슈번호} --json state,projectItems
```

**이슈가 CLOSED 상태이면** 즉시 중단한다:
```
오류: 이슈 #{이슈번호}는 이미 완료된 이슈입니다 (CLOSED).
```

**프로젝트 보드 상태가 "Ready"가 아니면** 경고를 출력하고 사용자 확인을 받는다:
```
⚠️  이슈 #{이슈번호}가 Ready 상태가 아닙니다.
현재 상태: {projectItems에서 추출한 상태, 조회 불가 시 "확인 불가"}
Ready 상태의 이슈만 작업을 시작하는 것을 권장합니다.
계속 진행하시겠습니까? (y/n)
```

projectItems 조회가 불가능하거나 프로젝트에 연결되지 않은 경우에는 경고 없이 진행한다.

### 3. 이름 확정

- PADDED = 이슈번호 6자리 zero-pad (15 → `000015`)
- 짧은이름 = 제공값 또는 자동 생성값
- WORKTREE = `.worktree/{PADDED}-{짧은이름}`
- BRANCH = `{type}/{PADDED}-{짧은이름}`
- WORKFOLDER = `docs/work/active/{PADDED}-{짧은이름}`

확정된 값을 보여주고 진행한다:
```
이슈 #{번호}: {제목}
브랜치: {BRANCH}
워크트리: {WORKTREE}
```

### 4. 중복 확인

`git worktree list`를 실행해서 WORKTREE 경로가 이미 있는지 확인한다.
이미 존재하면:
```
오류: {WORKTREE} 이미 존재합니다. 이미 작업 중인 이슈입니다.
```
실행을 중단한다.

### 5. main 최신화

워크트리 생성 전 로컬 main을 최신화해 새 브랜치의 시작점을 최신 커밋으로 맞춘다:

```
git pull origin main
```

### 6. Worktree + 브랜치 생성

```
git worktree add {WORKTREE} -b {BRANCH}
```

### 6-1. gitignore 대상 심볼릭 링크 생성

메인 워크트리에 있는 gitignore 대상 파일/디렉토리를 새 워크트리에 심볼릭 링크로 연결한다.

1. 메인 워크트리 루트 조회:
   ```
   git worktree list --porcelain | head -1 | sed 's/^worktree //'
   ```

2. 링크 대상 (상대 경로 기준, 메인 워크트리 루트에서 탐색):
   - `.env`
   - `.env.*` (glob — `.env.local`, `.env.development` 등)
   - `tests/fixtures` (디렉토리)
   - `.venv` (디렉토리)
   - `node_modules` (디렉토리)

3. 각 대상에 대해:
   - `MAIN_PATH = {MAIN}/{target}` — 존재하지 않으면 skip
   - `WORKTREE_PATH = {WORKTREE}/{target}` — 이미 존재하면 skip (덮어쓰기 없음)
   - 부모 디렉토리가 없으면 `mkdir -p`로 생성
   - `ln -s {MAIN_PATH} {WORKTREE_PATH}`
   - 성공한 항목을 `LINKED_FILES` 목록에 추가

4. 메인 워크트리와 신규 워크트리가 동일한 경우(최초 브랜치) 스텝 전체 skip.

링크 생성 실패(권한 등) 시 오류 메시지만 출력하고 계속 진행한다.

### 7. Work 폴더 생성

```
mkdir -p {WORKTREE}/{WORKFOLDER}
```

#### 7-1. `00_issue.md` 생성

이슈 내용을 저장하고, 하단에 작업 내역 섹션을 추가한다:
```
gh issue view {이슈번호} --json title,body \
  --jq '"# " + .title + "\n\n" + .body' \
  > {WORKTREE}/{WORKFOLDER}/00_issue.md

cat >> {WORKTREE}/{WORKFOLDER}/00_issue.md << 'EOF'

---

## 작업 내역

EOF
```

#### 7-2. `01_plan.md` 생성 (AC 체크리스트 포함)

이슈 body에서 AC 항목을 추출해 체크리스트로 변환한다:

1. `gh issue view {이슈번호} --json body --jq '.body'` 로 이슈 body를 가져온다
2. body에서 AC 섹션을 찾는다 (헤더 키워드: `## AC`, `## 완료 기준`, `## Acceptance Criteria`, `## 인수 조건`)
3. AC 섹션의 항목들을 `- [ ] {항목}` 형태의 체크리스트로 변환한다
4. AC 항목이 없으면 체크리스트 없이 플랜 템플릿만 생성한다

`01_plan.md` 형식:
```markdown
# [#{이슈번호}] {제목} — 구현 계획

> 작성: {오늘 날짜}

---

## 완료 기준

- [ ] {AC 항목 1}
- [ ] {AC 항목 2}
...

---

## 구현 계획

(작성 예정)
```

파일은 커밋하지 않고 unstaged 상태로 둔다. `/finish-issue` 실행 시 메인 커밋에 함께 포함된다.

### 8. 이슈 Assign

```
gh issue edit {이슈번호} --add-assignee @me
```
GitHub Actions가 자동으로 프로젝트 보드를 In Progress로 이동시킨다.

### 9. 완료 안내

```
✓ 워크트리: {WORKTREE}
✓ 브랜치:   {BRANCH}
✓ 폴더:     {WORKFOLDER}
✓ 이슈 #{이슈번호} assign 완료
✓ 심볼릭 링크: {LINKED_FILES 목록, 없으면 이 줄 생략}
  → .env
  → tests/fixtures
  ...

다음 명령으로 작업 디렉토리로 이동하세요:
  cd {WORKTREE}
```

이동 후 작업 전 반드시 확인:

```
⚠️  작업 시작 전 체크리스트
1. 작업 대상 디렉토리의 .ai.md 를 읽어 현재 구조·규칙을 파악하세요.
2. docs/specs/ 에서 이슈의 AC(인수 조건)를 확인하세요.
3. engine/.ai.md — 엔진 계약 (타입·불변식·API) 확인하세요.
```
