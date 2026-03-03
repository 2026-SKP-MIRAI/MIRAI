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
