# [#194] feat: [Fint] 서비스명 통일 + Phase 2 스토리보드 상세화 + 디자인 시안 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

- [ ] services/lww/ → services/fint/ 디렉토리 이름 변경 + 모든 참조 업데이트
- [ ] docs/specs/lww/ → docs/specs/fint/ 이동
- [ ] design.md 컬러 시스템 Teal #0D9488로 전면 업데이트
- [ ] storyboard.md 서비스명 Fint 통일 + IA 5탭 구조 반영
- [ ] Phase 2 핵심 화면 상세화 (Aha Moment·스트릭·홈피드·페르소나마켓·쪽지·MBTI카드)
- [ ] Phase 2 나노바나나프로 디자인 시안 6개 이상 생성
- [ ] Playwright E2E 경로 업데이트 (디렉토리 변경 반영)
- [ ] 테스트 코드 포함
- [ ] services/fint/.ai.md 최신화
- [ ] 불변식 위반 없음

---

## RALPLAN-DR 합의 요약

### Principles
1. 파괴적 변경(디렉토리 리네임)은 원자적으로 — `git mv` + 참조 업데이트를 단일 단계로
2. 코드 변경 → 검증 → 문서 작업 순서 엄수
3. 역사 기록(`docs/work/done/`, `CHANGELOG.md`) 수정 금지
4. 이미지 파일 git 커밋 금지 — 심볼릭 링크 방식(`designs/`) 유지

### Decision Drivers
1. `services/fint/`와 `docs/specs/fint/`가 이미 부분적으로 존재 → 충돌 없는 merge 전략 필요
2. PR #187에서 design.md, storyboard.md, 시안이 이미 완성됨 → 중복 작업 방지
3. `update-changelog.md` 등 액티브 커맨드 파일도 참조 업데이트 대상

### Viable Options
| 옵션 | 설명 | 판정 |
|------|------|------|
| **A (채택)** | 백업→git rm→git mv→복원 순차 실행, 단계별 검증 | ✅ 채택 |
| B (기각) | 병렬 진행 | ❌ 의존성 충돌 위험 |
| C (기각) | per-file git mv (전체 파일 열거) | ❌ 복잡도 과다, Option A가 더 단순 |

---

## 현재 상태 파악 (BEFORE)

