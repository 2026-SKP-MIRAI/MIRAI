# [CHORE] 시크릿 필터 보안 훅 도입

## 목적
Claude Code 사용 시 API 키·토큰·패스워드 등 민감 정보가 출력에 노출되는 것을 방지하는 보안 훅 도입

## 배경
[claude-forge](https://github.com/sangrokjung/claude-forge)의 6계층 보안 훅 중 시크릿 필터(`output-secret-filter.sh`)를 참고하여, MIRAI 환경에 맞는 최소한의 보안 레이어를 추가한다.

## 완료 기준
- [ ] PostToolUse 훅으로 시크릿 필터 구현 (API 키, 토큰, 패스워드 등 출력 시 마스킹/경고)
- [ ] claude-forge의 `output-secret-filter.sh` 참고하되 MIRAI 환경에 맞게 커스터마이징
- [ ] `.claude/settings.json`에 훅 등록 완료

## 구현 플랜
claude-forge의 `output-secret-filter.sh` 구조를 분석한 뒤, MIRAI의 `.claude/hooks/` 디렉토리에 PostToolUse 훅으로 시크릿 패턴 감지 스크립트를 추가한다.

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

