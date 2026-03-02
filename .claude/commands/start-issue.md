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

### 2. 이름 확정

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

### 3. 중복 확인

`git worktree list`를 실행해서 WORKTREE 경로가 이미 있는지 확인한다.
이미 존재하면:
```
오류: {WORKTREE} 이미 존재합니다. 이미 작업 중인 이슈입니다.
```
실행을 중단한다.

### 4. Worktree + 브랜치 생성

```
git worktree add {WORKTREE} -b {BRANCH}
```

### 5. Work 폴더 생성

```
mkdir -p {WORKFOLDER}
```

### 6. 이슈 Assign

```
gh issue edit {이슈번호} --add-assignee @me
```
GitHub Actions가 자동으로 프로젝트 보드를 In Progress로 이동시킨다.

### 7. 완료 안내

```
✓ 워크트리: {WORKTREE}
✓ 브랜치:   {BRANCH}
✓ 폴더:     {WORKFOLDER}
✓ 이슈 #{이슈번호} assign 완료

다음 명령으로 작업 디렉토리로 이동하세요:
  cd {WORKTREE}
```

이동 후 작업 전 반드시 확인:

```
⚠️  작업 시작 전 체크리스트
1. 작업 대상 디렉토리의 .ai.md 를 읽어 현재 구조·규칙을 파악하세요.
2. docs/specs/ 에서 이슈의 AC(인수 조건)를 확인하세요.
3. engine/docs/INTERFACE.md — 엔진 API 사용 시 확인하세요.
```
