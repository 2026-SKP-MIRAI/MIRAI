---
description: 모든 활성 워크트리에 origin/main을 rebase 방식으로 pull한다. 충돌 시 해당 워크트리를 건너뛰고 결과를 집계한다. 사용법: /broadpull-main
---

## 개요

인수 없음. 실행 시 모든 활성 워크트리에 `git pull --rebase origin main`을 순차 실행하고 결과를 집계한다.

---

## 실행 순서

### 1. 워크트리 목록 수집

```bash
git worktree list --porcelain
```

`--porcelain` 출력을 블록 단위(빈 줄 구분)로 파싱한다.

각 블록에서 추출:
- `worktree {경로}` → 워크트리 경로
- `branch refs/heads/{브랜치명}` → 브랜치명
- `detached` 또는 `bare` 키워드 → 해당 워크트리는 처리 대상 제외

메인 워크트리(첫 번째 블록)를 목록 맨 앞에 두고 순차 처리한다.

---

### 2. 각 워크트리 순차 처리

워크트리마다 다음 순서로 실행한다:

#### 2-1. Detached HEAD / bare 건너뜀

블록에 `detached` 또는 `bare` 키워드가 있으면:
- 결과 목록에 "⏭️ 해당없음 (detached/bare)" 기록 후 다음으로

#### 2-2. 미커밋 변경사항 확인

```bash
git -C {경로} status --porcelain
```

출력이 비어있지 않으면 (스테이징·언스테이징·미추적 파일 포함):
- 결과 목록에 "⏭️ 미커밋 변경사항 — 건너뜀" 기록 후 다음으로

#### 2-3. Rebase pull 실행

```bash
git -C {경로} pull --rebase origin main
```

종료 코드 확인:
- **exit 0** → 결과 목록에 "✓ 성공" 기록
- **exit != 0** → 아래 처리 후 결과 목록에 "⚠️ 충돌 — rebase 중단됨" 기록:
  ```bash
  git -C {경로} rebase --abort
  ```

---

### 3. 결과 집계 및 출력

모든 워크트리 처리 완료 후 다음 형식으로 출력:

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

충돌이 1건 이상이면 테이블 아래에 추가 출력:

```
⚠️  충돌이 발생한 워크트리는 수동으로 rebase를 진행하세요:
  cd {충돌워크트리경로} && git pull --rebase origin main
```
