---
description: 현재 이슈의 구현 계획을 작성한다. OMC가 있으면 ralplan을 호출하고, 없으면 Claude가 직접 01_plan.md에 플랜을 작성한다. 사용법: /plan [이슈번호]
---

## 인수 형식 (선택사항)

`$ARGUMENTS`는 다음 형식 중 하나거나 생략 가능하다:

| 형식 | 예시 | 동작 |
|------|------|------|
| 생략 | (없음) | 현재 브랜치에서 자동 감지 |
| 이슈번호만 | `15` | 이슈번호로 WORKFOLDER 탐색 |

## 실행 순서

### 1. 이슈번호·WORKFOLDER 확정

**인수 없는 경우:**
```
git branch --show-current
```
결과 예: `feat/000015-pdf-upload` → PADDED=`000015`, 짧은이름=`pdf-upload`, 이슈번호=`15`

**이슈번호가 있는 경우:**
```
git branch | grep {zero-padded 번호}
```
매칭된 브랜치명에서 PADDED·짧은이름 추출.

- PADDED = 이슈번호 6자리 zero-pad
- WORKFOLDER = `docs/work/active/{PADDED}-{짧은이름}`

### 2. AC 추출

`{WORKFOLDER}/00_issue.md`가 존재하면 읽어서 `## 완료 기준` 또는 `## AC` 섹션의 항목을 추출한다.

파일이 없으면:
```
gh issue view {이슈번호} --json body --jq '.body'
```
로 이슈 body에서 AC 섹션을 추출한다.

AC가 없으면 빈 체크리스트로 계속 진행한다.

### 3. OMC 감지 및 플랜 작성

`/oh-my-claudecode:ralplan` 호출을 시도한다.

- **OMC가 있는 경우**: ralplan 스킬이 대화형으로 플랜 작성을 처리한다. 이 커맨드의 역할은 여기서 끝난다.
- **OMC가 없는 경우 (ralplan 응답 없음 또는 커맨드 미인식)**: Claude가 직접 아래 4단계를 수행한다.

### 4. 직접 플랜 작성 (OMC 없는 경우)

추출한 AC와 이슈 내용을 바탕으로 구현 계획을 작성한다.

계획 작성 기준:
- 각 AC를 충족하는 구체적인 구현 단계 기술
- 변경할 파일·디렉토리 명시
- 의존성이 있는 단계는 순서 명시
- 예상되는 엣지 케이스·주의사항 포함

### 5. `01_plan.md` 저장

`{WORKFOLDER}/01_plan.md`의 `## 구현 계획` 섹션 아래에 작성된 플랜을 기입한다.

파일이 없으면 다음 형식으로 생성한다:
```markdown
# [#{이슈번호}] {제목} — 구현 계획

> 작성: {오늘 날짜}

---

## 완료 기준

{추출한 AC 체크리스트}

---

## 구현 계획

{작성된 플랜}
```

저장 후:
```
✓ 플랜 저장 완료: {WORKFOLDER}/01_plan.md
```
