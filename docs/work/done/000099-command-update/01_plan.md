# [#99] chore: 워크플로우 커맨드 업데이트 — 구현 계획

> 작성: 2026-03-15

---

## 완료 기준

- [ ] `/drop-issue` 커맨드 추가 (이슈 중도 포기 자동화 — 사유 입력, 이슈 닫기, 워크트리/브랜치 정리)
- [ ] `/plan` 커맨드 추가 (OMC 있으면 ralplan, 없으면 Claude가 직접 플랜 작성 → `01_plan.md` 저장)
- [ ] `/remind-issue` (`/ri`) 커맨드 추가 (세션 재시작 시 AC 자동 체크 + 현황 출력 + 작업 내역 기록)
- [ ] `finish-issue` AC 사전 확인 스텝 추가 (미완료 AC 있으면 PR 전 경고 + 사용자 확인)
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 구현 계획

> Architect + Critic 리뷰 반영 (2026-03-15)

### 파일 목록

| 작업 | 파일 | 비고 |
|------|------|------|
| 신규 생성 | `.claude/commands/plan.md` | 플랜 작성 커맨드 |
| 신규 생성 | `.claude/commands/drop-issue.md` | 이슈 포기 커맨드 |
| 신규 생성 | `.claude/commands/di.md` | drop-issue 단축 별칭 |
| 신규 생성 | `.claude/commands/remind-issue.md` | 세션 재시작 현황 커맨드 |
| 신규 생성 | `.claude/commands/ri.md` | remind-issue 단축 별칭 |
| 수정 | `.claude/commands/.ai.md` | 신규 커맨드 목록 반영 |

> `finish-issue.md` 수정 불필요 — Step 6에 이미 AC 체크·미충족 경고·사용자 확인 구현됨 (`finish-issue.md:110-133`)

---

### Step 1 — `/plan` 커맨드 작성 (가장 단순, 먼저 구현)

**파일:** `.claude/commands/plan.md`

**인수:** `$ARGUMENTS` — 선택사항. 이슈번호 또는 생략(현재 브랜치에서 자동 감지)

동작 흐름:
1. 인수 있으면 해당 이슈번호, 없으면 `git branch --show-current`로 이슈번호·WORKFOLDER 확정
2. `{WORKFOLDER}/00_issue.md` 읽어 AC 추출 (없으면 `gh issue view`에서 가져오기)
3. OMC 감지: `/oh-my-claudecode:ralplan` 호출을 시도한다
   - **OMC 있는 경우**: ralplan이 처리 (attempt-and-success)
   - **OMC 없는 경우**: Claude가 직접 `01_plan.md`의 `## 구현 계획` 섹션에 플랜 작성
4. 작성된 플랜을 `{WORKFOLDER}/01_plan.md`에 저장

> **OMC 감지 방식**: 파일시스템 경로 확인 대신 `/oh-my-claudecode:ralplan` 직접 시도 후 fallback. 파일시스템 기반 감지는 설치 방식에 따라 부정확하므로 사용하지 않는다.

---

### Step 2 — `/drop-issue` 커맨드 작성

**파일:** `.claude/commands/drop-issue.md`

**인수:** `$ARGUMENTS` — `start-issue`와 동일한 형식 (이슈번호, 짧은이름, 생략 등)

동작 흐름:
1. 인수 파싱 — `start-issue`와 동일한 방식으로 이슈번호·브랜치·WORKFOLDER 확정
2. **CWD 감지**: 현재 셸이 대상 워크트리 내부인지 확인
   - 내부이면: `⚠️ 현재 대상 워크트리 내부입니다. 아래 명령으로 메인 워크트리로 이동 후 다시 실행하세요.` 안내 후 중단
3. **미커밋 변경사항 가드**: `git -C {WORKTREE} status --short` 확인
   - 미커밋 변경사항 있으면: `⚠️ 미저장 변경사항이 있습니다. 포기 시 모두 삭제됩니다. 계속하시겠습니까? (y/n)` + 사용자 확인
4. 포기 사유 입력 요청 (필수 — 빈 값 허용 안 함)
5. GitHub 이슈에 사유 코멘트 추가 (`gh issue comment {이슈번호} --body "포기 사유: {사유}"`)
6. 이슈 Close (`gh issue close {이슈번호} --reason "not planned"`)
7. 작업 폴더가 있으면:
   - `00_issue.md` 하단에 포기 사유·날짜 추가
   - `docs/work/active/{PADDED}-{짧은이름}` → `docs/work/done/DROPPED-{PADDED}-{짧은이름}` 이동
8. 워크트리 삭제 (`git worktree remove --force {WORKTREE}`)
9. 로컬 브랜치 삭제 (`git branch -D {BRANCH}`)
10. 리모트 브랜치 삭제 (`git push origin --delete {BRANCH}`, 없으면 skip)
11. 완료 안내

> **done/ 구분**: `DROPPED-` 접두사로 완료 작업(`{PADDED}-{짧은이름}`)과 포기 작업 구분

**단축 별칭:** `.claude/commands/di.md`

---

### Step 3 — `/remind-issue` 커맨드 작성

**파일:** `.claude/commands/remind-issue.md`

**인수:** `$ARGUMENTS` — 선택사항. 이슈번호 또는 생략(현재 브랜치 자동 감지)

동작 흐름:
1. 인수 파싱 — 인수 없으면 현재 브랜치에서 이슈번호·WORKFOLDER 확정
2. `00_issue.md` 읽어 AC 목록 추출
3. **전체 브랜치 변경사항** 기준으로 각 AC 충족 여부 추정:
   - `git diff main...HEAD` — 브랜치 전체 커밋 변경사항
   - `git diff` — 미스테이징 변경사항
   - `git diff --cached` — 스테이징된 변경사항
   - 판단 결과는 "추정"임을 명시 (일부 AC는 코드 구조만으로 판단 불가)
4. 다음 형식으로 출력:

```
📋 이슈 #99 현황 — chore: 워크플로우 커맨드 업데이트

## 완료 기준 (추정)
- [x] /drop-issue 커맨드 추가 — 파일 존재 확인
- [ ] /plan 커맨드 추가 — 미완료
- [ ] /remind-issue 커맨드 추가 — 미완료 (현재 작업 중)
- [x] finish-issue AC 사전 확인 추가 — 기존 구현 확인

## 브랜치 변경 파일 (main 기준)
  A  .claude/commands/drop-issue.md
  A  .claude/commands/di.md

## 다음 작업
- /plan 커맨드 구현
- /remind-issue 커맨드 구현
```

5. `00_issue.md`의 `## 작업 내역` 섹션에 현황 스냅샷 추가
   - 오늘 날짜 항목 이미 있으면 **업데이트** (skip 아님 — 진행상황이 바뀔 수 있음)

**단축 별칭:** `.claude/commands/ri.md`

---

### Step 4 — `finish-issue` AC 사전 확인 검증

현재 `finish-issue.md` Step 6 (`finish-issue.md:110-133`)에 AC 체크 및 미충족 시 경고·사용자 확인 이미 구현됨.
→ AC 충족. 별도 수정 불필요.

---

### Step 5 — `.ai.md` 업데이트

`.claude/commands/.ai.md`에 신규 커맨드(`plan`, `drop-issue`, `di`, `remind-issue`, `ri`) 목록 추가.
