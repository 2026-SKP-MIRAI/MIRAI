# pre-commit 훅 적용 계획

## 목표
엔진 불변식(LLM 호출 경계, PDF 파싱 경계)을 커밋 시점에 자동으로 검증한다.

## 배경
- ADR: `docs/decisions/adr_001_precommit_deferred.md`
- 현재 상태: 보류 (팀 Python 환경 미정, 개발 시작 전)
- 구현 파일: `.pre-commit-config.yaml`, `scripts/check_invariants.py` (이미 작성됨)

## 단계별 작업
1. 팀 Python 환경 확정 (Python 버전, 가상환경 방식)
2. `pre-commit install` 실행 가이드 온보딩에 추가
3. CI에 `pre-commit run --all-files` 추가
4. 팀 전체 로컬에서 훅 동작 확인

## 완료 기준
- [ ] 팀원 전원 로컬에서 `pre-commit install` 완료
- [ ] 불변식 위반 코드 커밋 시 자동 차단 확인
- [ ] CI에서도 동일하게 차단 확인

## 우선순위
Week 2 이후 (엔진 개발 시작 전)
