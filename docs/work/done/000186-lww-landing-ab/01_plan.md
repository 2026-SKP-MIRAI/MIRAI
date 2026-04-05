# [#186] feat: [lww] 랜딩페이지 A/B 제작 — 수파노바(A) vs ui-ux-pro-max(B) 비교 후 최종 결정 — 구현 계획

> 작성: 2026-03-23

---

## 완료 기준

### Method A (수파노바)
- [ ] 수파노바 디자인 스킬로 HTML 초안 생성 → React 컴포넌트로 변환
- [ ] lww 브랜드 (Teal #0D9488, Pretendard) 커스터마이징 적용
- [ ] 나노바나나프로 히어로 영상 생성 (API 키 없으면 CSS gradient + 애니메이션 fallback)
- [ ] CSS `@keyframes` + `IntersectionObserver` 스크롤 트리거 애니메이션 적용
- [ ] `/landing-a` 라우트로 접근 가능

### Method B (ui-ux-pro-max)
- [ ] ui-ux-pro-max CLI로 lww 맞춤 디자인 시스템 생성
- [ ] 161 팔레트 + 50+ 스타일 중 lww 브랜드에 맞는 조합 선택
- [ ] `/landing-b` 라우트로 접근 가능

### 공통
- [ ] 페이지 구성 동일: 히어로 → 페인포인트 → 기능 소개 → CTA(면접 시작)
- [ ] 모바일 반응형 (375px 기준)
- [ ] 루트 div에 `w-full` 적용 (`globals.css`의 `body { align-items: center }` 대응)
- [ ] 각 랜딩 페이지 smoke test 통과
- [ ] Vercel 배포 확인

### 이 이슈 범위 밖
- `/` 최종 반영은 A/B 비교 후 별도 이슈에서 진행
- 기존 `(main)/page.tsx` (온보딩) → `/app` 또는 `/home` 이동은 별도 이슈

---

## 구현 계획

### Step 0: 공유 CTA 컴포넌트 생성

**파일**: `services/lww/src/components/landing/LandingCTA.tsx`

CTA 버튼은 A/B 양쪽에서 동일한 라우트 링크(`/resume` 또는 면접 시작 경로)를 사용하므로 단일 공유 컴포넌트로 구현한다.

**완료 조건**:
- `LandingCTA` 컴포넌트가 Next.js `Link`로 면접 시작 라우트를 가리킨다
- props로 버튼 텍스트, 스타일 variant를 받을 수 있다

---

### Step 1: Method A 구현 (`/landing-a`) — 수파노바

**파일 생성**:
- `services/lww/src/app/landing-a/page.tsx` — 페이지 라우트 (루트 div에 `w-full` 필수)
- `services/lww/src/app/landing-a/metadata.ts` — SEO 메타데이터
- `services/lww/src/components/landing-a/LandingHero.tsx` — 히어로 섹션
- `services/lww/src/components/landing-a/LandingPainPoints.tsx` — 페인포인트 섹션
- `services/lww/src/components/landing-a/LandingFeatures.tsx` — 기능 소개 섹션

**구현 상세**:
1. supanova-design-engine 스킬로 랜딩 HTML 초안 생성
2. 초안을 React/Tailwind 컴포넌트로 변환 (스킬 출력은 비결정적이므로 변환된 코드만 커밋)
3. lww 브랜드 적용: Teal `#0D9488`, Pretendard 폰트
4. 히어로 섹션 배경:
   - API 키 있으면: 나노바나나프로로 영상 생성 → `public/videos/hero.mp4` 저장
   - API 키 없으면 (기본 fallback): CSS `background: linear-gradient` + `@keyframes` 애니메이션
5. 스크롤 트리거 애니메이션: CSS `@keyframes` + `IntersectionObserver` (Framer Motion 사용 금지 — 40KB 번들 비용, 임시 페이지에 불필요한 의존성)
6. 공유 `LandingCTA` 임포트하여 CTA 섹션 구성

**완료 조건**:
- `/landing-a` 접근 시 히어로 → 페인포인트 → 기능 소개 → CTA 순서로 렌더링
- 375px 뷰포트에서 레이아웃 깨짐 없음
- `w-full`이 루트 div에 적용되어 전체 너비 차지

---

### Step 2: Method B 구현 (`/landing-b`) — ui-ux-pro-max

**파일 생성**:
- `services/lww/src/app/landing-b/page.tsx` — 페이지 라우트 (루트 div에 `w-full` 필수)
- `services/lww/src/app/landing-b/metadata.ts` — SEO 메타데이터
- `services/lww/src/components/landing-b/LandingHero.tsx` — 히어로 섹션
- `services/lww/src/components/landing-b/LandingPainPoints.tsx` — 페인포인트 섹션
- `services/lww/src/components/landing-b/LandingFeatures.tsx` — 기능 소개 섹션

**구현 상세**:
1. ui-ux-pro-max CLI 실행: `python3 skills/ui-ux-pro-max/scripts/search.py "interview landing" --design-system`
2. 생성된 디자인 시스템 기반으로 컴포넌트 구현
3. lww 브랜드 적용: Teal `#0D9488`, Pretendard 폰트
4. 스크롤 트리거 애니메이션: CSS `@keyframes` + `IntersectionObserver` (Framer Motion 사용 금지)
5. 공유 `LandingCTA` 임포트하여 CTA 섹션 구성

**완료 조건**:
- `/landing-b` 접근 시 히어로 → 페인포인트 → 기능 소개 → CTA 순서로 렌더링
- 375px 뷰포트에서 레이아웃 깨짐 없음
- `w-full`이 루트 div에 적용되어 전체 너비 차지

---

### Step 3: 테스트 작성

**파일 생성**:
- `services/lww/src/__tests__/landing-a.test.tsx`
- `services/lww/src/__tests__/landing-b.test.tsx`

**테스트 항목** (각 랜딩 페이지 공통):
1. **Smoke test**: 렌더링 오류 없이 마운트된다
2. **CTA 라우트 링크**: CTA 버튼의 `href`가 올바른 면접 시작 경로를 가리킨다
3. **375px 반응형**: 뷰포트 375px에서 레이아웃 요소가 존재한다
4. **이미지 접근성**: 모든 `<img>` 태그에 `alt` 텍스트가 존재한다

**완료 조건**:
- `npm run test` (vitest) 전체 통과
- 각 랜딩 페이지당 최소 4개 테스트 케이스

---

### Step 4: 검증 및 정리

1. `npm run build` 성공 확인
2. 브라우저에서 `/landing-a` vs `/landing-b` 직접 비교
3. `services/lww/.ai.md` 최신화 (랜딩 페이지 라우트 및 컴포넌트 구조 반영)
4. 불변식 위반 없음 확인

**완료 조건**:
- 빌드 오류 없음
- `.ai.md` 업데이트 완료

---

## A/B 평가 기준 (Step 4 비교 시 적용)

| 기준 | 설명 |
|------|------|
| 첫인상 | 팀 내부 투표 — "재밌겠다" 느낌이 드는가 |
| CTA 명확성 | CTA 버튼 위치가 직관적이고 눈에 띄는가 |
| 모바일 가독성 | 375px에서 텍스트·이미지·버튼이 편하게 읽히는가 |

---

## `/` 최종 반영 전략 (이 이슈 범위 밖)

- A/B 비교 후 선택된 버전을 `services/lww/src/app/page.tsx`로 이동 (새 root, `(main)` 그룹 밖)
- 기존 `(main)/page.tsx` (온보딩)은 `/app` 또는 `/home`으로 이동
- 위 작업은 **별도 이슈로 분리**하여 진행

---

## 파일 매니페스트

```
생성:
  services/lww/src/components/landing/LandingCTA.tsx        (공유)
  services/lww/src/app/landing-a/page.tsx
  services/lww/src/app/landing-a/metadata.ts
  services/lww/src/components/landing-a/LandingHero.tsx
  services/lww/src/components/landing-a/LandingPainPoints.tsx
  services/lww/src/components/landing-a/LandingFeatures.tsx
  services/lww/src/app/landing-b/page.tsx
  services/lww/src/app/landing-b/metadata.ts
  services/lww/src/components/landing-b/LandingHero.tsx
  services/lww/src/components/landing-b/LandingPainPoints.tsx
  services/lww/src/components/landing-b/LandingFeatures.tsx
  services/lww/src/__tests__/landing-a.test.tsx
  services/lww/src/__tests__/landing-b.test.tsx

수정:
  services/lww/.ai.md                                       (최신화)

수정 없음:
  기존 라우트 그룹 불변 — (main)/, (interview)/, resume/ 등
```

---

## 기술 결정 사항

| 결정 | 근거 |
|------|------|
| Framer Motion 미사용 | `package.json`에 없음, 40KB 번들 비용, 임시 A/B 페이지에 불필요한 의존성 |
| CSS `@keyframes` + `IntersectionObserver` | 제로 의존성 애니메이션, 번들 크기 영향 없음 |
| `w-full` 루트 div 필수 | `globals.css` body의 `align-items: center`가 콘텐츠 폭을 축소시킴 (선례: `resume/page.tsx:45`) |
| `LandingCTA`만 공유 | A/B 독립 비교를 위해 나머지 컴포넌트는 각각 독립 트리 유지 |
| 나노바나나프로 fallback | API 키 없는 환경에서도 빌드·렌더링 가능하도록 CSS gradient 대체 |

---

## 수파노바 스킬 활용 방법

1. supanova-design-engine 스킬로 랜딩 페이지 HTML 초안 생성
2. 생성된 HTML을 React + Tailwind 컴포넌트로 수동 변환
3. 스킬 출력은 비결정적이므로 변환된 코드만 git 관리 (스킬 원본 출력은 커밋하지 않음)

---

## 의존성

- 수파노바 스킬: 설치 완료 (4종)
- ui-ux-pro-max 스킬: 설치 완료
- 나노바나나프로: OpenRouter API 키 필요 (없으면 CSS fallback 자동 적용)
- **새 npm 패키지 추가 없음**

---

## ADR — Architecture Decision Record

### Decision
독립 라우트 방식(`/landing-a`, `/landing-b`)으로 A/B 랜딩페이지를 구현한다. 각 페이지는 `(main)` 라우트 그룹 밖에 배치하고, 컴포넌트 트리는 A/B 독립 유지, `LandingCTA`만 공유한다.

### Drivers
1. **전환율 우선** — 두 디자인 방법론의 차이를 최대한 표현해 "재밌겠다" 첫인상 비교
2. **구현 속도** — 기존 라우트 그룹을 건드리지 않고 독립 라우트로 빠른 병렬 구현
3. **유지보수성** — 패자 제거가 쉽도록 각 페이지를 자기완결적 디렉토리로 구성

### Alternatives Considered
| 대안 | 거부 이유 |
|------|---------|
| `(main)` 그룹 내 배치 | MobileShell + BottomTabBar가 랜딩페이지에 강제 적용됨 |
| 단일 페이지 + `variant` prop | 공유 컴포넌트가 A/B 디자인 자유도를 제한 |
| Framer Motion 애니메이션 | 40KB 번들 비용, `package.json` 미등록, 임시 페이지에 불필요 |
| 즉시 `/` 교체 | 기존 온보딩 플로우 영향 범위가 이 이슈를 초과 |

### Why Chosen
독립 라우트는 `/resume` 선례(기존 코드베이스 검증)가 있고, 두 디자인이 완전히 자유롭게 표현될 수 있으며, 최종 선택 후 패자 디렉토리를 통째로 삭제하면 정리가 완료된다.

### Consequences
- **긍정**: A/B 구조 분리로 공정한 비교, 기존 라우트 그룹 무영향, 패자 삭제 용이
- **부정**: 컴포넌트 일부 중복 (Hero, PainPoints, Features가 A/B 각각 존재)
- **중립**: `/` 최종 반영은 별도 이슈 필요 (온보딩 라우트 재배치 포함)

### Follow-ups
- A/B 비교 후 승자 결정 → `/` 반영 별도 이슈 생성
- 패자 디렉토리 (`landing-a/` 또는 `landing-b/`) 삭제
