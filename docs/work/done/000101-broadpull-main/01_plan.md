# [#101] chore: broadpull-main 커맨드 추가 — 구현 계획

> 작성: 2026-03-15

---

## 완료 기준

- [ ] `.claude/commands/broadpull-main.md` 작성 (main + 전체 워크트리 순차 pull)
- [ ] pull 방식은 **rebase 기반** (`git pull --rebase origin main`)
- [ ] 충돌 발생 시 자동 처리 금지 — 해당 워크트리 건너뛰고 충돌 경고 출력
- [ ] 각 워크트리 pull 성공/실패/충돌 결과 집계 후 출력
- [ ] `.claude/commands/.ai.md` 커맨드 목록 반영

---

## 구현 계획

### 개요

2개 파일을 변경한다:

| 파일 | 동작 |
|------|------|
| `.claude/commands/broadpull-main.md` | 신규 생성 |
| `.claude/commands/.ai.md` | 수정 (항목 추가) |

---

### Step 1: `broadpull-main.md` 커맨드 파일 작성

**파일**: `.claude/commands/broadpull-main.md`

커맨드 파일은 YAML frontmatter + 실행 순서 마크다운으로 구성한다.

#### YAML frontmatter

```
---
description: 모든 활성 워크트리에 origin/main을 rebase 방식으로 pull한다. 충돌 시 해당 워크트리를 건너뛰고 결과를 집계한다. 사용법: /broadpull-main
---
```

인수(`$ARGUMENTS`)는 없다. 이 커맨드는 인수 없이 실행된다.

#### 실행 순서 — 본문에 기술할 내용

**1. 워크트리 목록 수집**

```bash
git worktree list --porcelain
```

`--porcelain` 출력을 블록 단위로 파싱한다. 각 블록의 형식:
```
worktree {경로}
HEAD {커밋해시}
branch refs/heads/{브랜치명}    ← 정상 브랜치
# 또는
detached                        ← detached HEAD
# 또는
bare                            ← bare 레포
```

파싱 규칙:
- `worktree` 라인 → 경로 추출
- `branch refs/heads/` 라인 → 브랜치명 추출
- `detached` 또는 `bare` 라인 → 해당 워크트리는 **건너뜀** (결과에 "해당없음"으로 기록)

수집 후 **메인 워크트리(첫 번째 블록)를 목록 맨 앞**에 두고 순차 처리한다.

**2. 각 워크트리 순차 처리**

워크트리마다 다음 순서:

2-1. Detached HEAD / bare 여부 확인 → 해당하면 건너뜀

2-2. 미커밋 변경사항 확인:
```bash
git -C {경로} status --porcelain
```
출력이 비어있지 않으면 → **건너뜀**, 결과에 "⏭️ 미커밋 변경사항" 기록

2-3. rebase pull 실행:
```bash
git -C {경로} pull --rebase origin main
```

2-4. 종료 코드 확인:
- `exit 0` → 결과에 "✓ 성공" 기록
- `exit != 0` → 진행 중인 rebase 중단 후 결과에 "⚠️ 충돌" 기록:
  ```bash
  git -C {경로} rebase --abort
  ```

**3. 결과 집계 및 출력**

모든 워크트리 처리 완료 후 요약 테이블 출력:

```
## broadpull-main 결과

| 워크트리 경로 | 브랜치 | 결과 |
|---------------|--------|------|
| (메인) | main | ✓ 성공 |
| .worktree/000015-pdf-upload | feat/000015-pdf-upload | ✓ 성공 |
| .worktree/000023-parser-fix | fix/000023-parser-fix | ⚠️ 충돌 — rebase 중단됨 |
| .worktree/000030-auth-flow  | feat/000030-auth-flow | ⏭️ 미커밋 변경사항 — 건너뜀 |

---
성공: 2 / 충돌: 1 / 건너뜀: 1 / 총: 4
```

충돌이 1건 이상이면 하단에 수동 해결 안내 출력:
```
⚠️  충돌이 발생한 워크트리는 수동으로 rebase를 진행하세요:
  cd {워크트리경로} && git pull --rebase origin main
```

---

### Step 2: `.ai.md` 커맨드 목록 반영

**파일**: `.claude/commands/.ai.md`

`### 워크플로우 커맨드` 섹션 — `backlog-issue.md` 다음에 삽입:

```markdown
- `broadpull-main.md` — 모든 활성 워크트리에 origin/main을 rebase pull (충돌 시 건너뛰고 결과 집계)
```

---

## 설계 결정 사항

| 결정 | 이유 |
|------|------|
| 모든 워크트리에 `origin/main` rebase | 이슈 명시 목적: 기능 브랜치도 최신 main 위에 유지 |
| `git status --porcelain` 사용 | `--short`는 로케일 영향 가능, porcelain은 기계 안정적 |
| exit code로 충돌 감지 | `grep "rebase in progress"` 방식은 로케일·버전 의존적 |
| detached HEAD / bare 건너뜀 | pull 대상 브랜치 없음, 안전 우선 |
| 미커밋 변경사항 있으면 건너뜀 | rebase 충돌 위험 방지, 사용자 코드 보호 |
