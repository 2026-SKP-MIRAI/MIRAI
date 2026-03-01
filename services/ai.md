# services/

## 목적
1인 1서비스. 각자가 프론트·백엔드·배포를 포함한 완성형 서비스를 end-to-end로 구축.
DDD (Domain-Driven Design) + TDD 적용.

## 구조
```
services/
├── siw/    성시우 서비스
├── kwan/   김관우 서비스
├── dong/   유동선 서비스
└── seung/  이승현 서비스
```

## 역할
- 엔진(engine/)만 호출 — LLM·파서 직접 접근 금지
- 각자의 서비스 내부 구조는 자율 (DDD 기반 권장)
- Week 1: 자소서 업로드 → 질문 생성 MVP end-to-end
- Week 2~3: 기획서 기능 2~4 추가
- Week 4: 각자 특색 기능 커스텀 + 배포

## 공통 기준
- 서비스마다 Issue 1개 이상 + AC 포함
- 테스트 없는 PR 머지 금지
