# engine/prompts/

## 목적
프롬프트 관리 및 버전 관리. 프롬프트 변경 이력을 추적 가능하게 보존.

## 구조
```
prompts/
└── (기능별 프롬프트 파일 — Week 2 v1 산출물)
    예: question_generation_v1.md
        followup_question_v1.md
        persona_hr_v1.md
```

## 역할
- 프롬프트를 코드처럼 버전 관리
- 파일명에 버전 포함: _v1, _v2 등
- llm_service가 여기서 프롬프트를 로드
- 프롬프트 변경 시 반드시 기존 버전 파일 보존 + 새 버전 추가

## 작업 전 확인
- 기존 프롬프트 버전 확인 후 새 버전 번호 결정
- 변경 이유를 파일 상단 주석에 기록
