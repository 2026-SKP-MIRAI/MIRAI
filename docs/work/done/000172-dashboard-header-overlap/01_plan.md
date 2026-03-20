# [#172] [seung] 대시보드 헤더 '새 면접 시작' 버튼과 로그아웃 버튼 겹침 수정 — 구현 계획

> 작성: 2026-03-20

---

## 완료 기준

- [x] 대시보드 헤더에서 '새 면접 시작' 버튼과 로그아웃 버튼이 겹치지 않음
- [x] 로그아웃 버튼이 항상 클릭 가능한 상태로 노출됨

---

## 구현 계획

### 원인 분석

| 파일 | 위치 | 현재 동작 |
|------|------|-----------|
| `services/seung/src/app/layout.tsx:45` | `fixed top-3 right-4 z-50` | 로그아웃 버튼이 화면 우상단에 고정됨 |
| `services/seung/src/app/dashboard/page.tsx:126` | `px-6 py-4 ... justify-between` | '새 면접 시작' 버튼이 헤더 우측 끝에 배치됨 |

두 버튼이 같은 위치(우상단)에 겹쳐 표시되어 로그아웃 버튼이 가려짐.

### 수정 방법

**Step 1 — `dashboard/page.tsx` 헤더 우측 패딩 추가** (1줄 수정)

```diff
- <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
+ <header className="border-b border-gray-200 bg-white pl-6 pr-28 py-4 flex items-center justify-between">
```

`px-6`(좌우 동일 패딩) → `pl-6 pr-28`(우측 패딩을 7rem으로 확장)

로그아웃 버튼의 폭(~60px) + `right-4`(16px) = 약 76px이므로 `pr-28`(112px)이면 충분히 겹치지 않음.

### 변경 파일

- `services/seung/src/app/dashboard/page.tsx` — 헤더 className 1줄 수정

### 주의사항

- `layout.tsx`는 수정 불필요 (로그아웃 버튼 위치는 그대로 유지)
- 모바일 화면에서도 `pr-28`이 충분한지 확인 (로그아웃 버튼 텍스트 길이 고정이므로 OK)
- 다른 페이지(`/resume`, `/login` 등)는 헤더 구조가 다르므로 영향 없음
