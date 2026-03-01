# docs/decisions/

## 목적
아키텍처·팀 프로세스 의사결정 기록 (ADR, Architecture Decision Records).
"왜 이렇게 결정했는가"의 rationale 보존.

## 구조
```
decisions/
├── team_process_analysis.md   팀 프로세스 설계 분석
└── (추가 ADR 파일들)
    예: adr_001_engine_layer_separation.md
        adr_002_ddd_service_tdd_engine.md
```

## 역할
- 과거 의사결정의 근거를 보존하여 나중에 같은 논의 반복 방지
- 에이전트가 아키텍처 변경 시 먼저 확인해야 하는 곳
- ADR 형식 권장: 제목 / 상태 / 컨텍스트 / 결정 / 결과
