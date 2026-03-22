# feat: [lww] UI/UX 전면 개선 — 나노바나나프로 디자인 시안 → 스토리보드 → 재구현

## 사용자 관점 목표
더 세련되고 완성도 높은 UI/UX로 면접 경험의 몰입감과 신뢰감을 높인다.

## 배경
현재 lww 서비스 디자인이 MVP 수준에서 벗어나지 못해 시각적 완성도가 낮다. 나노바나나프로(Gemini 3 Pro Image via OpenRouter API)로 각 화면의 디자인 시안을 먼저 생성하고, 스토리보드로 정리한 뒤 그것을 기반으로 프론트엔드를 재구현한다.

## 완료 기준
- [x] 주요 화면(온보딩·직군선택·채팅면접·결과 리포트) 나노바나나프로 디자인 시안 생성
- [x] 시안 기반 스토리보드 문서 갱신 (`docs/specs/lww/storyboard.md`)
- [x] 시안대로 프론트엔드 컴포넌트 재구현 (Teal #0D9488 브랜드 유지)
- [x] Playwright E2E 3회 연속 PASS

## 구현 플랜
1. 화면별 시안 프롬프트 작성 → 나노바나나프로로 이미지 생성
2. 생성된 시안 검토 → `docs/specs/lww/storyboard.md` 갱신
3. 시안 기반으로 components/ 재구현 (레이아웃·컬러·타이포·간격)
4. E2E 검증

## 참고
- 나노바나나프로: `openclaw-openclaw-nano-banana-pro` 스킬 (OpenRouter API 사용)
- lww 브랜드: Teal #0D9488, Pretendard 폰트
- 현재 스토리보드: `docs/specs/lww/storyboard.md`
- 현재 컴포넌트: `services/lww/src/components/`

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] `services/lww/.ai.md` 최신화
- [x] 불변식 위반 없음

## 작업 내역

### 2026-03-22

**현황**: 4/4 완료

**완료된 항목**:
- [x] 주요 화면 나노바나나프로 시안 생성
- [x] storyboard.md 갱신
- [x] 프론트엔드 컴포넌트 재구현
- [x] Playwright E2E 3회 연속 PASS

#### 변경 파일별 상세

**`docs/specs/lww/storyboard.md`**
보라 계열 `#7C3AED` → Teal `#0D9488` 브랜드 컬러 전체 반영. 서비스명 Fint → lww 정정. 나노바나나프로(Gemini 3.1 Flash Image Preview)로 생성한 4개 화면 시안 이미지 링크 추가: 온보딩, 직군선택, 채팅면접, 결과리포트. Phase 1 완료 화면(로그인, 면접히스토리, 자소서 업로드)도 스토리보드에 추가. 채팅 UI 세부 확정 사항 반영: 시스템 배너, 진행률 displayIndex 로직, 낮은 점수 amber 색상.

**`services/lww/src/hooks/useInterview.ts`**
SSR resilience 개선: Next.js App Router에서 `useState` lazy initializer가 서버에서 실행될 때 sessionStorage 미접근으로 `idle` 상태로 초기화되는 문제 수정. `loadInitialState(sessionId)` 헬퍼 함수 추출 — `interview_state`와 `interview_init` 두 키를 순서대로 확인하는 로직을 단일화. 마운트 후 `useEffect`에서 `idle` 상태면 `loadInitialState`를 재호출해 sessionStorage에서 복구.

**`services/lww/playwright.config.ts`**
포트 3001 → 3002 변경. root 소유 PID 3386(next-server v16, 2026-03-04부터 실행)이 port 3001 점유하고 `_next/static/chunks/` 전체를 400 반환 — React 번들 미로드로 hydration 불가, 모든 인터랙션 실패. `reuseExistingServer: false`로 항상 독립된 fresh dev 서버 구동.

**`services/lww/tests/e2e/interview-flow.spec.ts`**
Test 1: onboarding_done 기반 리다이렉트 → `/onboarding` 직접 접근 방식으로 변경(더 안정적). Test 2: `waitForFunction`으로 React hydration 완료(`__reactFiber`/`__reactProps` property) 대기 후 칩 클릭. `toPass()` 패턴으로 style 변경 비동기 검증. Test 3: `interview_init` → `interview_state` 직접 주입으로 변경(useInterview SSR 복구 경로와 일치).

**`tests/e2e/debug.spec.ts`** (삭제)
진단 중 생성한 임시 파일. 포트 문제 원인 파악 후 불필요하여 삭제.

#### 핵심 기술 결정
- **포트 충돌 해결**: `reuseExistingServer: false` + 전용 포트 3002 — Playwright 실행 환경을 외부 dev 서버로부터 완전히 격리
- **SSR resilience 패턴**: `useState` 초기화(서버 측) + `useEffect` 재복구(클라이언트 측) 이중 복구 — Next.js App Router의 SSR/CSR 전환 특성에 대응
- **헬퍼 추출**: `loadInitialState(sessionId)` — 중복 파싱 로직 제거, 단일 변경점 확보
