# chore: 3월 2주차 전체 CHANGELOG 업데이트

## 목적
3월 2주차(2026-03-09 ~ 2026-03-15) 작업 내용을 전체 서비스 CHANGELOG에 반영한다.

## 배경
3월 2주차 동안 engine, lww, kwan, seung, siw 및 root에 다수의 변경이 있었으므로 주차별 체인지로그를 최신화한다.

## 완료 기준
- [x] `CHANGELOG.md` (root) 업데이트 — since:2026-03-09
- [x] `engine/CHANGELOG.md` 업데이트 — since:2026-03-09
- [x] `services/lww/CHANGELOG.md` 업데이트 — since:2026-03-09
- [x] `services/kwan/CHANGELOG.md` 업데이트 — since:2026-03-09
- [x] `services/seung/CHANGELOG.md` 업데이트 — since:2026-03-09
- [x] `services/siw/CHANGELOG.md` 업데이트 — since:2026-03-09

## 구현 플랜
`/update-changelog since:2026-03-09` 실행으로 전체 scope 일괄 처리

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-15

**현황**: 6/6 완료

**완료된 항목**:
- CHANGELOG.md (root) 업데이트 — since:2026-03-09
- engine/CHANGELOG.md 업데이트 — since:2026-03-09
- services/lww/CHANGELOG.md 업데이트 — since:2026-03-09
- services/kwan/CHANGELOG.md 업데이트 — since:2026-03-09
- services/seung/CHANGELOG.md 업데이트 — since:2026-03-09
- services/siw/CHANGELOG.md 업데이트 — since:2026-03-09

**미완료 항목**:
- (없음)

**변경 파일**: 6개 (CHANGELOG.md, engine/CHANGELOG.md, services/{lww,kwan,seung,siw}/CHANGELOG.md)

---

## 구현 상세

### 변경 내용

`git log --since="2026-03-09"` 로 각 scope 경로 필터링 후 커밋을 분류·병합했다.

**CHANGELOG.md (root)**
- 기존 `2026년 3월 9일 주차` 섹션에 병합. 헤더를 `Mar 9~15`로 수정.
- ✨ 새 기능: 면접 기능 전체 완성 (kwan/seung/siw 패널 면접·리포트·내비게이션)
- 🔧 개선: 워크플로우 커맨드 업데이트 (#99), skills 패키지 정리
- 🛡️ 인프라: EC2·ALB·Docker 컨테이너화 완료 (#64, #66, #67)
- 📚 문서: 3/11 회의록, 기능05 명세 업데이트

**engine/CHANGELOG.md**
- ✨ 새 기능: 8축 리포트 엔진 (#54, #70), 연습 모드 피드백 엔진 (#78, #83)
- 🔧 개선: max_tokens 1024→2048 상향 (#59, #75)
- 🛡️ 인프라: Docker 컨테이너화 (#66), EC2/ALB 배포 대응 (#64)

**services/lww/CHANGELOG.md**
- 🛡️ 인프라: Docker 컨테이너화 (#67), EC2/ALB 배포 대응 (#64)

**services/kwan/CHANGELOG.md**
- ✨ 새 기능: MVP 01 자소서→질문 생성 (#37, #56), 패널 면접 연동 (#58, #76)

**services/seung/CHANGELOG.md**
- ✨ 새 기능: MVP 01 자소서→질문 생성 (#38, #47), Phase 1 패널 면접+꼬리질문 (#57, #60)

**services/siw/CHANGELOG.md**
- ✨ 새 기능: Phase 1 패널 면접 (#46, #61), 8축 리포트 페이지 (#82, #84), 내비게이션 재설계 (#87, #93)
- 🔧 개선: glassmorphism 디자인 시스템 (#63, #77)
- 🐛 버그 수정: interview 신뢰성 개선 (#85, #91)

