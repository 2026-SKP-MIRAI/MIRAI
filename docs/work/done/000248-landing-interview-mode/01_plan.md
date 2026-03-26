# [#248] feat: [siw] 랜딩페이지 페르소나 섹션 하단에 면접 모드(실전/연습) 소개 추가 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

- [ ] 랜딩페이지 페르소나 섹션 하단에 실전 모드·연습 모드 소개 카드 2개 추가
- [ ] `interview/new/page.tsx`의 모드 선택 디자인 톤과 일관성 유지
- [ ] 기존 FadeInSection 애니메이션 적용
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 구현 계획

### RALPLAN-DR 요약

**Principles**
1. 기존 패턴 준수 (데이터 상수 + `.map()` + FadeInSection + glass-card)
2. `interview/new/page.tsx` 디자인 톤 일관성 (copy, 색상 그대로)
3. 최소 변경 범위 (1개 파일 주수정)
4. 테스트 가능성

**Decision Drivers**
1. AC 충족 (페르소나 섹션 하단 삽입, 디자인 일관성, FadeInSection)
2. 기존 코드베이스 패턴 준수
3. 최소 변경으로 리스크 억제

**Option A (채택)**: PERSONAS 섹션 내부 하단 삽입
- pros: 최소 변경, 섹션 맥락 일관성, 기존 패턴 준수
- cons: 섹션이 길어짐 (persona 3 + mode 2 카드)

**Option B (기각)**: 독립 섹션으로 분리
- 이유: 불필요한 구조 분리, NAV 앵커 추가 등 과도한 범위 확장

---

### Step 1 — INTERVIEW_MODES 상수 배열 추가

**파일**: `services/siw/src/app/(landing)/page.tsx`
**위치**: 파일 상단 데이터 상수 영역 (PERSONAS 배열 다음)

```ts
// NOTE: 면접 모드 설명은 interview/new/page.tsx 모드 선택 UI와 동기화 필요
const INTERVIEW_MODES = [
  {
    icon: "⚡",
    title: "실전 모드",
    desc: "면접처럼 진행\n즉각 피드백 없음",
    borderColor: "border-indigo-500",
    bgColor: "bg-indigo-50",
    tagColor: "text-indigo-700",
  },
  {
    icon: "📝",
    title: "연습 모드",
    desc: "즉각 AI 피드백\n재답변 가능",
    borderColor: "border-violet-500",
    bgColor: "bg-violet-50",
    tagColor: "text-violet-700",
  },
] as const;
```

**주의사항**:
- Tailwind 퍼지 대응: 동적 className은 완전한 문자열 객체로 선언
- desc 줄바꿈: `whitespace-pre-line` 또는 `<br/>` 처리

---

### Step 2 — 모드 소개 서브섹션 JSX 삽입

**파일**: `services/siw/src/app/(landing)/page.tsx`
**위치**: PERSONAS 그리드(`div.grid`) 닫힌 직후, `</div></section>` 직전 (line 371~373 사이)

```tsx
{/* ── 면접 모드 소개 ─────────────────────────────────── */}
<FadeInSection delay={100}>
  <div className="mt-12">
    <h3 className="text-xl font-bold text-[#111827] text-center mb-6">
      면접 모드 선택
    </h3>
    <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
      {INTERVIEW_MODES.map((m, i) => (
        <div
          key={i}
          className={`glass-card rounded-2xl p-5 border ${m.borderColor} ${m.bgColor}`}
        >
          <p className={`font-bold text-sm mb-1 ${m.tagColor}`}>
            {m.icon} {m.title}
          </p>
          <p className="text-xs text-gray-500 leading-[1.6] whitespace-pre-line">
            {m.desc}
          </p>
        </div>
      ))}
    </div>
  </div>
</FadeInSection>
```

**주의사항**:
- `cursor-pointer` **제거** (PERSONAS 카드와 달리 비인터랙티브)
- `glass-card-hover` 생략 권장 (클릭 불가 카드에 hover elevation은 UX friction)
- 색상 className은 INTERVIEW_MODES 객체에서 주입 (Tailwind 퍼지 안전)

---

### Step 3 — 테스트 작성

**파일**: `services/siw/tests/ui/landing-page.test.tsx`

```ts
it("페르소나 섹션 하단에 실전 모드 카드가 렌더링된다", () => {
  render(<LandingPage />);
  expect(screen.getByText(/실전 모드/)).toBeInTheDocument();
  expect(screen.getByText(/즉각 피드백 없음/)).toBeInTheDocument();
});

it("페르소나 섹션 하단에 연습 모드 카드가 렌더링된다", () => {
  render(<LandingPage />);
  expect(screen.getByText(/연습 모드/)).toBeInTheDocument();
  expect(screen.getByText(/즉각 AI 피드백/)).toBeInTheDocument();
});
```

**주의사항**: 텍스트 assert로 copy drift 방지 (interview/new와 desc 동기화 검증)

---

### Step 4 — .ai.md 최신화

**파일**: `services/siw/src/app/(landing)/.ai.md`
- 면접 모드 소개 섹션 추가 사실 반영
- INTERVIEW_MODES 상수 추가 언급
