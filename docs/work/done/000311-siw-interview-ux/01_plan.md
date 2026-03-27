# [#311] feat: [siw] 면접 시작 UX 개선 — 이력서 없을 때 업로드 유도 + 로고 아이콘 정리 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [ ] `/interview/new` — 이력서 목록이 비어 있을 때 "이력서 업로드하러 가기" 버튼이 함께 표시되고, 클릭 시 `/resumes`로 이동한다
- [ ] 별 아이콘(`w-9 h-9 rounded-[10px]` star SVG) 이 제거된다
- [ ] MirAI 텍스트에 그라디언트 색상(`linear-gradient(135deg, #7C3AED, #4F46E5)`)이 적용되어 브랜드 식별이 유지된다

---

## 구현 계획

### Step 1 — `/interview/new`: 이력서 없을 때 버튼 추가

**파일**: `services/siw/src/app/(app)/interview/new/page.tsx`

- L181-182: `resumes.length === 0` 분기의 `<p>이력서를 먼저 업로드해주세요.</p>` 를 아래로 교체

```tsx
) : resumes.length === 0 ? (
  <div className="flex flex-col items-center gap-3 py-2">
    <p className="text-sm text-gray-400">이력서를 먼저 업로드해주세요.</p>
    <button
      onClick={() => router.push('/resumes')}
      className="text-sm font-semibold text-violet-600 hover:underline"
    >
      이력서 업로드하러 가기 →
    </button>
  </div>
```

- `router`는 파일 상단에 이미 `useRouter()` 사용 중인지 확인 후, 없으면 import 추가

---

### Step 2 — `login/page.tsx`: 별 아이콘 제거 + MirAI 그라디언트

**파일**: `services/siw/src/app/(auth)/login/page.tsx`

- L68-73: `<div className="w-9 h-9 rounded-[10px] ...">` + 내부 star SVG 전체 제거
- L74: `<span className="text-lg font-extrabold text-gray-800">MirAI</span>` →

```tsx
<span className="text-lg font-extrabold"
  style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
  MirAI
</span>
```

---

### Step 3 — `signup/page.tsx`: 별 아이콘 제거 + MirAI 그라디언트

**파일**: `services/siw/src/app/(auth)/signup/page.tsx`

- L144-149: `<div className="w-9 h-9 rounded-[10px] ...">` + 내부 star SVG 전체 제거 (모바일용 로고)
- L150: `<span className="text-lg font-extrabold text-gray-800">MirAI</span>` → 동일한 그라디언트 적용
- 데스크탑용 사이드 로고 영역도 동일 패턴으로 별 아이콘 존재 여부 확인 후 처리

---

### Step 4 — 테스트 코드 작성

**파일**: `services/siw/src/__tests__/interview-new-empty-resume.test.tsx` (신규)

- `resumes.length === 0` 상태에서 "이력서 업로드하러 가기" 버튼이 렌더링되는지 확인
- 버튼 클릭 시 `router.push('/resumes')` 호출되는지 확인
- `resumes.length > 0` 상태에서 버튼이 없는지 확인

---

### 주의사항

- `interview/new/page.tsx`의 `useRouter` 사용 여부 먼저 확인 (없으면 `import { useRouter } from 'next/navigation'` 추가)
- signup 페이지에 데스크탑용 별 아이콘이 별도로 존재할 수 있음 → Grep으로 추가 확인
- Sidebar.tsx는 이미 그라디언트 적용 완료 → 건드리지 않음
