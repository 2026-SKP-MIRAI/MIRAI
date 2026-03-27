# [#289] fix: [siw] 직무 미지정 시 normalizeRole 기본값 "소프트웨어 개발자" 폴백 버그 수정 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [ ] `normalizeRole("")` → `""` 반환
- [ ] `normalizeRole(null)` → `""` 반환
- [ ] 직무 미지정으로 제출 시 `inferredTargetRole`이 `null`로 저장된다
- [ ] 기존 직무 매핑 동작은 변경 없음
- [ ] 관련 테스트 업데이트

---

## 구현 계획

1. `services/siw/src/lib/role-normalizer.ts` — 빈 문자열 입력 시 `DEFAULT_ROLE` 대신 `""` 반환
2. `services/siw/src/lib/role-normalizer.ts` — `DEFAULT_ROLE` 상수 제거 (미사용)
3. 관련 테스트 업데이트
