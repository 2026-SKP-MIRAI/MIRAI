# MirAI 워크플로우 가이드

> 처음 기여하는 팀원을 위한 가이드. 5분이면 충분하다.

## 한 줄 요약

```
이슈 확인 → 브랜치 생성 → 구현 (테스트 먼저) → PR → 멘토 리뷰 → 머지
```

---

## 1단계: 내 이슈 확인

```bash
gh issue list --assignee @me
```

또는 GitHub Projects 보드에서 **In Progress** 컬럼 확인.

> **보드 컬럼:** Backlog → In Progress → In Review → Done / Drop

이슈가 없으면 멘토에게 요청하거나, 본인이 이슈를 만들어 멘토에게 Assign 요청.

---

## 2단계: 브랜치 생성

```bash
git checkout -b feat/15-pdf-upload    # 기능 구현
git checkout -b fix/23-parser-error   # 버그 수정
git checkout -b docs/31-interface-doc # 문서 작업
```

규칙: `타입/이슈번호-짧은설명`

---

## 3단계: 구현 (테스트 먼저)

```
이슈의 AC(인수 조건)를 먼저 읽는다
  ↓
AC를 테스트 코드로 작성 (Red)
  ↓
테스트 통과하는 코드 작성 (Green)
  ↓
리팩터링 (Refactor)
  ↓
해당 디렉토리 .ai.md 업데이트
```

**AC = 첫 번째 테스트.** 이슈에 AC가 없으면 멘토에게 먼저 물어본다.

---

## 4단계: PR 생성

```bash
git add .
git commit -m "feat: PDF 업로드 엔드포인트 구현 (#15)"
git push origin feat/15-pdf-upload
gh pr create --title "feat: PDF 업로드 엔드포인트 구현 (#15)"
```

PR 본문에 반드시 포함:
```
Closes #15
```
이 한 줄이 있어야 머지 시 이슈가 자동으로 닫힌다.

---

## 5단계: 리뷰 기다리기

- Reviewer로 멘토가 자동 지정됨
- 멘토가 코멘트 남기면 수정 후 다시 push
- 추가 커밋은 같은 브랜치에 push하면 PR에 자동 반영

---

## 6단계: 머지

멘토 승인 후 멘토가 Squash merge.
머지되면 브랜치 자동 삭제, 이슈 자동 Close, Projects 보드 Done 이동.

---

## 커밋 메시지 규칙

```
feat: 새 기능
fix: 버그 수정
docs: 문서만 변경
refactor: 동작 변경 없는 코드 개선
test: 테스트만 변경
```

예시: `feat: 자소서 PDF 파싱 구현 (#12)`

---

## 이슈 작성법 (본인이 만들 때)

**AC가 없는 이슈는 시작할 수 없다.**

```markdown
## 목표
PDF 업로드 엔드포인트 구현

## AC (완료 기준)
- [ ] POST /api/upload → 200 반환
- [ ] 10MB 초과 → 400 + 에러 메시지
- [ ] engine/parsers/ 통해서만 파싱
- [ ] 테스트 통과
```

AC는 "언제 이 이슈가 완료됐다고 볼 것인가"를 체크리스트로 만든 것.
클로드 코드에게 이 이슈를 시키면 AC가 첫 번째 테스트가 된다.

---

## 이슈 Drop (안 하기로 결정)

이슈를 구현하지 않기로 판단되면:
1. 이슈에 이유를 코멘트로 남긴다
2. Projects 보드에서 **Drop** 컬럼으로 이동
3. 이슈는 Close (not planned)

> Drop ≠ 실패. "이 시점에 이 이슈는 우선순위 밖"이라는 명시적 결정이다.

---

## 막혔을 때

1. 이슈에 코멘트로 질문 남기기 (멘토가 비동기로 확인)
2. PR을 Draft로 열고 `[WIP]` 표시
3. 진행 불가 시 이슈에 `blocked` 라벨 추가
