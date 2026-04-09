# MirAI Agents

Claude Code 네이티브 서브에이전트 카탈로그.
`.md` 파일 하나 = 에이전트 하나. Claude가 `description`을 읽고 호출 시점을 자동 판단한다.

---

## 에이전트 목록 (7개)

### 계획 & 리뷰

| 에이전트 | 역할 | 모델 | 호출 시점 |
|----------|------|------|----------|
| `plan-reviewer` | 구현 계획 검토 — 리스크, 누락 AC, 의존성 지적 | opus | 구현 착수 전 |
| `code-architecture-reviewer` | 코드 품질·아키텍처 일관성 리뷰 | sonnet | 기능 구현 완료 후 |

### 문서화

| 에이전트 | 역할 | 모델 | 호출 시점 |
|----------|------|------|----------|
| `documentation-architect` | `.ai.md` 작성/갱신, README, API 문서 생성 | inherit | 디렉토리 변경 후, 기능 완료 후 |

### 리팩토링

| 에이전트 | 역할 | 모델 | 호출 시점 |
|----------|------|------|----------|
| `refactor-planner` | 리팩토링 분석 + 계획서 작성 (실행 없음) | default | 리팩토링 전 |
| `code-refactor-master` | 리팩토링 실행 + 검증 (`refactor-planner` 승인 후) | opus | 계획 승인 후 |

### 디버깅 & 리서치

| 에이전트 | 역할 | 모델 | 호출 시점 |
|----------|------|------|----------|
| `frontend-error-fixer` | Next.js/React 빌드·런타임 에러 디버깅 | default | 프론트엔드 에러 발생 시 |
| `web-research-specialist` | GitHub Issues, Stack Overflow 등 외부 리서치 | sonnet | 라이브러리 오류·패턴 조사 시 |

---

## 사용 방법

Claude에게 자연어로 요청하면 된다:

```
"구현 계획 리뷰해줘"           → plan-reviewer 자동 호출
"코드 리뷰해줘"                → code-architecture-reviewer 자동 호출
".ai.md 업데이트해줘"          → documentation-architect 자동 호출
"리팩토링 계획 짜줘"           → refactor-planner 자동 호출
"리팩토링 실행해줘"            → code-refactor-master 자동 호출
"프론트 에러 고쳐줘"           → frontend-error-fixer 자동 호출
"이 에러 검색해줘"             → web-research-specialist 자동 호출
```

---

## 전형적인 워크플로

```
이슈 착수
  └→ plan-reviewer       (계획 검토)
      └→ [구현]
          └→ code-architecture-reviewer  (코드 리뷰)
              └→ documentation-architect (`.ai.md` 갱신)
                  └→ finish-issue
```

리팩토링 플로:
```
refactor-planner → [승인] → code-refactor-master
```
