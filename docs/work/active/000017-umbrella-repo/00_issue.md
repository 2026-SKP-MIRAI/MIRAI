# chore: 엄브렐라 레포 전환 — engine, services 하위 폴더를 개별 레포지토리로 분리

## 목적
현재 단일 레포(MIRAI)에 있는 engine/, services/ 하위 폴더들을 각각 독립 레포지토리로 분리하고, 메인 레포를 엄브렐라(umbrella) 레포로 전환한다.

## 배경
mirai_project_plan.md에 이미 "umbrella repo"로 명시되어 있으나, 실제로는 모노레포 구조로 운영 중이다. 각 멘티가 1인 1서비스를 end-to-end로 만드는 구조이므로 레포 분리가 자연스럽다. 추가로, 유동선 멘티가 서비스 작업에서 빠지고 멘토(lww)가 서비스를 하나 만든다.

## 장점
- **독립 배포**: 각 서비스를 개별적으로 빌드·배포 가능
- **권한 분리**: 멘티가 자기 레포에서 자유롭게 작업, 다른 서비스에 영향 없음
- **CI/CD 분리**: 서비스별 독립 파이프라인 구성 가능
- **깔끔한 히스토리**: 각 레포의 git log가 해당 컴포넌트 변경만 포함
- **의존성 명확화**: engine ↔ service 경계가 레포 수준에서 강제됨

## 단점
- **submodule 복잡도**: git submodule update, sync 등 추가 학습·관리 비용
- **초기 세팅 비용**: 레포 생성, CI 재구성, 문서 업데이트 등 인프라 작업 필요
- **engine 변경 전파**: engine 변경 시 각 서비스 레포에서 submodule 업데이트 필요
- **온보딩 부담**: 멘티가 git submodule 워크플로우를 추가로 익혀야 함
- **남은 기간 대비 비용**: 프로젝트 잔여 기간(~3주) 중 인프라 작업에 시간 소요

## 완료 기준
- [x] engine/, services/{siw, kwan, seung, lww} 각각이 독립 GitHub 레포지토리로 존재
- [x] 메인 MIRAI 레포가 submodule(또는 선택한 방식)로 각 레포를 참조
- [ ] ~~기존 커밋 히스토리가 각 분리된 레포에 보존됨~~ (Option B: 빈 레포 생성, 코드 거의 없어 불필요)
- [x] `mirai_project_plan.md` 서비스 목록에서 dong → lww 로 변경 반영

## 구현 플랜
1. GitHub에 개별 레포지토리 생성 (mirai-engine, mirai-siw, mirai-kwan, mirai-seung, mirai-lww)
2. `git subtree split`으로 각 폴더의 히스토리를 분리하여 개별 레포에 push
3. 메인 MIRAI 레포에서 해당 폴더를 git submodule로 교체
4. `mirai_project_plan.md` 서비스 목록 업데이트 (dong → lww)
5. AGENTS.md, CLAUDE.md, .ai.md 등 문서 업데이트
6. CI/CD 및 .gitignore 등 설정 조정

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### Option B 채택: 빈 레포 생성 방식
engine/, services/ 에 실제 코드가 거의 없는 상태(각 8~48KB, .ai.md 수준)이므로 `git subtree split` 대신 빈 레포를 새로 생성하는 방식을 선택했다.

### 변경 사항

1. **GitHub 레포 5개 생성**
   - `2026-SKP-MIRAI/mirai-engine`, `mirai-siw`, `mirai-kwan`, `mirai-seung`, `mirai-lww`
   - 각 레포에 README.md 초기 커밋 후 push

2. **기존 폴더 삭제 + submodule 연결**
   - `engine/`, `services/` 전체 삭제 (dong 포함)
   - 5개 레포를 기존 경로에 submodule로 연결 (`engine/`, `services/siw/` 등)
   - `.gitmodules` 자동 생성

3. **문서 업데이트**
   - `docs/whitepaper/mirai_project_plan.md`: dong(유동선) → lww(이왕원) 변경
   - `AGENTS.md`: 레포 구조를 submodule 기반으로 업데이트, dong → lww 변경

