# feat: [lww] 랜딩페이지 A/B 제작 — 수파노바(A) vs ui-ux-pro-max(B) 비교 후 최종 결정

## 사용자 관점 목표

lww 서비스를 처음 접하는 취준생이 랜딩페이지에서 "재밌겠다"는 첫인상을 받고 바로 면접을 시작하도록 유도한다.

## 배경

두 가지 디자인 방법론으로 랜딩페이지를 각각 제작한 뒤 비교해 최종 구현을 결정한다.

- **Method A** — 수파노바 디자인 스킬 (uxjoseph/supanova-design-skill) + 나노바나나프로 히어로 영상 + 스크롤 애니메이션
- **Method B** — ui-ux-pro-max 스킬 (nextlevelbuilder/ui-ux-pro-max-skill) 디자인 인텔리전스 적용

참고 영상: https://www.youtube.com/watch?v=2sNQ0Nvngdc

## 완료 기준

### Method A (수파노바)
- [x] 수파노바 디자인 스킬 4종 설치 완료 (supanova-design-engine, supanova-premium-aesthetic, supanova-redesign-engine, supanova-full-output)
- [x] lww 브랜드 (Teal #0D9488, Pretendard) 커스터마이징 적용
- [ ] 나노바나나프로로 히어로 섹션 배경 영상 생성
- [x] 스크롤 트리거 애니메이션 적용
- [x]  라우트로 접근 가능

### Method B (ui-ux-pro-max)
- [ ] ui-ux-pro-max CLI로 lww 맞춤 디자인 시스템 생성
- [ ] 161 팔레트 + 50+ 스타일 중 lww 브랜드에 맞는 조합 선택
- [x]  라우트로 접근 가능

### 공통
- [x] 페이지 구성 동일: 히어로 → 페인포인트 → 기능 소개 → CTA(면접 시작)
- [x] 모바일 반응형 (375px 기준)
- [ ] A/B 비교 후 최종 버전을 에 반영
- [ ] Vercel 배포 확인

## 구현 플랜

1. Method A 구현 ()
   - 수파노바 스킬로 초안 생성 → lww 브랜드 커스터마이징
   - 나노바나나프로 히어로 영상 생성 후 삽입
   - 스크롤 애니메이션 적용

2. Method B 구현 ()
   - ui-ux-pro-max CLI 실행: `python3 skills/ui-ux-pro-max/scripts/search.py "interview landing" --design-system`
   - 생성된 디자인 시스템 기반으로 컴포넌트 구현

3. 브라우저에서  vs  직접 비교
4. 최종 결정 →  반영

## 의존성

- 수파노바 스킬 ✅ 설치 완료 (4종)
- ui-ux-pro-max 스킬 ✅ 설치 완료
- 나노바나나프로: OpenRouter API 키 필요

## 개발 체크리스트

- [x] `services/lww/.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-23

**현황**: 1/14 완료

**완료된 항목**:
- 수파노바 디자인 스킬 4종 설치 완료

**미완료 항목**:
- lww 브랜드 커스터마이징 적용
- 나노바나나프로로 히어로 섹션 배경 영상 생성
- 스크롤 트리거 애니메이션 적용
- /landing-a 라우트로 접근 가능
- ui-ux-pro-max CLI로 lww 맞춤 디자인 시스템 생성
- 161 팔레트 + 50+ 스타일 중 lww 브랜드에 맞는 조합 선택
- /landing-b 라우트로 접근 가능
- 페이지 구성 동일 (히어로 → 페인포인트 → 기능 소개 → CTA)
- 모바일 반응형 (375px 기준)
- A/B 비교 후 최종 버전 반영
- Vercel 배포 확인
- services/lww/.ai.md 최신화
- 불변식 위반 없음

**변경 파일**: 0개

### 2026-03-28

**현황**: 8/14 완료

**완료된 항목**:
- 수파노바 디자인 스킬 4종 설치 완료
- lww 브랜드 (Teal #0D9488, Pretendard) 커스터마이징 적용
- 스크롤 트리거 애니메이션 적용 (landing-a)
- /landing-a 라우트로 접근 가능 (page.tsx 생성)
- /landing-b 라우트로 접근 가능 (page.tsx 생성)
- 페이지 구성 동일: 히어로 → 페인포인트 → 기능 소개 → CTA
- 모바일 반응형 (375px 기준) - Tailwind 반응형 클래스 적용
- services/lww/.ai.md 최신화

**미완료 항목**:
- 나노바나나프로로 히어로 섹션 배경 영상 생성
- ui-ux-pro-max CLI로 lww 맞춤 디자인 시스템 생성
- 161 팔레트 + 50+ 스타일 중 lww 브랜드에 맞는 조합 선택
- A/B 비교 후 최종 버전 반영
- Vercel 배포 확인
- 불변식 위반 없음

**변경 파일**: 6개 (landing-a/b 라우트·컴포넌트, .ai.md)

### 2026-04-05

**현황**: 9/14 완료 — PR 준비 (랜딩 A 최종 결정)

**최종 결정**: 랜딩 A (수파노바 프리미엄 다크 디자인) 채택. / 반영은 별도 이슈로 진행.

**완료된 항목**:
- 수파노바 디자인 스킬 4종 설치 완료
- lww 브랜드 (Teal #0D9488, Pretendard) 커스터마이징 적용
- 스크롤 트리거 애니메이션 적용 (CSS @keyframes + IntersectionObserver)
- /landing-a 라우트로 접근 가능
- /landing-b 라우트로 접근 가능
- 페이지 구성 동일: 히어로 → 페인포인트 → 기능 소개 → CTA
- 모바일 반응형 (375px 기준)
- services/lww/.ai.md 최신화
- 불변식 위반 없음

**미완료 항목 (의도적 스킵)**:
- 나노바나나프로 히어로 영상 → 정적 이미지(hero-a.png)로 대체 (API 키 없음)
- ui-ux-pro-max CLI 디자인 시스템 → 수동 구현으로 대체
- 161 팔레트 조합 선택 → 동일
- A/B 비교 후 / 반영 → 별도 이슈 범위 (01_plan.md ADR 명시)
- Vercel 배포 확인 → 머지 후 확인 예정

**코드 품질**:
- clearTimeout cleanup 누락 → 4개 컴포넌트(landing-a/b PainPoints, Features) 수정

**변경 파일**: 19개 (landing-a/b 라우트·컴포넌트·테스트, 공유 LandingCTA, hero-a.png, .ai.md)

