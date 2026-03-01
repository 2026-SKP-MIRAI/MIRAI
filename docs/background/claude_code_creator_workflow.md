# Claude Code 창시자(Boris Cherny)가 클로드를 사용하는 방법

> 출처: https://memoryhub.tistory.com/entry/Claude-Code-%EC%B0%BD%EC%8B%9C%EC%9E%90%EA%B0%80-%ED%81%B4%EB%A1%9C%EB%93%9C%EB%A5%BC-%EC%82%AC%EC%9A%A9%ED%95%98%EB%8A%94-%EB%B0%A9%EB%B2%95
> 원본 스레드: Boris Cherny, "Claude Code setup thread" — https://nitter.net/bcherny/status/2007179832300581177
> 정리 시점: 2026-01-초 공유 내용 / 문서 추가: 2026-03-01

---

## 개요

Claude Code 창시자 Boris Cherny가 2026년 1월 초 공유한 일상적 설정을 정리한 플레이북.
"정확한 설정을 모방하는 것이 아니라, **원칙을 빌려와 자신의 팀·저장소·제약 조건에 적용**"하는 것이 목표.

---

## 13가지 핵심 방법

### 1. 병렬 실행과 라벨 붙이기
5개 터미널 세션을 동시에 실행하고 각각에 번호를 매겨 처리량을 극대화.

### 2. 로컬과 웹 세션 혼합
터미널, 웹 UI(claude.ai/code), Chrome, 모바일 등 작업에 가장 적합한 인터페이스를 의도적으로 선택.

### 3. 단일 모델 고수
거의 모든 작업에 Opus (thinking 포함)를 사용해 재프롬프팅 횟수를 줄임.

### 4. CLAUDE.md를 살아있는 팀 메모리로 관리
git에 공유되는 CLAUDE.md에 반복되는 실수, 스타일 가이드, 명령어를 기록.

```
# Bash 명령어
- pnpm test --filter <name>: 집중 테스트 실행
- pnpm lint: 푸시 전 린트 실행

# 코드 스타일
- 중첩된 if보다 조기 반환 선호
- named export 사용
```

### 5. Plan 모드에서 코딩 시작
Shift+Tab 두 번으로 Plan 모드 진입 → 계획이 확실해질 때까지 다듬고 auto-accept 편집으로 전환.

### 6. 반복 프롬프트를 슬래시 명령어로 변환
매번 입력하는 프롬프트는 슬래시 명령어로 저장해 마찰을 줄임.

```yaml
---
description: 깔끔한 커밋을 준비하고 PR을 푸시
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git commit:*), Bash(git push:*)
---

# 컨텍스트
- 상태: !`git status -sb`
- Diff: !`git diff --stat`

# 작업
커밋 메시지를 작성하고, 커밋하고, 현재 브랜치를 푸시하세요.
```

### 7. 반복 역할을 서브에이전트로 승격
코드 단순화·검증 같은 반복 작업을 서브에이전트로 분리.

```yaml
---
name: verify-app
description: 앱을 실행하고, 주요 흐름을 확인하고, 문제를 보고합니다.
tools: Bash, Read
model: inherit
---

프로젝트의 표준 명령어를 사용하여 앱 변경 사항을 검증하세요.
정확한 에러 출력과 재현 단계와 함께 실패를 보고하세요.
```

### 8. PostToolUse 훅으로 결정론적 포맷팅
편집 후 자동 포맷팅이 실행되도록 훅 설정.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          { "type": "command", "command": "npm run format" }
        ]
      }
    ]
  }
}
```

### 9. 안전한 도구 미리 허용
YOLO 기본 설정 대신, `/permissions`와 `.claude/settings.json`으로 신뢰하는 도구 세트를 사전 허용.

### 10. MCP를 통한 시스템 연결
Claude를 Slack, BigQuery, Sentry 등과 연결해 워크플로우 허브로 전환.

### 11. 장시간 작업에 백그라운드 검증 추가
완료 후 검증 단계를 자동 실행하도록 설정 — 자리를 비울 때도 안전.

### 12. Claude에게 검증 루프 제공 (승수)
테스트·CLI·브라우저 동작을 통해 Claude가 자신의 작업을 직접 검증할 수 있게 하면 품질이 극적으로 향상.

**검증 사다리:**
1. 단일 명령어 (예: `pnpm test --filter ..`)
2. 작은 테스트 스위트
3. 브라우저에서의 UI 확인
4. 서브에이전트에 의한 "리뷰 패스"

### 13. 팀 스킬과 관례 공유
프로젝트 스킬은 git에, 개인 스킬은 홈 디렉토리에 보관해 명확히 분리.

---

## 스타터 킷 (80% 가치 제공)

1. CLAUDE.md (명령어, 스타일, 워크플로우 규칙)
2. 슬래시 명령어 1개
3. 서브에이전트 1개
4. 포맷팅 훅 1개

---

## 피해야 할 함정

| 함정 | 설명 |
|------|------|
| 너무 이른 과잉 자동화 | 필요 없는 것까지 자동화하면 오히려 복잡도 증가 |
| 검증 건너뛰기 | Claude가 자기 작업을 검증할 수 있어야 품질 보장 |
| 지저분한 병렬화 | 병렬 세션은 라벨링 없이 관리하면 혼란 |
| 부풀어 오른 메모리 파일 | CLAUDE.md가 너무 길어지면 에이전트가 핵심을 놓침 |

---

## MirAI 연결 포인트

| Boris 방법 | MirAI 적용 |
|-----------|-----------|
| CLAUDE.md = 살아있는 팀 메모리 | 이미 적용 — 작업 후 .ai.md 업데이트 규칙 |
| 슬래시 명령어로 반복 프롬프트 저장 | exec-plans/ 구조로 동일 목적 달성 |
| 서브에이전트 승격 | 하네스 엔지니어링 — 에이전트 정의 설계 |
| PostToolUse 훅 | pre-commit + CI 불변식 검증 |
| 검증 루프 제공 | pytest + CI + 로컬 API 확인 |
