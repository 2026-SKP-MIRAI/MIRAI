# 000017 — 엄브렐라 레포 전환 플랜

## 요약
모노레포(MIRAI)의 engine/, services/ 를 개별 GitHub 레포로 분리하고, 메인 레포를 submodule 기반 umbrella repo로 전환한다.
Option B 채택: 코드가 거의 없으므로 빈 레포를 새로 생성한다 (subtree split 불필요).

## Phase 1: GitHub에 빈 레포 5개 생성
- `2026-SKP-MIRAI/mirai-engine`
- `2026-SKP-MIRAI/mirai-siw`
- `2026-SKP-MIRAI/mirai-kwan`
- `2026-SKP-MIRAI/mirai-seung`
- `2026-SKP-MIRAI/mirai-lww`

각 레포: public, README 자동 생성으로 초기화

## Phase 2: 메인 레포에서 기존 폴더 삭제
- `engine/` 전체 삭제
- `services/` 전체 삭제 (dong 포함)

## Phase 3: submodule 연결 (기존 경로 유지)
```bash
git submodule add https://github.com/2026-SKP-MIRAI/mirai-engine engine
git submodule add https://github.com/2026-SKP-MIRAI/mirai-siw services/siw
git submodule add https://github.com/2026-SKP-MIRAI/mirai-kwan services/kwan
git submodule add https://github.com/2026-SKP-MIRAI/mirai-seung services/seung
git submodule add https://github.com/2026-SKP-MIRAI/mirai-lww services/lww
```

## Phase 4: 문서 업데이트
- `mirai_project_plan.md`: dong → lww 변경
- `AGENTS.md`: 레포 구조를 submodule 기반으로 업데이트
- 이슈 #17 AC 3번(히스토리 보존): Option B 선택으로 해당 없음 메모

## Phase 5: 검증
- `git submodule update --init --recursive` 정상 동작
- 각 submodule 디렉토리 접근 확인
