# [#186] 남은 작업 실행 플랜 — Method A 영상 + Method B 전체

> 작성: 2026-03-28
> 이 파일은 `01_plan.md`의 미완료 항목만 추려낸 실행 플랜이다.

---

## 현재 미완료 AC

### Method A
- [ ] 나노바나나프로로 히어로 섹션 배경 영상 생성

### Method B
- [ ] ui-ux-pro-max 스킬로 lww 맞춤 디자인 시스템 생성
- [ ] 161 팔레트 + 50+ 스타일 중 lww 브랜드에 맞는 조합 선택

### 공통
- [ ] A/B 비교 후 최종 버전을 `/`에 반영
- [ ] Vercel 배포 확인
- [ ] 불변식 위반 없음

---

## Step A-2: 나노바나나프로 히어로 영상 보완

### 전제 조건 확인
```bash
# .env.local에 OpenRouter API 키가 있는지 확인
grep -i "openrouter" services/lww/.env.local
```

키가 있으면 → 나노바나나프로 스킬(`openclaw-openclaw-nano-banana-pro`) 호출
키가 없으면 → CSS gradient fallback 유지 (이미 구현됨), 이 스텝 스킵

### 영상 생성 프롬프트 (키 있을 때)
```
주제: AI 면접 코치 랜딩페이지 히어로 배경 영상
스타일: 미래적이고 세련된 분위기, teal(#0D9488) 계열 색상
내용: 추상적인 네트워크/AI 패턴 또는 취업준비 느낌의 루프 영상
길이: 10~15초 루프
형식: mp4 또는 webm
```

### 영상 적용
- 저장 위치: `services/lww/public/videos/hero-a.mp4`
- `LandingHero.tsx`의 CSS gradient fallback을 `<video>` 태그로 교체
- `autoPlay muted loop playsInline` 속성 필수
- poster 이미지로 첫 프레임 스크린샷 지정 (로딩 전 공백 방지)

**완료 조건**: `/landing-a` 히어로 배경에 영상이 재생된다. 없으면 CSS fallback으로 그대로 진행.

---

## Step B: Method B 구현 — ui-ux-pro-max 스킬

### B-1. 디자인 시스템 생성
`/ui-ux-pro-max` 스킬 호출 시 전달할 컨텍스트:

```
서비스: MirAI (AI 면접 코치) — lww(Learn with Work) 서비스
타겟: 취업준비생, 20대 초중반
목표: "재밌겠다"는 첫인상 → 바로 면접 시작 유도
브랜드 컬러: Teal #0D9488 (primary), 흰색/밝은 배경
폰트: Pretendard
분위기: 전문적이면서도 친근하고 자신감 있는 톤
참고 영상: https://www.youtube.com/watch?v=2sNQ0Nvngdc
```

### B-2. 컴포넌트 구현

이미 생성된 파일들을 ui-ux-pro-max 디자인 시스템으로 업데이트:
- `services/lww/src/components/landing-b/LandingHero.tsx`
- `services/lww/src/components/landing-b/LandingPainPoints.tsx`
- `services/lww/src/components/landing-b/LandingFeatures.tsx`
- `services/lww/src/app/landing-b/page.tsx`

**구현 기준**:
- 161 팔레트 중 Teal 계열 + lww 브랜드 조합 선택 → 선택 근거를 코드 주석에 1줄 기록
- `w-full` 루트 div 필수 (`globals.css` body align-items 대응)
- CSS `@keyframes` + `IntersectionObserver` 스크롤 애니메이션 (Framer Motion 사용 금지)
- 공유 `LandingCTA` 임포트 유지

**완료 조건**: `/landing-b` 접근 시 히어로 → 페인포인트 → 기능 소개 → CTA 렌더링, 375px 깨짐 없음

---

## Step C: 테스트 & 빌드 검증

```bash
cd services/lww
npm run test        # vitest — landing-a, landing-b smoke test 통과 확인
npm run build       # 빌드 오류 없음 확인
```

기존 `__tests__` 디렉토리가 이미 있으니 테스트 파일이 없으면 추가:
- `services/lww/src/app/landing-b/__tests__/`
- 최소 4개 케이스: 마운트, CTA href, 이미지 alt, 핵심 텍스트 존재

---

## Step D: A/B 비교 & 최종 결정

브라우저에서 직접 비교:
| URL | 방법론 |
|-----|--------|
| `/landing-a` | 수파노바 + 나노바나나프로 영상 + 스크롤 애니메이션 |
| `/landing-b` | ui-ux-pro-max 디자인 시스템 |

평가 기준:
- "재밌겠다" 첫인상
- CTA 버튼 명확성
- 375px 모바일 가독성

**결정 후**: `00_issue.md`의 "A/B 비교 후 최종 버전 반영" AC를 체크하고 결과를 기록.
`/` 실제 반영은 별도 이슈 (이 이슈 범위 밖).

---

## Step E: 불변식 & 배포 확인

```bash
# 불변식 체크 (아키텍처 위반 없음)
# 1. 서비스가 직접 LLM 호출하지 않는지 확인
grep -r "openai\|anthropic\|claude" services/lww/src --include="*.ts" --include="*.tsx" | grep -v "node_modules\|__tests__"

# 2. 서비스 간 직접 통신 없는지 확인
grep -r "localhost:3" services/lww/src --include="*.ts" --include="*.tsx" | grep -v "node_modules"
```

Vercel 배포: `git push` 후 Vercel 대시보드에서 `/landing-a`, `/landing-b` 접근 확인.

---

## 실행 순서 요약

```
A-2 (영상, 선택적) → B (ui-ux-pro-max 스킬 호출 → 컴포넌트) → C (테스트·빌드) → D (A/B 비교) → E (불변식·배포)
```

**A-2와 B는 독립적 — 병렬 진행 가능**
