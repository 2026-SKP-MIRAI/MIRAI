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
- [x] Phase 2 나노바나나프로 디자인 시안 6개 이상 생성 (7개, docs/specs/fint/designs/p2/)
- [x] Playwright E2E 경로 업데이트 (playwright.config.ts port 3002 유지, 경로 변경 없음)

## 개발 체크리스트
- [x] 테스트 코드 포함 (기존 tests/ 경로 그대로 이전)
- [x] services/fint/.ai.md 최신화 (Phase 2 기능 섹션 추가)
- [x] 불변식 위반 없음 (빌드 PASS, 14 routes)
