# fix: [siw] 직무 미지정 시 normalizeRole 기본값 "소프트웨어 개발자" 폴백 버그 수정

## 목적
직무를 비워두고 자소서를 제출했을 때 DB에 \"소프트웨어 개발자\"가 저장되는 버그를 수정한다.

## 배경
`normalizeRole(\"\")` 호출 시 `DEFAULT_ROLE = \"소프트웨어 개발자\"`가 반환된다.
`resumes/route.ts`에서 `normalizeRole(targetRole) || null`로 null 처리를 의도했으나, \"소프트웨어 개발자\"는 truthy라 null이 되지 않아 DB에 잘못 저장된다.

## 완료 기준
- [x] `normalizeRole(\"\")` → `""` 반환
- [x] `normalizeRole(null)` → `""` 반환
- [x] 직무 미지정으로 제출 시 `inferredTargetRole`이 `null`로 저장된다
- [x] 기존 직무 매핑 동작은 변경 없음
- [x] 관련 테스트 업데이트

## 구현 플랜
1. `src/lib/role-normalizer.ts:24` — `return DEFAULT_ROLE` → `return ""`
2. `DEFAULT_ROLE` 상수 및 관련 테스트 업데이트

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

- `role-normalizer.ts`: `DEFAULT_ROLE` 상수 제거, 빈 입력 시 `""` 반환으로 수정
- `role-normalizer.test.ts`: 빈 문자열/null/undefined → `""`, 50자 초과 잘림 케이스 추가 (8개 테스트 통과)
- `resumes/route.ts`: 기존 `normalizeRole(targetRole) || null` 패턴이 수정된 함수와 정확히 동작함 (변경 불필요)
- `resumes/page.tsx`, `resumes/[id]/page.tsx`: `inferredTargetRole || "직무 미지정"` UI 표시 확인
- `api/resumes/.ai.md`: 직무 정규화 동작 문서화
