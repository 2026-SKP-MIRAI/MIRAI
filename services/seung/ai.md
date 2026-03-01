# services/seung/ — 이승현

## 목적
이승현의 개인 서비스. 자소서 기반 모의면접 시스템을 end-to-end로 구현.
DDD (Domain-Driven Design) + TDD 적용.

## 구조
```
seung/
└── (자율 설계 — DDD 기반 권장)
    예: domain/      도메인 모델 (면접, 질문, 피드백 등)
        api/         백엔드 API
        frontend/    프론트엔드
        tests/       테스트
```

## 역할
- 기능 흐름: 자소서 업로드 → 질문 생성 → 면접 시뮬레이션 → 역량 평가
- engine/ 만 호출 — LLM·파서 직접 구현 금지
- Week 1: MVP (자소서 → 질문 생성) end-to-end 작동
- Week 2~3: 기획서 기능 2~4 (꼬리질문, 페르소나, 역량 평가) 추가
- Week 4: 특색 기능 1개 이상 + 배포 URL 제출

## 작업 전 확인
- `engine/docs/INTERFACE.md` — 엔진 API 계약 확인
- `docs/specs/` — 기능 AC 확인
- 이 파일 (ai.md) — 현재 구조·진행 상태 확인
