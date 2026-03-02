# MirAI 슬래시 커맨드 레퍼런스

Claude Code에서 `/` 로 시작하는 커맨드로 이슈 워크플로우를 자동화한다.

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

## 전제 조건

```bash
gh auth login   # 최초 1회
```

`gh` 미인증 상태에서 실행하면 커맨드가 안내한다.
