# feat: [seung] UI 고도화

## 사용자 관점 목표
서비스 전반의 UI가 깔끔하고 일관성 있게 정돈되어 있어, 면접 준비에 집중할 수 있는 사용자 경험을 제공한다.

## 배경
작업 범위: services/seung (Next.js)

현재 모든 페이지가 기능 중심으로 구현되어 있어 시각적 완성도를 높일 여지가 있다. 핵심 기능(인증, 대시보드, 면접, 리포트, 서류 진단)이 완성된 시점에서 전체 페이지 UI를 고도화해 서비스 완성도를 높인다.

## 완료 기준
- [x] `/login`, `/signup` 페이지 UI 고도화
- [x] `/resume` 페이지 UI 고도화 — 업로드 폼, 질문 리스트, 면접 시작/서류 진단 분기 카드
- [x] UploadForm 드래그&드롭 + 파일 크기(5MB 이하)·형식(PDF) 안내 텍스트 추가
- [x] `/interview` 페이지 UI 고도화 — 채팅 UI, 답변 입력 폼, 리포트 생성 버튼
- [x] `/report` 페이지 UI 고도화 — 총점, 8축 점수, 피드백 레이아웃
- [x] `/diagnosis` 페이지 UI 고도화 — 항목별 점수, 강점·약점·개선 방향
- [x] `/dashboard` 페이지 UI 고도화 (이슈 #157 이후)
- [x] 전체 페이지 공통 색상·타이포그래피·간격 일관성 확보
- [x] 로딩·에러·빈 상태 피드백 UI 일관성 확보
- [x] 모바일 반응형 대응
- [x] 기존 Vitest/E2E 회귀 없음 (UI 변경으로 인한 셀렉터 업데이트 포함)

## 구현 플랜
1. 공통 색상·타이포그래피·간격 기준 정의 (Tailwind 토큰 활용)
2. 공통 컴포넌트 정비 (Button, Card, Input, Badge 등)
3. 페이지별 순차 적용 (login/signup → resume → interview → report → diagnosis → dashboard)
4. E2E 셀렉터 업데이트

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음


---

## 작업 내역

- 랜딩 페이지(`/`) 신규 구현: 2열 히어로, 채팅 목업, 이용 방법 3단계, 하단 CTA
- 로그인/회원가입 CTA 버튼 색상 통일, Suspense 래퍼 추가, Link 컴포넌트 교체
- Resume 페이지: sticky 헤더, Step 배지, 면접 모드 선택 그리드
- Interview 페이지: 스피너 로딩, 모드 배지, 나가기 confirm, beforeunload
- Diagnosis/Report 페이지: SVG 원형 게이지 + 등급 배지, 수평 스코어바(RadarChart 제거), 강점·약점 카드 재설계
- Dashboard 페이지: 스피너 로딩, PDF 아이콘 카드, 색상 계층 액션 버튼, EmptyState
- globals.css: body font-family를 Geist 우선으로 수정
- 로그아웃 시 `/login` → `/` 리다이렉트
- Vitest 137/137 통과
