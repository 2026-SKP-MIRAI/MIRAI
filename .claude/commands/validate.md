# /validate

`validate-all` 에이전트를 실행해서 아키텍처·백엔드·서비스 검증 3개를 동시에 돌린다.

인수 (선택):
- 태스크명: `docs/work/active/[태스크명]/` 에 결과 저장
- 예: `/validate 000045-면접-세션-구현`

인수가 없으면 `git diff --name-only HEAD` 로 변경 파일을 파악해서 실행한다.

**실행:** validate-all 에이전트를 호출해서 architecture-validator, backend-validator, service-validator 3개를 병렬로 실행하고 결과를 종합 보고한다.
