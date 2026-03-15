# chore: broadpull-main 커맨드 추가

## 목적
main 워크트리와 모든 활성 워크트리에서 origin/main을 한 번에 pull하는 커맨드를 추가한다.

## 배경
워크트리가 여러 개일 때 각각 이동해서 pull하는 번거로움을 없애기 위함.

## 완료 기준
- [x] `.claude/commands/broadpull-main.md` 작성 (main + 전체 워크트리 순차 pull)
- [x] pull 방식은 **rebase 기반** (`git pull --rebase origin main`)
- [x] 충돌 발생 시 자동 처리 금지 — 해당 워크트리 건너뛰고 충돌 경고 출력
- [x] 각 워크트리 pull 성공/실패/충돌 결과 집계 후 출력
- [x] `.claude/commands/.ai.md` 커맨드 목록 반영

## 구현 플랜
1. `git worktree list`로 전체 워크트리 경로 수집
2. 각 경로에서 `git -C {path} pull --rebase origin main` 실행
3. 충돌 발생 시 `git -C {path} rebase --abort` 후 경고 출력, 다음 워크트리로 진행
4. 성공/실패/충돌 여부 집계 후 최종 출력

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-15

**현황**: 5/5 완료

**완료된 항목**:
- `.claude/commands/broadpull-main.md` 작성 (rebase pull, 충돌 건너뜀, 결과 집계)
- pull 방식 rebase 기반 구현 (`git pull --rebase origin main`)
- 충돌 시 exit code 감지 후 `rebase --abort` 실행, "⚠️ 충돌" 경고 기록
- 성공/충돌/건너뜀 결과 집계 테이블 + 수량 요약 출력
- `.claude/commands/.ai.md` 커맨드 목록에 broadpull-main 반영

**미완료 항목**: 없음

**변경 파일**: 3개

**구현 상세**:
- `broadpull-main.md`: `git worktree list --porcelain` 파싱으로 워크트리 수집. detached/bare 필터링. dirty 워크트리(`status --porcelain` 비어있지 않음) 건너뜀. exit code 기반 충돌 감지(grep 미사용). 충돌 시 `rebase --abort` 자동 실행. 결과 마크다운 테이블 집계.
- `.claude/commands/.ai.md`: broadpull-main.md 항목 추가 (워크플로우 커맨드 섹션 알파벳순 삽입)
