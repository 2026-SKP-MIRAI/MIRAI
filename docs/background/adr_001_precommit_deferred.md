# ADR 001 — pre-commit 불변식 훅 적용 보류

## 상태
보류 (2026-03-01)

## 컨텍스트
엔진 불변식(LLM 호출 위치, PDF 파싱 위치)을 기계적으로 강제하기 위해
pre-commit 훅을 설계·구현했다.

구현 완료된 파일:
- `.pre-commit-config.yaml` — 훅 설정
- `scripts/check_invariants.py` — 불변식 검증 스크립트

## 결정
**팀 셋업 안정화 이후로 적용을 미룬다.**

Week 2 이후 엔진 구현이 어느 정도 갖춰진 시점에 적용 검토.

## 적용 방법 (나중에 팀 전체에 안내)
```bash
pip install pre-commit
pre-commit install
```

## 근거
- Week 1은 MVP 기동이 목표 — 도구 셋업 오버헤드 최소화
- 불변식 위반이 실제로 발생하는 시점에 강제하는 게 더 효과적