| 항목 | 현재 상태 | 필요 작업 |
|------|-----------|-----------|
| `services/lww/` | 전체 코드 존재 (package.json, src/, tests/ 등) | fint/로 이동 |
| `services/fint/` | `.ai.md` 1개만 존재 (PR #187에서 생성, 권위본) | 코드 이동 후 .ai.md 복원 |
| `docs/specs/lww/` | design.md(구버전 보라), storyboard.md(구버전), ia_flow.md, branding.md, content_spec.md, dev_spec.md, user_research.md, .ai.md | fint로 통합 후 삭제 |
| `docs/specs/fint/` | design.md(✅ Teal 적용), storyboard.md(✅ Phase 2 완료), payment_spec.md | 나머지 파일 이동 수신 |
| `services/fint/.ai.md` | PR #187 기준 최신 내용 (권위본) | Phase A 이후 복원 |
| `docs/specs/fint/storyboard.md` | Phase 2 화면 22-31 모두 ✅ 완료 | 이미 충족됨 |
| `AGENTS.md:33` | `├── lww/` | `├── fint/` 교체 |
| `README.md:42,111,114,152` | lww 참조 | fint 교체 |
| `services/lww/package.json` | `"name": "mirai-lww"` | `"mirai-fint"` 교체 |

### AC 사전 충족 확인
- `design.md 컬러 시스템 Teal #0D9488` → `docs/specs/fint/design.md` 이미 완료 ✅
- `storyboard.md Fint 통일 + IA 5탭 구조` → `docs/specs/fint/storyboard.md` 이미 완료 ✅
- `Phase 2 핵심 화면 상세화` → `docs/specs/fint/storyboard.md` 화면 22-31 이미 완료 ✅

### 변경 금지 파일 (역사 기록)
- `docs/work/done/*` — 완료된 이슈 로그, 수정 시 감사 기록 훼손
- `docs/whitepaper/lww/` — 프레젠테이션 자료, 이 이슈 범위 밖
- `CHANGELOG.md` — 역사 기록
- `services/kwan/package-lock.json` — 타 서비스

---

## 구현 계획

### Phase A: services/lww → services/fint 코드 이동

**블로킹 이슈 해결**: `services/fint/.ai.md`(권위본)가 이미 존재하므로 `git mv services/lww services/fint` 직접 실행 불가.

**전략**: 권위본 .ai.md 백업 → fint 비우기 → git mv → 권위본 복원

#### A-1. 권위본 .ai.md 내용 저장
```bash
# services/fint/.ai.md 내용을 임시 저장 (PR #187 기준 최신 내용)
cp services/fint/.ai.md /tmp/fint-ai-md-backup.md
```

#### A-2. fint 디렉토리 비우기
```bash
git rm services/fint/.ai.md
```

#### A-3. services/lww → services/fint 이동
```bash
git mv services/lww services/fint
```

#### A-4. 권위본 .ai.md 복원
```bash
# /tmp/fint-ai-md-backup.md 내용으로 services/fint/.ai.md 덮어쓰기
cp /tmp/fint-ai-md-backup.md services/fint/.ai.md
git add services/fint/.ai.md
```

#### A-5. package.json 서비스명 업데이트
- 파일: `services/fint/package.json`
- 변경: `"name": "mirai-lww"` → `"name": "mirai-fint"`

#### A-6. README.md 내 lww 참조 업데이트
- 파일: `services/fint/README.md`
- 변경:
  - `# mirai-lww` → `# mirai-fint`
  - `cd services/lww` → `cd services/fint`
  - `docker build -t mirai-lww` → `docker build -t mirai-fint`
  - `mirai-lww` (docker run) → `mirai-fint`

#### A-7. Vercel 설정 확인
- 파일: `services/fint/vercel.json`
- 경로 참조가 있으면 업데이트

#### A-8. 검증
```bash
cd services/fint && npm install
npx tsc --noEmit
npm test  # vitest
```

---

### Phase B: docs/specs/lww → docs/specs/fint 통합

#### B-1. 중복 파일 제거 (fint 버전이 권위본)
```bash
git rm docs/specs/lww/design.md      # docs/specs/fint/design.md가 최신 (Teal 적용)
git rm docs/specs/lww/storyboard.md  # docs/specs/fint/storyboard.md가 최신 (Phase 2 완료)
```

#### B-2. 고유 파일 이동 (lww에만 있는 파일들)
```bash
git mv docs/specs/lww/ia_flow.md     docs/specs/fint/ia_flow.md
git mv docs/specs/lww/branding.md    docs/specs/fint/branding.md
git mv docs/specs/lww/content_spec.md docs/specs/fint/content_spec.md
git mv docs/specs/lww/dev_spec.md    docs/specs/fint/dev_spec.md
git mv docs/specs/lww/user_research.md docs/specs/fint/user_research.md
```

#### B-3. 이동된 파일 내 서비스명 업데이트
각 이동된 파일에서 구버전 참조 교체:

| 파일 | 찾기 | 바꾸기 |
|------|------|--------|
| `ia_flow.md` | `서비스명 \| lww` → | `서비스명 \| Fint` |
| `ia_flow.md` | `root((lww))` (mermaid) | `root((Fint))` |
| `ia_flow.md` | `서비스명 \| lww (Life With Work)` | `서비스명 \| Fint (Find Interview)` |
| `branding.md` | `서비스: lww ("취업준비부터...")` | `서비스: Fint (Find Interview)` |
| `content_spec.md` | `lww` (서비스명 표기) | `Fint` |
| `dev_spec.md` | `lww` (서비스명 표기) | `fint` |

#### B-4. 컬러 업데이트 (이동된 파일에 구버전 보라 참조 있는 경우)
대상: `branding.md`, `ia_flow.md` 내 `#7C3AED` → `#0D9488`

#### B-5. docs/specs/fint/.ai.md 생성
`docs/specs/lww/.ai.md`를 기반으로 Fint 브랜딩 반영한 `.ai.md` 생성:
```bash
git rm docs/specs/lww/.ai.md
# docs/specs/fint/.ai.md 신규 작성 (아래 내용으로)
```

새 내용:
```markdown
# docs/specs/fint/ — Fint 서비스 기획/설계 문서

> 최종 업데이트: 2026-03-25 (이슈 #194 — 서비스명 통일 + docs/specs/lww 통합)

## 목적
Fint(Find Interview) 서비스의 기획·설계·디자인 명세 문서 모음.

## 파일 목록
| 파일 | 내용 |
|------|------|
| `design.md` | 디자인 시스템 (컬러·타이포·컴포넌트 명세, Teal #0D9488 확정) |
| `storyboard.md` | 핵심 화면 스토리보드 (Phase 1~3, 31개 화면) |
| `ia_flow.md` | IA 구조 + 화면 플로우 |
| `branding.md` | 브랜드 가이드 (Teal 옵션 B 확정) |
| `content_spec.md` | 마이크로카피·톤 가이드 |
| `dev_spec.md` | 개발 명세 |
| `user_research.md` | 사용자 리서치 |
| `payment_spec.md` | 결제/크레딧 명세 |
| `designs/` | Phase 2 디자인 시안 (나노바나나프로 생성, 심볼릭 링크) |

## 관련 문서
- 서비스 구현: `services/fint/`
- 기획서: `docs/whitepaper/lww/proposal.md`
- 작업 내역: `docs/work/active/000194-fint-phase-2/`
```

#### B-6. 남은 lww 디렉토리 제거 확인
```bash
# docs/specs/lww/ 가 비어있는지 확인 후 제거
git rm -r docs/specs/lww/  # 위 단계 완료 후 실행
```

---

### Phase C: 전체 참조 업데이트 (must-change 파일)

#### C-1. AGENTS.md
- 파일: `AGENTS.md:33`
- 변경: `├── lww/` → `├── fint/              # Fint — AI 모의면접 서비스`

#### C-2. `.claude/commands/update-changelog.md`
- 파일: `.claude/commands/update-changelog.md` (lww 참조 5곳: 라인 2, 10, 21, 88, 99)
- 변경: 파일 내 모든 `lww` → `fint`, `services/lww/` → `services/fint/`, `services/lww/CHANGELOG.md` → `services/fint/CHANGELOG.md`
- 이유: 팀이 실제로 사용하는 액티브 커맨드 — 리네임 후 `update-changelog lww` 실행 시 경로 오류 발생

#### C-3. 루트 README.md
- `README.md:42`: `│   ├── lww/              # 이왕원` → `│   ├── fint/             # 이왕원 (Fint)`
- `README.md:111`: `### 서비스 (lww 예시)` → `### 서비스 (fint 예시)`
- `README.md:114`: `cd services/lww` → `cd services/fint`
- `README.md:152`: `\| 멘토 \| 이왕원 \| \`services/lww\` \|` → `\| 멘토 \| 이왕원 \| \`services/fint\` \|`

---

### Phase D: 나노바나나프로 디자인 시안 ✅ 이미 완료

**확인 결과**: `docs/specs/fint/designs/` (심볼릭 링크 → 메인 레포 `/docs/specs/fint/designs/`)에 이미 생성됨.

**저장 정책**: 심볼릭 링크 방식 — 이미지 파일은 메인 레포에 저장, 워크트리에서 심링크로 접근.
(이미지 파일 직접 커밋 금지 정책과 호환)

**기존 시안 목록 (11개 Phase 2 + 13개 Phase 1+)**:

Phase 2 시안 (2026-03-23 생성):
- `p2-01-aha-moment.png` — 결과 리포트 Aha Moment
- `p2-02-home-feed-streak.png` — 홈 피드 + 스트릭
- `p2-03-persona-market-list.png` — 페르소나 마켓 목록
- `p2-04-persona-market-detail.png` — 페르소나 마켓 상세
- `p2-05-message.png` — 쪽지 화면
- `p2-06-mbti-card.png` — MBTI 카드
- `p2-07-streak-detail.png` — 스트릭 상세
- `p2-08-home-feed-full.png` — 홈 피드 전체
- `p2-09-community.png` — 커뮤니티
- `p2-10-credit-charge.png` — 크레딧 충전
- `p2-12-mbti-generation.png` — MBTI 카드 생성

AC "Phase 2 나노바나나프로 디자인 시안 6개 이상" → **✅ 이미 충족 (11개)**

추가 생성 불필요. Phase D 건너뜀.

---

### Phase E: Playwright E2E 경로 검증

Phase A에서 `git mv services/lww services/fint` 실행 후:

1. `services/fint/playwright.config.ts` 확인:
   - `testDir: "./tests/e2e"` — 상대 경로, git mv 후 자동 유지 ✅
   - `baseURL: "http://localhost:3000"` — 변경 없음 ✅
2. E2E 테스트 파일 내 경로 참조 확인:
   - `services/fint/tests/e2e/*.spec.ts` 내 `/services/lww` 절대 경로 참조 있으면 수정
3. `npm run test:e2e` (선택적, 서버 실행 환경 필요)

---

### Phase F: .ai.md 최신화

1. `services/fint/.ai.md` — Phase A에서 복원된 권위본 기준, 구현 현황 추가 업데이트
2. `docs/specs/fint/.ai.md` — Phase B에서 신규 생성

---

## 의존성 순서

```
Phase A (services 이동)
  └─ A-8 vitest 통과 확인
      └─ Phase B (docs/specs 통합)
          └─ Phase C (참조 업데이트)
              └─ Phase D (나노바나나프로) [독립 실행 가능]
              └─ Phase E (Playwright 검증)
                  └─ Phase F (.ai.md 최신화)
```

Phase D는 Phase C 이후 독립적으로 실행 가능.

---

## 롤백 플랜

리네임 후 CI 또는 테스트 실패 시:
```bash
# Phase A 롤백
git mv services/fint services/lww
git checkout HEAD -- services/fint/.ai.md  # 또는 git stash pop
```

Phase A-C 전체 롤백:
```bash
git reset HEAD~1 --soft  # 커밋 전이면 스테이징 해제
# 또는 커밋 후라면
git revert <commit-hash>
```

---

## 활성 브랜치 충돌 주의

`docs/work/active/000185-lww-pptx-remotion/` 브랜치가 `services/lww` 참조를 사용 중.
→ 이 PR 머지 후 해당 브랜치 담당자에게 리베이스 또는 경로 수정 필요함을 알린다.
→ 이 이슈에서 직접 해결 범위 밖.
