# [CHORE] 워크플로우 커맨드 전반 개선 (backlog/start/finish/cleanup-issue)

## 목적
실제 사용 중 발견된 워크플로우 커맨드들의 UX 개선점 및 버그를 수정해 커맨드 기반 작업 흐름의 완성도를 높인다.

## 배경
/backlog-issue, /start-issue, /finish-issue, /cleanup-issue 커맨드를 실제 운용하면서 누락된 기능, 오동작, UX 불편함을 발견함.

## 완료 기준
- [ ] `backlog-issue`: 이슈 생성 시 간단한 구현 플랜 섹션 자동 포함
- [ ] `start-issue`: Ready 상태인 이슈만 작업 시작 허용 (상태 검증 추가)
- [ ] `start-issue`: 워크트리 생성 후 해당 디렉토리 이동 안내
- [ ] `finish-issue`: 커밋 전 코드 간소화 단계 추가 (불필요한 로깅·임시 테스트용 코드·이미지/텍스트 잔여물 제거, 반복 코드 함수/모듈화)
- [ ] `finish-issue`: 커밋 전 코드 리뷰 단계 추가 (선 리뷰 후 커밋)
- [ ] `finish-issue`: docs/work 완료문서 업데이트 자동화
- [ ] `finish-issue`: PR 본문에 docs/work 완료문서 내용 자동 포함 (close issue 외 실제 작업 내용 기술)
- [ ] `finish-issue`: done으로 이동 오동작 픽스 (완료문서 미확인 버그)
- [ ] `cleanup-issue`: 리모트 브랜치도 함께 삭제

## 구현 플랜
<!-- 작업 착수 전 /plan 으로 설계 후 요약을 여기에 작성 (선택) -->

## 개발 체크리스트
- [ ] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### backlog-issue.md

이슈 생성 시 구현 방향을 미리 정리할 수 있도록 개선했다.

- 정보 수집 단계에 구현 플랜 질문 추가 ("어떻게 구현할 생각인가요? 모르면 생략 가능")
- feat/chore 이슈 템플릿 모두에 `## 구현 플랜` 섹션 삽입
- chore 템플릿에 `## 개발 체크리스트` 섹션도 추가 (feat과 동일하게 맞춤)

### start-issue.md

두 가지 문제를 해결했다.

**이슈 상태 검증 추가 (step 2 신규)**
- `gh issue view --json state,projectItems`로 CLOSED 여부 및 프로젝트 보드 상태 확인
- CLOSED 이슈는 즉시 중단
- Ready가 아닌 이슈는 경고 출력 후 사용자 확인을 받아 진행

**Work 폴더 초기화 개선 (step 6)**
- 기존: `mkdir -p {WORKFOLDER}` — Git이 빈 디렉토리를 추적하지 않아 폴더가 미생성됨
- 변경: `mkdir -p {WORKTREE}/{WORKFOLDER}` 후 `00_issue.md` 파일 생성·커밋
- GitHub 이슈 내용(`gh issue view --json title,body`)을 `00_issue.md`로 저장
- 하단에 `## 작업 내역` 섹션을 append하여 작업 기록 공간 확보
- 경로 버그도 동시 수정: 상대 경로 → `{WORKTREE}/{WORKFOLDER}` 절대 경로

### finish-issue.md

4개의 신규 단계 추가 및 PR 본문 구조화.

**코드 간소화 (step 4 신규)**
디버그 출력, 임시 코드, 하드코딩된 테스트 데이터, 반복 패턴을 커밋 전에 정리.

**AC 체크 (step 6 신규)**
`00_issue.md`의 `## 완료 기준` 체크리스트를 읽어 변경된 코드와 대조. 미충족 항목이 있으면 사용자 확인을 받아 진행 여부 결정.

**00_issue.md 작업 내역 자동 작성 (step 10 신규)**
diff + 이슈 내용을 분석해 `## 작업 내역` 섹션에 파일별 변경 이유·내용을 서술 후 자동 커밋.

**PR 본문 구조화 (step 11)**
기존 `Closes #{이슈번호}` 단일 라인에서 세 섹션으로 확장:
- `## 이슈 배경` — 00_issue.md 요약 2~3문장
- `## 완료 기준 (AC)` — AC 체크 결과 체크박스 포함
- `## 작업 내역` — 00_issue.md의 작업 내역 섹션 전문

**docs/work active → done 이동 (step 12)**
PR 생성 완료 후 작업 폴더를 `done/`으로 이동. 폴더 존재 여부를 확인 후 진행하도록 명확화.

### cleanup-issue.md

로컬 브랜치 삭제 후 리모트 브랜치도 함께 정리하도록 step 5 추가:
- `git ls-remote --heads origin {브랜치명}`으로 존재 확인
- 존재하면 `git push origin --delete {브랜치명}` 실행
- 이미 삭제된 경우 오류 없이 안내 메시지 출력

### .ai.md

각 커맨드 설명을 새로 추가된 기능이 드러나도록 업데이트했다.

### 기술적 결정

- `work.md` 별도 파일 제거 → `00_issue.md` 단일 파일 통합: 이슈 문서와 작업 내역을 한 곳에서 관리해 파일 분산으로 인한 탐색 비용 제거
- 작업 내역 섹션은 `/start-issue` 시점에 `---` 구분선과 함께 미리 생성, `/finish-issue` 시점에 내용 채움

