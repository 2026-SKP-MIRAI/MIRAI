# [#23] chore: 엄브렐라 레포 → 모노레포 롤백 — 구현 계획

> 작성: 2026-03-06

---

## 완료 기준

- [ ] `docs/whitepaper/mirai_project_plan.md`의 `umbrella repo` 표현이 `monorepo`로 교체됨
- [ ] `AGENTS.md`에서 submodule 참조(`(submodule: mirai-engine)`, `(각각 submodule)`, `→ mirai-xxx`) 제거되고 순수 디렉토리 구조로 기술됨
- [ ] `.gitmodules` 파일 삭제 및 `git submodule deinit` 완료
- [ ] `.claude/commands/cleanup-issue.md`의 "submodule 포함 워크트리 대응" 주석 업데이트

---

## 현황 파악

`.gitmodules` 등록된 서브모듈 (5개):
- `engine` → `https://github.com/2026-SKP-MIRAI/mirai-engine.git`
- `services/siw` → `https://github.com/2026-SKP-MIRAI/mirai-siw.git`
- `services/kwan` → `https://github.com/2026-SKP-MIRAI/mirai-kwan.git`
- `services/seung` → `https://github.com/2026-SKP-MIRAI/mirai-seung.git`
- `services/lww` → `https://github.com/2026-SKP-MIRAI/mirai-lww.git`

**서브모듈 초기화 상태**: `git submodule status` 결과 모두 `-` prefix — 이미 비초기화(not checked out) 상태. 서브모듈 디렉토리들(`engine/`, `services/siw/` 등)은 현재 **비어있음**. `.git/modules/` 없음.

변경이 필요한 파일:
| 파일 | 변경 내용 |
|------|----------|
| `.gitmodules` | 삭제 |
| `AGENTS.md:22` | `(submodule: mirai-engine)` 제거 |
| `AGENTS.md:30` | `(각각 submodule)` 제거 |
| `AGENTS.md:31~34` | `→ mirai-xxx` 참조 제거 |
| `docs/whitepaper/mirai_project_plan.md:27` | `umbrella repo` → `monorepo` |
| `.claude/commands/cleanup-issue.md:74` | submodule 관련 주석 수정 |

---

## 구현 계획

### Step 1 — 서브모듈 연결 해제

서브모듈이 이미 비초기화 상태이므로 `git submodule deinit`는 불필요. git index에서 제거 + `.gitmodules` 삭제만 수행.

```bash
# git index에서 서브모듈 경로 제거 (gitlink 엔트리 삭제)
git rm --cached engine
git rm --cached services/siw
git rm --cached services/kwan
git rm --cached services/seung
git rm --cached services/lww

# .gitmodules 파일 삭제
git rm .gitmodules
```

> 비어있는 서브모듈 디렉토리들(`engine/`, `services/siw/` 등)은 `git rm --cached` 후 파일시스템에 빈 채로 남는다. git은 빈 디렉토리를 추적하지 않으므로 그대로 두면 됨 — 향후 실제 코드가 들어올 자리.

### Step 2 — AGENTS.md 수정

`AGENTS.md` 레포 구조 블록에서 submodule 참조 제거:

```
# 변경 전
├── engine/   ← FastAPI (Python), 전원 공동 설계 (submodule: mirai-engine)
└── services/ ← Next.js 풀스택 (TypeScript), 1인 1서비스 (각각 submodule)
    ├── siw/  → mirai-siw
    ├── kwan/ → mirai-kwan
    ├── lww/  → mirai-lww
    └── seung/→ mirai-seung

# 변경 후
├── engine/   ← FastAPI (Python), 전원 공동 설계
└── services/ ← Next.js 풀스택 (TypeScript), 1인 1서비스
    ├── siw/
    ├── kwan/
    ├── lww/
    └── seung/
```

### Step 3 — mirai_project_plan.md 수정

`docs/whitepaper/mirai_project_plan.md:27`:
- `mirai/  ← umbrella repo` → `mirai/  ← monorepo`

### Step 4 — cleanup-issue.md 수정

`.claude/commands/cleanup-issue.md:74`:
- `(submodule 포함 워크트리 대응을 위해 \`--force\` 사용)` → `(워크트리 잠금 방지를 위해 \`--force\` 사용)`

### Step 5 — .ai.md 최신화

변경 대상 파일별 `.ai.md` 확인:
- `docs/whitepaper/.ai.md` — submodule/umbrella 언급 없음, 수정 불필요
- `docs/.ai.md` — submodule/umbrella 언급 없음, 수정 불필요
- `.claude/commands/.ai.md` — cleanup-issue.md 변경 내용 반영 여부 확인 후 필요 시 수정

---

## 검증 방법

```bash
# 서브모듈 연결이 해제됐는지 확인
git submodule status  # 아무것도 출력되지 않아야 함
cat .gitmodules       # 파일이 없어야 함

# 텍스트 변경 확인
grep -r "submodule" AGENTS.md   # 결과 없어야 함
grep -r "umbrella" docs/whitepaper/mirai_project_plan.md  # 결과 없어야 함
```
