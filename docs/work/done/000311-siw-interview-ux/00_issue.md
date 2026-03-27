# feat: [siw] 면접 시작 UX 개선 — 이력서 없을 때 업로드 유도 + 로고 아이콘 정리

## 사용자 관점 목표
이력서 없는 사용자가 면접 시작 페이지에서 막히지 않고 자연스럽게 업로드로 유도되며, 사이드바 로고가 깔끔하게 정리된다.

## 배경
1. `/interview/new` 페이지에서 이력서가 없을 때 \"이력서를 먼저 업로드해주세요.\" 텍스트만 표시되고 다음 동선이 없어 사용자가 막힘
2. 사이드바/헤더에 별 모양 아이콘(`rounded-[10px]` + star SVG, indigo-violet 그라디언트 배경)이 있는데 디자인상 불필요함. 옆의 MirAI 텍스트에 색상(그라디언트)을 넣어 아이콘 없이도 브랜드가 살도록 정리

## 완료 기준
- [x] `/interview/new` — 이력서 목록이 비어 있을 때 \"이력서 업로드하러 가기\" 버튼이 함께 표시되고, 클릭 시 `/resumes`로 이동한다
- [x] 별 아이콘(`w-9 h-9 rounded-[10px]` star SVG) 이 제거된다
- [x] MirAI 텍스트에 그라디언트 색상(`linear-gradient(135deg, #7C3AED, #4F46E5)`)이 적용되어 브랜드 식별이 유지된다

## 구현 플랜
1. `services/siw/src/app/(app)/interview/new/page.tsx` L181 — `resumes.length === 0` 분기에 `<button onClick={() => router.push('/resumes')}>` 추가
2. 별 아이콘 위치 탐색: `rounded-\[10px\]` + star path로 grep → 해당 컴포넌트에서 아이콘 div 제거, MirAI `<span>` 에 그라디언트 스타일 적용 (Sidebar.tsx는 이미 적용됨 — 다른 컴포넌트 확인 필요)

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 2026-03-27

**현황**: 3/3 완료

**완료된 항목**:
- `/interview/new` — 이력서 없을 때 "이력서 업로드하러 가기" 버튼 추가
- 별 아이콘(`w-9 h-9 rounded-[10px]` star SVG) 제거 (login, signup 페이지)
- MirAI 텍스트에 그라디언트 색상 적용 (login, signup 페이지)

**미완료 항목**:
- (없음)

**변경 파일**: 7개

---

#### 변경 파일 상세

**`services/siw/src/app/(app)/interview/new/page.tsx`**
- `resumes.length === 0` 분기에 단순 텍스트 대신 빈 상태 UI 추가
- FileText 아이콘 + 설명 텍스트 + "이력서 업로드하러 가기" 버튼 구성
- 버튼 클릭 시 `router.push('/resumes')` 연결
- 버튼 디자인: 그라디언트 배경, ArrowRight 아이콘, hover 시 화살표 이동, active 눌림 피드백

**`services/siw/src/app/(auth)/login/page.tsx`**
- `w-9 h-9 rounded-[10px]` 별 아이콘 div 및 star SVG 제거
- MirAI `<span>`에 기존 `.gradient-text` CSS 클래스 적용 (인라인 스타일 대신)

**`services/siw/src/app/(auth)/signup/page.tsx`**
- login과 동일 — 모바일용 로고 영역의 별 아이콘 제거, `.gradient-text` 적용

**`services/siw/src/app/(app)/interview/new/__tests__/page.test.tsx`** (신규)
- 빈 이력서 상태에서 버튼 렌더링 및 `/resumes` 이동 검증 (5개 테스트)

**`services/siw/src/app/(auth)/__tests__/logo-branding.test.tsx`** (신규)
- login/signup 별 아이콘 제거 및 `.gradient-text` 클래스 적용 검증 (7개 테스트)

**`.ai.md` 2개**: interview/new, (auth) 디렉토리 최신화

