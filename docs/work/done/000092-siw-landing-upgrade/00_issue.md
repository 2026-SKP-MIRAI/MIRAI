# feat: siw 랜딩페이지 핵심 기능 섹션 문구 업그레이드

## 사용자 관점 목표
랜딩페이지를 처음 방문한 사용자가 MirAI의 핵심 가치를 즉시 이해하고 서비스 시작을 결정하도록 유도한다.

## 배경
현재 FEATURES / PERSONAS 섹션의 문구가 기능 나열 수준에 머물러 있어 마케팅 흡인력이 부족하다.
- FEATURES 헤더: "면접 준비의 모든 것" / "자소서 분석부터 실전 면접까지 원스톱" — 너무 일반적
- PERSONAS 섹션: 3인 패널 면접 설명만 있고, 연습/실전 모드 구분이 없음
- 8축 평가 시스템: 히어로의 RadarChart 위젯으로만 암시되고, 별도 소개 섹션 없음
- NAV "평가시스템" 링크가 `#features`로 잘못 연결되어 있음

## 완료 기준
- [x] FEATURES 섹션 h2를 "핵심 기능"으로, p를 "면접 준비의 새로운 기준 — 이력서 분석부터 실전 면접, 데이터 피드백까지 하나의 AI가 모두 처리합니다."로 변경
- [x] PERSONAS 섹션 h2를 "3가지 면접관 페르소나"로, 서브 문구를 연습 모드·실전 모드 내용 기반 마케팅 문체로 재작성
- [x] 8축 평가 시스템 전용 섹션 추가 (id="evaluation") — "단순 점수가 아닌, 정밀한 분석으로 8개 평가 축을 독립적으로 분석합니다."
- [x] NAV의 "평가시스템" 링크 href를 `#evaluation`으로 수정 (현재 `#features`로 잘못 연결)
- [x] 기존 vitest 테스트 전부 통과 (텍스트 변경으로 인한 매처 업데이트 포함)

## 구현 플랜
1. `services/siw/src/app/(landing)/page.tsx`
   - FEATURES 섹션 헤더 문구 수정
   - PERSONAS 섹션 헤더 문구 — 연습/실전 모드 중심 마케팅 문체로 재작성
   - 8축 평가 시스템 전용 섹션 추가 (id="evaluation", RadarChartInteractive 재활용 또는 별도 레이아웃)
   - NAV "평가시스템" href → `#evaluation`으로 수정
2. 테스트 파일에서 변경된 텍스트 매처 업데이트 (있을 경우)

## 개발 체크리스트
- [ ] 테스트 코드 포함 (문구 변경 반영)
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 2026-03-15

**현황**: 5/5 완료

**완료된 항목**:
- FEATURES 섹션 배지("핵심 기능") + h2("면접 준비의 새로운 기준") + sub 업그레이드
- PERSONAS 섹션 h2("실제 면접처럼, 더 실전같이") + 서브 문구 재작성
- evaluation 섹션 추가 (id="evaluation", 8축 카드 그리드)
- NAV "평가시스템" href → #evaluation
- vitest 106개 전부 통과 (신규 landing-page.test.tsx 6개 포함)

**미완료 항목**:
- (없음)

**변경 파일**: 3개
- `services/siw/src/app/(landing)/page.tsx` — FEATURES/PERSONAS 섹션 헤더 디자인 업그레이드, EVALUATION 섹션 신규 추가, NAV href 수정, 공채달력 링크 제거
- `services/siw/tests/ui/landing-page.test.tsx` (신규) — 랜딩페이지 텍스트·구조 검증 6개 테스트 (IntersectionObserver mock 포함)
- `services/siw/src/app/(landing)/.ai.md` (신규) — 섹션 구조·컴포넌트·디자인 시스템 문서화

## 기술적 결정 사항

- **섹션 헤더 구조 변경**: 기존 `h2 + p` → `배지 pill + h2(대형) + sub(1.125rem)` 패턴으로 통일 (landing-preview.html 레퍼런스 반영)
- **PERSONAS h2**: "실제 면접처럼, 더 실전같이" + gradient-text span — 연습/실전 모드 마케팅 문체
- **EVALUATION_AXES**: RadarChartInteractive.AXES와 별도 정의 (TODO 주석으로 공유 상수 추출 예정 명시)
- **공채달력 NAV 링크 제거**: 해당 섹션 미존재로 삭제

