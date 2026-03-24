# [#187] feat: [lww] UI/UX 전면 개선 — 구현 계획

> 작성: 2026-03-21 (복원: 2026-03-22)

---

## 완료 기준

- [ ] 주요 화면(온보딩·직군선택·채팅면접·결과 리포트) 나노바나나프로 디자인 시안 생성
- [ ] 시안 기반 스토리보드 문서 갱신 (`docs/specs/lww/storyboard.md`)
- [ ] 시안대로 프론트엔드 컴포넌트 재구현 (Teal #0D9488 브랜드 유지)
- [ ] Playwright E2E 3회 연속 PASS

---

## 구현 계획

### Step 1 — MVP 4개 화면 시안 생성

OpenRouter `google/gemini-3.1-flash-image-preview` 모델로 이미지 생성.
스크립트: `docs/work/active/000187-lww-ui-ux/generate_image_or.py`
출력: `docs/work/active/000187-lww-ui-ux/designs/`

생성 화면:
- `v2_01_onboarding.png` — 온보딩 슬라이더
- `v2_02_job-select.png` — 직군 선택
- `v2_03_chat-interview.png` — 채팅 면접
- `v2_04_report.png` — 결과 리포트

프롬프트 전략:
- "Flat clean minimal UI, no illustrations, pure interface design"
- 브랜드 컬러 #0D9488 명시
- px 수치·컬러 코드 등 기술 명세는 프롬프트에서 제거 (모델이 UI 텍스트로 렌더링하는 문제 방지)
- "no duplicates, each tag appears only once" (직군 선택 화면)

### Step 2 — storyboard.md 갱신

변경 사항:
- 브랜드 컬러 `#7C3AED` → `#0D9488` (Teal, 확정)
- 생성된 시안 이미지 경로 삽입
- Phase 1~3 화면 추가 (02_storyboard-plan.md 기반)

### Step 3 — 컴포넌트 재구현

대상: `services/lww/src/components/`

화면별 재구현 범위:
- `onboarding/OnboardingSlider.tsx` — 슬라이드 레이아웃·타이포·인디케이터
- `onboarding/JobCategorySelector.tsx` — 칩 그리드, 터치 타깃 44px
- `chat/ChatBubble.tsx`, `ChatInput.tsx`, `ChatTopBar.tsx` — 카카오톡 스타일 개선
- `report/` — 점수 카드, 피드백 섹션, 그라데이션

Tailwind v4 규칙:
- 브랜드 컬러: `bg-[#0D9488]` 하드코딩 (CSS 변수 방식 미작동)
- `bg-[--color-background]` 등 무채색은 변수 사용 가능

### Step 4 — E2E 검증

```bash
cd services/lww && npx playwright test --reporter=list
```

3회 연속 PASS 필요.
