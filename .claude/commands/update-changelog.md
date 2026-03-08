---
description: 경로별 CHANGELOG.md를 최신 git 로그 기준으로 업데이트한다. 사용법: /update-changelog [root|engine|lww|kwan|seung|siw] [since:<날짜|태그>]
---

당신은 MirAI 팀의 `/update-changelog` 커맨드를 실행하고 있습니다.

## 인수 파싱

`$ARGUMENTS`에서 다음을 추출한다:
- **scope** (선택): `root` | `engine` | `lww` | `kwan` | `seung` | `siw`
  - 생략 시 모든 scope를 순서대로 처리한다
- **since** (선택): `since:2026-03-01` 또는 `since:v0.1.0` 형식
  - 생략 시 각 CHANGELOG.md의 가장 최근 주차 날짜 이후 커밋을 자동 감지한다

## Scope → 경로 매핑

| scope  | git log 경로 필터                            | CHANGELOG 경로                   |
|--------|----------------------------------------------|----------------------------------|
| root   | `. -- ':!engine' ':!services'` (인프라·문서·워크플로우) | `CHANGELOG.md`                  |
| engine | `engine/`                                    | `engine/CHANGELOG.md`            |
| lww    | `services/lww/`                              | `services/lww/CHANGELOG.md`      |
| kwan   | `services/kwan/`                             | `services/kwan/CHANGELOG.md`     |
| seung  | `services/seung/`                            | `services/seung/CHANGELOG.md`    |
| siw    | `services/siw/`                              | `services/siw/CHANGELOG.md`      |

## 실행 단계

### Step 1. 기준 날짜 결정

각 scope의 CHANGELOG.md를 읽어 가장 최근 `## YYYY년 M월 D일 주차` 헤더 날짜를 파악한다.
- `since` 인수가 있으면 그 값을 사용한다.
- CHANGELOG.md가 없거나 비어있으면 `--since="30 days ago"`를 기본값으로 사용한다.

### Step 2. git log 수집

각 scope에 해당하는 경로의 커밋만 필터링한다:

```bash
# 예시 (engine)
git log --oneline --no-merges \
  --format="%ad %H %s" \
  --date=format:"%Y-%m-%d" \
  --since="<기준날짜>" \
  -- engine/
```

`docs/work` 초기화 커밋(`chore: docs/work 폴더 초기화`, `chore: docs/work done 이동` 등)은 노이즈로 간주해 제외한다.

### Step 3. 커밋 분류

각 커밋을 아래 카테고리로 분류한다:

| 커밋 prefix | 카테고리 |
|-------------|----------|
| `feat:`     | ✨ 새 기능 |
| `fix:`      | 🐛 버그 수정 |
| `refactor:` | 🔧 개선 |
| `chore:` (보안·훅·설정) | 🛡️ 보안 / 품질 |
| `chore:` (그 외) | 🔧 개선 |
| `docs:`     | 📚 문서 |
| `perf:`     | ⚡ 성능 |

### Step 4. 주차 그룹핑

커밋을 월요일 기준 ISO 주차로 묶는다.
- 주차 헤더 형식: `## YYYY년 M월 D일 주차 (Mon D~)`
- 같은 주차면 하나의 섹션으로 합친다.

### Step 5. 사용자 친화적 메시지 변환

기술적 커밋 메시지를 팀원이 이해하기 쉬운 문장으로 변환한다:
- 이슈 번호 `(#N)` 는 GitHub 링크로 변환: `([#N](../../issues/N))`
- 한국어·영어 혼용 유지 (기존 CHANGELOG 톤 따름)
- 내부 리팩토링·테스트 픽스처·work 폴더 커밋은 독립 항목 없이 상위 기능에 포함

### Step 6. CHANGELOG.md 업데이트

새로운 주차 섹션을 기존 CHANGELOG.md 최상단(첫 번째 `---` 구분선 위)에 **prepend** 한다.
- 이미 같은 주차 헤더가 있으면 해당 섹션에 항목을 **병합**한다 (중복 제거).
- CHANGELOG.md가 없으면 새로 생성한다.

### Step 7. 결과 요약 출력

처리한 scope별로 아래를 출력한다:
```
✅ engine/CHANGELOG.md — 5개 커밋 → 3항목 추가 (2026년 3월 2일 주차)
✅ services/lww/CHANGELOG.md — 2개 커밋 → 1항목 추가 (2026년 3월 2일 주차)
⏭️  services/kwan/CHANGELOG.md — 변경 없음 (해당 기간 커밋 없음)
```

scope가 단일인 경우 해당 CHANGELOG.md 최신 내용 전체를 출력한다.

## 사용 예시

```
/update-changelog                    # 모든 scope 업데이트
/update-changelog engine             # 엔진만 업데이트
/update-changelog lww since:2026-03-01
/update-changelog root since:v0.1.0
```
