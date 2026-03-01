# GitHub Actions & 프로젝트 보드 자동화

> MirAI 레포지토리의 GitHub Actions 구성과 Projects 보드 자동화 동작 방식을 설명한다.

---

## GitHub Actions란

GitHub Actions는 레포지토리 안에 정의한 YAML 파일을 기반으로, **GitHub 이벤트에 반응해 자동으로 실행되는 워크플로우**다.

```
레포지토리 이벤트 발생
  (이슈 생성, PR 오픈 등)
        ↓
.github/workflows/*.yml 파일 감지
        ↓
GitHub 서버(ubuntu-latest)에서 스크립트 실행
        ↓
결과 (Projects 보드 이동, 알림 등)
```

**핵심:**
- 설정 파일은 `.github/workflows/` 디렉토리에 YAML로 저장
- 멘티·멘토 누구도 별도 설치/실행 불필요 — 레포에 push되는 순간 활성화
- 실행 로그는 GitHub → Actions 탭에서 누구나 확인 가능

---

## MirAI 자동화 구성

파일: `.github/workflows/project-automation.yml`

### 트리거 이벤트

| 이벤트 | 조건 | 동작 |
|--------|------|------|
| `issues: opened` | 이슈 새로 생성 | Projects 보드에 추가 → **Backlog** |
| `issues: assigned` | 이슈에 담당자 배정 | → **In Progress** |
| `pull_request: opened` | PR 새로 오픈 | 연결된 이슈 → **In Review** |
| `pull_request: ready_for_review` | Draft PR → Ready 전환 | 연결된 이슈 → **In Review** |

### PR과 이슈 연결 방법

PR 본문에 다음 중 하나를 포함하면 자동화가 이슈를 감지한다:

```
Closes #15
Fixes #15
Resolves #15
```

이 한 줄이 없으면 자동화가 이슈를 찾지 못한다.

### Done 자동 이동

PR 머지 시 이슈 자동 Close + Projects 보드 Done 이동은 **GitHub 기본 기능**으로 처리된다 (Actions 불필요).

---

## 전체 보드 자동화 흐름

```
이슈 생성
    ↓ (자동)
  Backlog
    ↓ (멘토가 수동 이동)
  Ready          ← "지금 착수해도 됨" 신호
    ↓ (이슈 Assign 시 자동)
 In Progress
    ↓ (PR 오픈 시 자동)
 In Review
    ↓ (PR 머지 시 자동)
   Done
```

수동 이동이 필요한 구간은 **Backlog → Ready** 하나뿐이다.
나머지는 전부 자동.

---

## 인증 구조

자동화가 Projects API를 호출하려면 Personal Access Token이 필요하다.

```
PROJECT_TOKEN (Repository Secret)
    └── GitHub Actions에서만 참조
    └── 멘티·멘토 누구도 값을 볼 수 없음
    └── Actions 실행 시 GH_TOKEN 환경변수로 주입
```

- 토큰 관리: 레포 Settings → Secrets and variables → Actions
- 멘티가 별도로 토큰을 만들거나 설정할 필요 없음
- 멘티는 `gh auth login` 한 번만 하면 개인 GitHub 작업 전부 가능

---

## 실행 로그 확인

자동화가 의도대로 동작했는지 확인하려면:

```
GitHub 레포 → Actions 탭 → Project Board Automation
```

각 실행에서 어떤 이슈가 어떤 컬럼으로 이동됐는지 로그로 볼 수 있다.

---

## 참고

- [GitHub Actions 공식 문서](https://docs.github.com/en/actions)
- [GitHub Projects GraphQL API](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project)
- 자동화 파일: `.github/workflows/project-automation.yml`
- 보드 URL: https://github.com/orgs/2026-SKP-MIRAI/projects/2
