# chore: active에 남은 완료 이슈 작업 문서 done으로 이동

## 목적
finish-issue 미처리로 인해 이미 CLOSED된 이슈의 작업 문서가 `docs/work/active/`에 잔류 중이므로 `docs/work/done/`으로 이동한다.

## 배경
아래 3개 이슈는 GitHub에서 CLOSED 상태이나 작업 문서가 active에 남아 있다:
- #185 `000185-lww-pptx-remotion`
- #288 `000288-pdf-ocr-dpi`
- #289 `000289-normalize-role-fallback`

## 완료 기준
- [ ] `docs/work/active/`에 3개 폴더가 사라지고 `.gitkeep`만 남음
- [ ] `docs/work/done/`에 000185, 000288, 000289 폴더가 정상 존재

## 구현 플랜
1. `docs/work/active/000185-lww-pptx-remotion/` → `docs/work/done/`으로 이동
2. `docs/work/active/000288-pdf-ocr-dpi/` → `docs/work/done/`으로 이동
3. `docs/work/active/000289-normalize-role-fallback/` → `docs/work/done/`으로 이동

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

- `docs/work/active/000185-lww-pptx-remotion/` → `docs/work/done/`으로 이동
- `docs/work/active/000288-pdf-ocr-dpi/` → `docs/work/done/`으로 이동
- `docs/work/active/000289-normalize-role-fallback/` → `docs/work/done/`으로 이동

세 이슈 모두 GitHub에서 CLOSED 상태였으나 finish-issue 미처리로 작업 문서가 active에 잔류하고 있었음. 수동으로 이동하여 정리.
