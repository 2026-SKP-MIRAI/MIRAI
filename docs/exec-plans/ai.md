# docs/exec-plans/

## 목적
실행 계획 문서. Claude Code에게 "이 기능 구현해줘" 대신 계획 파일을 읽고 실행하게 한다.

## 구조
```
exec-plans/
├── backlog/    아직 시작하지 않은 계획 (우선순위 대기)
├── active/     현재 진행 중인 실행 계획
└── completed/  완료된 실행 계획 (히스토리)
```

## 파일 네이밍 규칙
```
active/[task-name]-plan.md      전략·단계·리스크
active/[task-name]-context.md   관련 파일·결정사항·참고
active/[task-name]-tasks.md     체크리스트·AC

예: active/feature-02-followup-plan.md
    active/feature-02-followup-context.md
    active/feature-02-followup-tasks.md
```

## 파일 내용 형식

**[task-name]-plan.md**
```
# [기능명] 실행 계획
## 목표
## 단계별 작업
## 리스크
## 완료 기준
```

**[task-name]-tasks.md**
```
# [기능명] 태스크
## AC (인수 조건)
- [ ] Given / When / Then
## 체크리스트
- [ ] 테스트 먼저 작성
- [ ] 구현
- [ ] ai.md 최신화
```

## 역할
- 에이전트가 plan → context → tasks 순서로 읽고 실행
- 완료 후 active/ → completed/ 로 이동
- docs/specs/ 의 AC와 연결
