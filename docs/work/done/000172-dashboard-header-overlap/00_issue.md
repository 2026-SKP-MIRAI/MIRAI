# [seung] 대시보드 헤더 '새 면접 시작' 버튼과 로그아웃 버튼 겹침 수정

## 사용자 관점 목표
대시보드에서 '새 면접 시작' 버튼과 로그아웃 버튼이 겹치지 않아야 한다.

## 배경
- `layout.tsx`: 로그아웃 버튼이 `fixed top-3 right-4 z-50`으로 화면 우상단에 고정됨
- `dashboard/page.tsx`: 헤더가 `justify-between`으로 '새 면접 시작' 버튼을 오른쪽 끝에 배치함
- 두 버튼이 같은 위치(우상단)에 겹쳐 표시됨

## 완료 기준
- [x] 대시보드 헤더에서 '새 면접 시작' 버튼과 로그아웃 버튼이 겹치지 않음
- [x] 로그아웃 버튼이 항상 클릭 가능한 상태로 노출됨

## 구현 힌트
`dashboard/page.tsx` 헤더에 오른쪽 패딩 추가:
```diff
- <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
+ <header className="border-b border-gray-200 bg-white pl-6 pr-28 py-4 flex items-center justify-between">
```


---

## 작업 내역

### 2026-03-20 — 헤더 우측 패딩 조정으로 버튼 겹침 해소

**변경 파일:**
- `services/seung/src/app/dashboard/page.tsx` — 헤더 `px-6` → `pl-6 pr-28`
  - `layout.tsx`의 로그아웃 버튼이 `fixed top-3 right-4`(≈76px)를 차지하므로, 헤더 우측 패딩을 `pr-28`(112px)으로 확장해 겹침 방지
  - `layout.tsx`는 수정 불필요 — 로그아웃 버튼 위치는 그대로 유지
- `services/seung/src/app/dashboard/.ai.md` — 헤더 패딩 관련 내용 추가

