# feat: [siw] 서비스 업그레이드 — 개선 제안 글씨 크기 조정 + 이력서 삭제 기능

## 사용자 관점 목표
- 이력서 상세 페이지의 개선 제안 섹션 텍스트가 너무 작아 읽기 어렵다 → 가독성 개선
- 업로드한 이력서를 삭제할 수 없다 → 이력서 삭제 기능 제공

## 배경
- `/resumes/[id]` 페이지 개선 제안 카드의 section 제목이 `text-[11px]`, 본문이 `text-xs`로 너무 작음
- `/resumes` 페이지에 삭제 버튼·UI 없고, API에도 DELETE 핸들러 없음

## 완료 기준
- [x] `/resumes` 페이지 각 이력서 카드에 삭제 버튼이 표시되고, 확인 후 이력서가 삭제되어 목록에서 사라진다
- [x] 삭제 API (`DELETE /api/resumes/[id]`)가 본인 이력서만 삭제 가능하고, 타인 이력서는 403을 반환한다
- [x] `/resumes/[id]` 개선 제안 섹션의 section 제목(`text-[11px]`) · 본문(`text-xs`) 크기가 가독성 있게 커진다

## 구현 플랜
1. `services/siw/src/app/api/resumes/[id]/route.ts` — DELETE 핸들러 추가 (인증 확인 + 본인 소유 검증 + DB 삭제)
2. `services/siw/src/app/(app)/resumes/page.tsx` — 삭제 버튼(휴지통 아이콘) UI + 확인 모달 + 삭제 후 목록 갱신
3. `services/siw/src/app/(app)/resumes/[id]/page.tsx` — 개선 제안 카드 `text-[11px]` → `text-sm`, `text-xs` → `text-sm` 상향

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 2026-03-24

**현황**: 3/3 완료

#### resume-repository.ts — `deleteById` 메서드 추가
`prisma.resume.deleteMany({ where: { id, userId } })`로 소유권 확인과 삭제를 단일 쿼리로 원자 처리. `boolean` 반환으로 caller가 삭제 성공 여부 판단 가능.

#### api/resumes/[id]/route.ts — `DELETE` 핸들러 추가
- 인증 없음 → 401, 이력서 없음 → 404, 타인 이력서 → 403 (AC 명시적 충족)
- Supabase Storage 파일 삭제 (실패 시 try/catch로 무시하고 DB 삭제 계속 진행)
- DB 삭제 성공 → 200

#### resumes/page.tsx — 삭제 버튼 UI 추가
각 이력서 카드 버튼 행 오른쪽 끝에 Trash2 아이콘 삭제 버튼 추가. `window.confirm`으로 확인 후 `DELETE /api/resumes/[id]` 호출. 성공 시 `setResumes` 필터링으로 목록 즉시 갱신. `deletingId` 상태로 삭제 중 버튼 비활성화.

#### resumes/[id]/page.tsx — 개선 제안 폰트 크기 수정
개선 제안 카드의 section 제목 `text-[11px]` → `text-sm`, 문제·제안 본문 `text-xs` → `text-sm` 상향.

#### __tests__/route.test.ts — DELETE 엔드포인트 테스트 신규 작성
Vitest 4케이스: 401(미인증), 404(없는 이력서), 403(타인 이력서), 200(성공). 기존 feedback 테스트 패턴(`vi.mock`, dynamic import) 동일하게 적용.

