# chore: 워크플로우 커맨드 업데이트

## 목적
워크플로우 커맨드 신규 추가 및 기존 커맨드 개선

## 배경
이슈 포기 처리, 플랜 생성, 세션 재시작 시 현황 파악 등 반복 작업을 자동화한다.

## 완료 기준
- [ ] `/drop-issue` 커맨드 추가 (이슈 중도 포기 자동화 — 사유 입력, 이슈 닫기, 워크트리/브랜치 정리)
- [ ] `/plan` 커맨드 추가 (OMC 있으면 ralplan, 없으면 Claude가 직접 플랜 작성 → `01_plan.md` 저장)
- [ ] `/remind-issue` (`/ri`) 커맨드 추가 (세션 재시작 시 AC 자동 체크 + 현황 출력 + 작업 내역 기록)
- [ ] `finish-issue` AC 사전 확인 스텝 추가 (미완료 AC 있으면 PR 전 경고 + 사용자 확인)

## 구현 플랜
1. `/drop-issue` 커맨드 파일 작성
2. `/plan` 커맨드 파일 작성 (OMC 감지 후 분기)
3. `/remind-issue` + `/ri` 커맨드 파일 작성
4. `finish-issue.md` Step 1.5 AC 사전 확인 추가

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-15

**신규 커맨드 파일 생성:**
- `.claude/commands/plan.md` — OMC 있으면 ralplan 호출, 없으면 Claude 직접 01_plan.md 작성. attempt-and-fallback 방식으로 OMC 감지
- `.claude/commands/drop-issue.md` — 이슈 중도 포기 자동화. CWD 가드(워크트리 내부 실행 차단), 미커밋 변경사항 경고, `--reason "not planned"`, `DROPPED-` 접두사로 완료 작업과 구분
- `.claude/commands/remind-issue.md` — 세션 재시작 시 AC 달성 현황 출력. `git diff main...HEAD` 기준 전체 브랜치 변경사항 사용
- `.claude/commands/ri.md` — `/remind-issue` 단축 별칭

**기존 파일 수정:**
- `.claude/commands/.ai.md` — 신규 커맨드 목록 반영
- `docs/onboarding/commands.md` — `/plan`, `/drop-issue`, `/remind-issue` 섹션 추가, 별칭 테이블에 `/ri` 추가
- `docs/onboarding/workflow(command ver).md` — 한 줄 요약·플랜 단계·세션 재시작·포기 섹션 추가

**설계 결정:**
- `/drop-issue` 단축 별칭 없음 — 실수로 호출 시 돌이킬 수 없는 삭제 방지
- `/plan` OMC 감지를 파일시스템 경로 대신 attempt-and-fallback으로 변경 (Architect 권고 반영)
- `finish-issue` AC 사전 확인은 기존 Step 6에 이미 구현되어 있어 수정 불필요

