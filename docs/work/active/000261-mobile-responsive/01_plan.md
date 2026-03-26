# [#261] 전체 페이지 모바일 반응형 대응 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [x] 랜딩페이지 모바일에서 섹션·카드 레이아웃이 정상 표시된다 (이미 반응형 적용됨)
- [x] 앱 레이아웃 Sidebar가 모바일에서 햄버거 메뉴로 동작한다 (이미 구현됨)
- [x] 대시보드 카드 그리드가 모바일에서 적절히 전환된다 (이미 grid-cols-2 md:grid-cols-4)
- [x] 면접 세션 페이지 채팅 UI가 모바일에서 전체 너비로 표시된다 (max-w-5xl w-full px-4)
- [x] 리포트 페이지 레이더 차트·카드가 모바일에서 깨지지 않는다 (grid-cols-1 md:grid-cols-2 적용)
- [x] 이력서 목록 버튼 flex-wrap 적용
- [x] 성장 추이 페이지 하단 2열 → 모바일 1열 전환
- [x] 회원가입·로그인 페이지 폼이 모바일에서 정상 표시된다 (max-w-md 사용)
- [x] 운영 현황 대시보드 그리드 반응형 적용

---

## 구현 계획

1. ReportResult: grid-cols-2 → grid-cols-1 md:grid-cols-2, 총점 폰트 반응형
2. growth/page: 하단 grid-cols-2 → grid-cols-1 md:grid-cols-2
3. resumes/page: 버튼 영역 flex-wrap 추가
4. interview/new: 페르소나 grid-cols-3 → grid-cols-1 sm:grid-cols-3
5. ObservabilityDashboard: 모든 grid-cols-4 → grid-cols-2 md:grid-cols-4, grid-cols-3 → 반응형
