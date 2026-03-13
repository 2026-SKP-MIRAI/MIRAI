# fix: docs/work/active 미삭제 수정 — 000063 완료 문서 정리

## 목적
PR #77 머지 시 `docs/work/active/000063-siw-pretendard-glassmorphism/` 가 삭제되지 않고 main에 포함되었다. 완료된 작업의 문서는 `docs/work/done/`에만 있어야 하므로 `active` 디렉토리를 삭제한다.

## 배경
작업 완료 후 `docs/work/active/` → `docs/work/done/`으로 이동하는 것이 레포 규칙이다. PR #77 머지 시 `active` 삭제가 누락되어 두 곳에 동일 문서가 존재하는 상태가 되었다.

## 완료 기준
- [x] `docs/work/active/000063-siw-pretendard-glassmorphism/` 디렉토리 삭제
- [x] `docs/work/done/000063-siw-pretendard-glassmorphism/` 문서는 그대로 유지

## 구현 플랜
1. main 브랜치에서 `docs/work/active/000063-siw-pretendard-glassmorphism/` 삭제
2. `fix:` 커밋 후 push

## 개발 체크리스트
- [ ] `docs/work/done/` 문서 보존 확인

---

## 작업 내역

### 변경 내용

PR #77 머지 시 `docs/work/active/000063-siw-pretendard-glassmorphism/` 삭제가 누락되어 `active/`와 `done/` 양쪽에 동일 문서가 존재하는 상태였다.

**삭제한 파일 (3개):**
- `docs/work/active/000063-siw-pretendard-glassmorphism/00_issue.md`
- `docs/work/active/000063-siw-pretendard-glassmorphism/01_plan.md`
- `docs/work/active/000063-siw-pretendard-glassmorphism/02_test.md`

`docs/work/done/000063-siw-pretendard-glassmorphism/` 는 그대로 유지되어 있음을 확인했다.
