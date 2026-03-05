# chore: 엄브렐라 레포 → 모노레포 롤백

## 목적
서브모듈 기반 엄브렐라 레포 구조를 단순 모노레포로 롤백한다. PR 워크플로우 복잡성(서브모듈 레포별 별도 PR·푸시 필요) 때문에 모노레포가 현 팀 규모에 더 적합하다고 판단.

## 배경
Issue #17에서 엄브렐라 레포로 전환했으나, 실제 운영 시 PR 워크플로우가 복잡해지는 문제가 명확해짐. 서브모듈 레포를 먼저 푸시하고 부모 레포 포인터를 업데이트해야 하는 구조는 현 팀 규모·속도에 맞지 않음. 단순 디렉토리 기반 모노레포로 운영하는 것이 YAGNI 원칙에 부합.

## 완료 기준
- [x] `docs/whitepaper/mirai_project_plan.md`의 `umbrella repo` 표현이 `monorepo`로 교체됨
- [x] `AGENTS.md`에서 submodule 참조(`(submodule: mirai-engine)`, `(각각 submodule)`, `→ mirai-xxx`) 제거되고 순수 디렉토리 구조로 기술됨
- [x] `.gitmodules` 파일 삭제 및 `git submodule deinit` 완료
- [x] `.claude/commands/cleanup-issue.md`의 "submodule 포함 워크트리 대응" 주석 업데이트

## 구현 플랜
1. `git submodule deinit --all` + `.gitmodules` 삭제 + `git rm` 으로 서브모듈 연결 해제
2. `AGENTS.md` 디렉토리 구조에서 submodule 참조 제거
3. `mirai_project_plan.md:27` `umbrella repo` → `monorepo` 교체
4. `.claude/commands/cleanup-issue.md:74` submodule 관련 주석 수정
5. 변경된 디렉토리의 `.ai.md` 최신화

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 서브모듈 git index 제거 및 .gitmodules 삭제

서브모듈 5개(engine, services/siw/kwan/seung/lww)가 이미 비초기화(-) 상태였으므로 `git submodule deinit` 없이 `git rm --cached` + `git rm .gitmodules`만 실행. `.git/modules/`도 없어 추가 정리 불필요.

### AGENTS.md 수정

레포 구조 블록에서 submodule 참조 3종 제거:
- `(submodule: mirai-engine)` 삭제
- `(각각 submodule)` 삭제
- `→ mirai-siw`, `→ mirai-kwan` 등 원격 레포 참조 삭제

### docs/whitepaper/mirai_project_plan.md 수정

`mirai/ ← umbrella repo` → `mirai/ ← monorepo` (1개 참조)

### .claude/commands/cleanup-issue.md 수정

`(submodule 포함 워크트리 대응을 위해 --force 사용)` → `(워크트리 잠금 방지를 위해 --force 사용)` — 서브모듈이 없으므로 설명을 정확하게 교체.

### 01_plan.md 작성

실제 현황 조사(submodule status, 디렉토리 내용 확인) 후 구체적 구현 계획 수립.

### 모노레포 디렉토리 구조 복원

`bab8cfe` 커밋(서브모듈 전환 직전) 기준으로 `engine/`, `services/` 내용 복원.
`services/dong/` → `services/lww/`로 전환(dong은 서브모듈 전환 시 삭제됐던 플레이스홀더).
`services/lww/.ai.md` — 이왕원 멘토 담당으로 작성.

### engine/ 구조 재정비

`mirai_project_plan.md` 기준으로 `engine/app/` 계층 도입:
- `engine/parsers/`, `engine/services/`, `engine/prompts/` → `engine/app/` 하위로 이동
- `engine/app/routers/` 신규 생성
- `engine/tests/fixtures/` 신규 생성
- 각 디렉토리 `.ai.md` 작성 및 경로 참조 업데이트

