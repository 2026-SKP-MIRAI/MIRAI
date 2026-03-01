# docs/exec-plans/

## 목적
실행 계획 문서. Claude Code에게 "이 기능 구현해줘" 대신 계획 파일을 읽고 실행하게 한다.

## 구조
```
exec-plans/
├── active/     현재 진행 중인 실행 계획
└── completed/  완료된 실행 계획 (히스토리)
```

## 파일 형식 (active/feature_NAME.md)
```
# [기능명] 실행 계획

## 목표
## AC (인수 조건)
## 작업 순서
## 완료 기준
```

## 역할
- 에이전트가 실행 계획을 읽고 순서대로 작업
- 완료 후 active/ → completed/ 로 이동
- docs/specs/ 의 AC와 연결
