# MirAI 슬래시 커맨드 레퍼런스

Claude Code에서 `/` 로 시작하는 커맨드로 이슈 워크플로우를 자동화한다.

---

## `/plan` — 구현 계획 작성

```
/plan
/plan 15
```

현재 이슈의 `01_plan.md`에 구현 계획을 작성한다.

- OMC(oh-my-claudecode)가 있는 환경: `ralplan`을 호출해 Planner→Architect→Critic 합의 플랜 작성
- OMC 없는 환경: Claude가 직접 AC 기반으로 플랜을 작성하고 저장

---

## `/drop-issue` — 이슈 포기

```
/drop-issue
/drop-issue 15
/drop-issue 000015-pdf-upload
/drop-issue pdf-upload
```

> ⚠️ 메인 워크트리에서 실행해야 한다 (대상 워크트리 내부에서 실행 불가).

이슈를 중도 포기하고 모든 작업 흔적을 정리한다.

자동으로 처리:
- 포기 사유 입력 → GitHub 이슈에 코멘트
- 이슈 Close (`not planned`)
- 작업 폴더를 `docs/work/done/DROPPED-{번호}-{이름}`으로 이동
- 워크트리·로컬·리모트 브랜치 삭제

> 단축 별칭 없음 — 실수 방지를 위해 전체 커맨드명으로만 실행.

---

## `/remind-issue` — 세션 현황 확인

```
/remind-issue
/remind-issue 15
```

세션 재시작 후 현재 이슈 상태를 빠르게 파악한다.

자동으로 처리:
- AC 달성 현황 추정 출력 (브랜치 전체 변경사항 기준)
- 최근 변경 파일 목록
- 다음 할 작업 제안
- `00_issue.md` 작업 내역 섹션에 스냅샷 기록

---

## `/backlog-issue` — 이슈 생성

```
/backlog-issue
/backlog-issue feat
/backlog-issue chore "pre-commit 훅 설정"
```

인수가 없거나 부족하면 Claude가 순서대로 질문한다:
1. type — `feat` (새 기능) 또는 `chore` (환경/도구 개선)
2. 제목
3. 배경

완료 기준 초안을 제안하고 확인 후 이슈를 생성한다.

---

## `/start-issue` — 작업 시작

```
/start-issue 15
/start-issue 15 pdf-upload
/start-issue 000015-pdf-upload
/start-issue "claude-code-harness 패턴 검토"
```

| 인수 | 동작 |
|------|------|
| 이슈번호 | 제목에서 type·이름 자동 추출 |
| 이슈번호 + 짧은이름 | type만 이슈에서 조회 |
| `000015-pdf-upload` | 이슈번호·이름 직접 지정 |
| 제목 문자열 | 이슈 검색 후 진행 |

자동으로 처리:
- 워크트리 생성 (`.worktree/000015-pdf-upload`)
- 브랜치 생성 (`feat/000015-pdf-upload`)
- 작업 폴더 생성 (`docs/work/active/000015-pdf-upload`)
- 이슈 Assign → 보드 In Progress 자동 이동

---

## `/finish-issue` — PR 생성

```
/finish-issue
/finish-issue 15
/finish-issue 000015-pdf-upload
/finish-issue pdf-upload
```

| 인수 | 동작 |
|------|------|
| 없음 | 현재 브랜치 자동 감지 (워크트리 내 실행) |
| 이슈번호 | 브랜치 목록에서 번호로 탐색 |
| `000015-pdf-upload` | 직접 브랜치 지정 |
| 짧은이름 | 브랜치 목록에서 이름으로 탐색 |

자동으로 처리:
- `git diff` 분석 → 커밋 메시지 초안 생성
- 사용자 확인 후 커밋 + push
- PR 생성 (본문에 `Closes #15` 자동 포함)

---

## `/cleanup-issue` — 워크트리 정리

```
/cleanup-issue
/cleanup-issue 15
/cleanup-issue 000015-pdf-upload
/cleanup-issue pdf-upload
```

| 인수 | 동작 |
|------|------|
| 없음 | 전체 스캔 → 머지 완료된 이슈 일괄 정리 |
| 이슈번호 | 해당 워크트리만 정리 |
| `000015-pdf-upload` | 직접 지정 |
| 짧은이름 | 워크트리 목록에서 탐색 |

자동으로 처리:
- 이슈 상태 확인 (OPEN이면 경고, 진행은 허용)
- 워크트리 삭제
- 로컬 브랜치 삭제

> 머지 전 실행 시 작업 내용이 사라질 수 있다. PR 머지 확인 후 실행.

---

## 단축 별칭

전체 커맨드명 대신 단축 별칭을 사용할 수 있습니다:

| 단축 별칭 | 원본 커맨드 |
|-----------|------------|
| `/bi` | `/backlog-issue` |
| `/si` | `/start-issue` |
| `/fi` | `/finish-issue` |
| `/ci` | `/cleanup-issue` |
| `/ri` | `/remind-issue` |

> `/drop-issue`는 단축 별칭 없음 — 실수 방지를 위해 전체 커맨드명으로만 실행.

예시:
```
/si 15        # /start-issue 15 와 동일
/fi           # /finish-issue 와 동일
/ci           # /cleanup-issue 와 동일
/ri           # /remind-issue 와 동일
```

---

## 전제 조건

```bash
gh auth login   # 최초 1회
```

`gh` 미인증 상태에서 실행하면 커맨드가 안내한다.
