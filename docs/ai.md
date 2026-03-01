# docs/

## 목적
프로젝트 문서 저장소. 레포의 SOT(Source of Truth).
카톡·노션에서 논의한 결정사항이 레포로 이동하는 유일한 진입점.
여기 없으면 에이전트에겐 없는 것이다.

## 구조
```
docs/
├── whitepaper/       프로젝트 전략·운영 계획 문서
├── background/       배경 자료·외부 분석·연구 문서
├── specs/            기능 상세 명세 (AC 포함)
├── meetings/         회의록 (날짜별)
├── decisions/        아키텍처·팀 의사결정 기록 (ADR)
├── retrospectives/   주간 회고 기록
├── exec-plans/       실행 계획 (active/completed)
└── onboarding/       환경 설정·기여 가이드
```

## 역할
- 에이전트가 작업 전 컨텍스트를 확인하는 곳
- 작업 완료 후 관련 문서를 여기에 반영
- 결정 사항은 decisions/, 기능 명세는 specs/에 기록
