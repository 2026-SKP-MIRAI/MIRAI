# feat: [Fint] 서비스명 통일 + Phase 2 스토리보드 상세화 + 디자인 시안

## 사용자 관점 목표
서비스명을 Fint로 통일하고, Phase 2 개발 착수에 필요한 상세 스토리보드와 디자인 시안을 완성한다.

## 배경
- 코드베이스는 `services/lww/`이나 서비스명은 Fint (Find Interview)로 확정
- `design.md` 컬러 시스템이 구버전 보라(`#7C3AED`) 사용 중 → Teal `#0D9488`로 통일 필요
- storyboard.md Phase 2 화면(홈 피드, 페르소나 마켓, 쪽지, MBTI 카드 등)이 골격만 있고 개발 착수 수준 미달
- IA 구조(5탭), 스트릭 메커니즘, SNS 공유 바이럴 플로우 등 storyboard 미반영

## 완료 기준
- [x] services/lww/ → services/fint/ 디렉토리 이름 변경 + 모든 참조 업데이트
- [x] docs/specs/lww/ → docs/specs/fint/ 이동
- [x] design.md 컬러 시스템 Teal #0D9488로 전면 업데이트
- [x] storyboard.md 서비스명 Fint 통일 + IA 5탭 구조 반영
- [x] Phase 2 핵심 화면 상세화 (Aha Moment·스트릭·홈피드·페르소나마켓·쪽지·MBTI카드)
- [x] Phase 2 나노바나나프로 디자인 시안 6개 이상 생성
- [x] Playwright E2E 경로 업데이트 (디렉토리 변경 반영)

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] services/fint/.ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 핵심 변경

**services/lww/ → services/fint/ 이동**
- `git mv services/lww services/fint` (services/fint/.ai.md가 PR #187에서 이미 존재해 충돌 → 백업 후 rm/mv/복원 전략 적용)
- `services/fint/package.json` name: `"mirai-lww"` → `"mirai-fint"`
- `services/fint/README.md` 내 `mirai-lww`, `docker build -t mirai-lww` 등 참조 → fint로 교체

**소스 코드 내 lww 브랜드/쿠키 참조 제거 (architect 리뷰에서 발견)**
- `src/lib/anon-cookie.ts`: 쿠키명 `lww_anon_id` → `fint_anon_id`
- `src/app/layout.tsx`: 페이지 타이틀 `"lww — AI 모의면접"` → `"Fint — AI 모의면접"`
- `src/components/layout/TopBar.tsx`: 브랜드 레이블 `lww` → `Fint`
- `src/components/onboarding/OnboardingSlider.tsx`: 스플래시 타이틀 `lww` → `Fint` (2곳)
- `src/app/(main)/interview/page.tsx`, `auth/callback/route.ts`, `auth/confirm/route.ts`: 쿠키 참조 → `fint_anon_id`
- 관련 테스트 3개 파일 (`route.test.ts` ×2, `OnboardingSlider.test.tsx`) 어서션 업데이트

**docs/specs/lww/ → docs/specs/fint/ 통합**
- `design.md`, `storyboard.md`: fint 권위본(PR #187) 유지, lww 버전 삭제
- `ia_flow.md`, `branding.md`, `content_spec.md`, `dev_spec.md`, `user_research.md`: git mv 후 내부 lww 표기 → Fint 교체
- `docs/specs/fint/.ai.md` 신규 생성: 모든 파일 목록 및 designs/ 심볼릭 링크 명시

**참조 업데이트**
- `AGENTS.md:33`: `lww/` → `fint/`
- `README.md`: 4곳 `services/lww` → `services/fint`
- `.claude/commands/update-changelog.md`: 5곳 lww → fint (scope enum, 경로, 예시 포함)

### 검증 결과
- `npm test (vitest)`: 48/48 통과
- `npx tsc --noEmit`: 0 errors
- `grep -r "lww" services/fint/src/`: 0 matches
- Architect 리뷰: APPROVE

