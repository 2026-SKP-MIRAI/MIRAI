# chore: 엄브렐라 레포 → 모노레포 롤백

## 목적
서브모듈 기반 엄브렐라 레포 구조를 단순 모노레포로 롤백한다. PR 워크플로우 복잡성(서브모듈 레포별 별도 PR·푸시 필요) 때문에 모노레포가 현 팀 규모에 더 적합하다고 판단.

## 배경
Issue #17에서 엄브렐라 레포로 전환했으나, 실제 운영 시 PR 워크플로우가 복잡해지는 문제가 명확해짐. 서브모듈 레포를 먼저 푸시하고 부모 레포 포인터를 업데이트해야 하는 구조는 현 팀 규모·속도에 맞지 않음. 단순 디렉토리 기반 모노레포로 운영하는 것이 YAGNI 원칙에 부합.

## 완료 기준
- [ ] `docs/whitepaper/mirai_project_plan.md`의 `umbrella repo` 표현이 `monorepo`로 교체됨
- [ ] `AGENTS.md`에서 submodule 참조(`(submodule: mirai-engine)`, `(각각 submodule)`, `→ mirai-xxx`) 제거되고 순수 디렉토리 구조로 기술됨
- [ ] `.gitmodules` 파일 삭제 및 `git submodule deinit` 완료
- [ ] `.claude/commands/cleanup-issue.md`의 "submodule 포함 워크트리 대응" 주석 업데이트

## 구현 플랜
1. `git submodule deinit --all` + `.gitmodules` 삭제 + `git rm` 으로 서브모듈 연결 해제
2. `AGENTS.md` 디렉토리 구조에서 submodule 참조 제거
3. `mirai_project_plan.md:27` `umbrella repo` → `monorepo` 교체
4. `.claude/commands/cleanup-issue.md:74` submodule 관련 주석 수정
5. 변경된 디렉토리의 `.ai.md` 최신화

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

