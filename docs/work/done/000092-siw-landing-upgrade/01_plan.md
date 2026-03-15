# [#92] feat: siw 랜딩페이지 핵심 기능 섹션 문구 업그레이드 — 구현 계획

> 작성: 2026-03-15

---

## 완료 기준

- [ ] FEATURES 섹션 h2를 "핵심 기능"으로, p를 "면접 준비의 새로운 기준 — 이력서 분석부터 실전 면접, 데이터 피드백까지 하나의 AI가 모두 처리합니다."로 변경
- [ ] PERSONAS 섹션 h2를 "3가지 면접관 페르소나"로, 서브 문구를 연습 모드·실전 모드 내용 기반 마케팅 문체로 재작성
- [ ] 8축 평가 시스템 전용 섹션 추가 (id="evaluation") — "단순 점수가 아닌, 정밀한 분석으로 8개 평가 축을 독립적으로 분석합니다."
- [ ] NAV의 "평가시스템" 링크 href를 `#evaluation`으로 수정 (현재 `#features`로 잘못 연결)
- [ ] 기존 vitest 테스트 전부 통과 (텍스트 변경으로 인한 매처 업데이트 포함)

---

## 구현 계획

### Step 1: 랜딩페이지 텍스트 테스트 작성 (Red)

**파일**: `services/siw/tests/ui/landing-page.test.tsx` (신규 생성)

**필수 mock 설정**:
```ts
// jsdom에 IntersectionObserver 없음 → 반드시 stub 필요
beforeAll(() => {
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock("@/lib/supabase/browser", () => ({ createSupabaseBrowser: () => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }), signOut: vi.fn() } }) }))
vi.mock("@/components/landing/RadarChartInteractive", () => ({ default: () => <div data-testid="radar-chart" /> }))
vi.mock("@/components/landing/LayeredCardWrapper", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
```

**테스트 케이스 6개** (디자인 변경 반영):
1. FEATURES 배지 "핵심 기능" 렌더링 확인 (`getByText("핵심 기능")`)
2. FEATURES h2 "면접 준비의 새로운 기준" 렌더링 확인
3. PERSONAS h2 "실제 면접처럼, 더 실전같이" 렌더링 확인
4. evaluation 섹션 `id="evaluation"` 존재 확인 (`document.getElementById("evaluation")`)
5. EVALUATION h2 "단순 점수가 아닌," 포함 확인
6. NAV "평가시스템" 링크 `href="#evaluation"` 확인

현재 코드 기준으로 이 테스트는 실패(Red) 상태여야 함.

---

### Step 2: page.tsx 수정 (Green)

**파일**: `services/siw/src/app/(landing)/page.tsx`

> **디자인 레퍼런스**: `landing-preview.html`의 섹션 패턴 적용
> - `section-badge`: h2 위 pill 태그 (SVG 아이콘 + 라벨)
> - `section-h2`: `text-4xl md:text-5xl font-extrabold` (HTML: `3rem font-weight:800`)
> - `section-sub`: `text-lg text-[#6B7280] max-w-xl mx-auto` (HTML: `1.125rem`)
> - h2 핵심어에 `gradient-text` span 적용

---

**2-1. EVALUATION_AXES 상수 추가** (line 68 아래)
```ts
// NOTE: RadarChartInteractive.tsx의 AXES와 동일한 도메인 데이터
// TODO: 향후 공유 상수로 추출 예정 (landing-preview.html 기준 가중치/설명)
const EVALUATION_AXES = [
  { name: "기술 정확도", weight: 20, desc: "개념이 사실에 기반하는가" },
  { name: "설명 명확도", weight: 15, desc: "이해하기 쉽게 설명했는가" },
  { name: "문제 해결",   weight: 15, desc: "체계적 접근 방식을 보였는가" },
  { name: "의사소통",   weight: 15, desc: "논리적이고 간결한가" },
  { name: "논리 흐름",  weight: 10, desc: "답변 간 일관성이 있는가" },
  { name: "구체성",     weight: 10, desc: "수치와 사례를 포함했는가" },
  { name: "자신감",     weight:  8, desc: "확신을 가지고 답변했는가" },
  { name: "적응력",     weight:  7, desc: "후속 질문에 유연하게 대응했는가" },
]
```

---

**2-2. NAV href 수정** (line 154)
- Before: `{ label: "평가시스템", href: "#features" }`
- After:  `{ label: "평가시스템", href: "#evaluation" }`

---

**2-3. FEATURES 섹션 전체 교체** (line 286-307 범위)

구조: **배지 → h2(대형) → sub**
```tsx
{/* ── FEATURES ─────────────────────────────────────────────────────── */}
<section id="features" className="bg-[#F8F9FB] py-24">
  <div className="max-w-6xl mx-auto px-6">
    <FadeInSection>
      <div className="text-center mb-20">
        {/* 섹션 배지 */}
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6
          border border-cyan-200/60 bg-cyan-50/80 text-cyan-700">
          <Zap className="w-3.5 h-3.5" />
          핵심 기능
        </span>
        {/* h2: 3rem급 대형 */}
        <h2 className="text-4xl md:text-5xl font-extrabold text-[#111827] mb-4 leading-tight">
          면접 준비의 새로운 기준
        </h2>
        {/* sub: 1.125rem */}
        <p className="text-lg text-[#6B7280] max-w-xl mx-auto">
          이력서 분석부터 실전 면접, 데이터 피드백까지 — 하나의 AI가 모두 처리합니다.
        </p>
      </div>
    </FadeInSection>
    {/* 기존 FEATURES 카드 그리드 유지 */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {FEATURES.map((f, i) => ( ... ))}
    </div>
  </div>
</section>
```

---

**2-4. PERSONAS 섹션 헤더 교체** (line 312-316 범위)

구조: **배지("3가지 면접관 페르소나") → h2("실제 면접처럼, 더 실전같이") → sub**
```tsx
<div className="text-center mb-20">
  {/* 섹션 배지 */}
  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6
    border border-purple-200/60 bg-purple-50/80 text-purple-700">
    <Users className="w-3.5 h-3.5" />
    3가지 면접관 페르소나
  </span>
  {/* h2: HTML의 핵심 카피 */}
  <h2 className="text-4xl md:text-5xl font-extrabold text-[#111827] mb-4 leading-tight">
    실제 면접처럼,{" "}
    <span className="gradient-text">더 실전같이</span>
  </h2>
  {/* sub */}
  <p className="text-lg text-[#6B7280] max-w-xl mx-auto">
    각 페르소나는 고유한 질문 스타일과 평가 관점을 가집니다. 원하는 면접 유형을 선택해 집중 훈련하세요.
  </p>
</div>
```

---

**2-5. EVALUATION 섹션 신규 추가** (line 344 이후, PERSONAS와 CTA 사이)

구조: **배지("8축 평가 시스템") → h2("단순 점수가 아닌, 정밀한 분석") → sub → 4×2 axis 카드 그리드**
```tsx
{/* ── EVALUATION ──────────────────────────────────────────────────── */}
<section id="evaluation" className="bg-[#F8F9FB] py-24">
  <div className="max-w-6xl mx-auto px-6">
    <FadeInSection>
      <div className="text-center mb-20">
        {/* 섹션 배지 */}
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6
          border border-indigo-200/60 bg-indigo-50/80 text-indigo-700">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          8축 평가 시스템
        </span>
        {/* h2 */}
        <h2 className="text-4xl md:text-5xl font-extrabold text-[#111827] mb-4 leading-tight">
          단순 점수가 아닌,{" "}
          <span className="gradient-text">정밀한 분석</span>
        </h2>
        {/* sub */}
        <p className="text-lg text-[#6B7280] max-w-xl mx-auto">
          LLM-as-a-Judge 기술로 8개 평가 축을 독립적으로 분석합니다.
        </p>
      </div>
    </FadeInSection>
    {/* 4×2 axis 카드 */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {EVALUATION_AXES.map((axis, i) => (
        <FadeInSection key={i} delay={i * 60}>
          <div className="bg-white rounded-2xl p-5 border border-black/6 hover:-translate-y-1
            hover:border-purple-200 hover:shadow-lg hover:shadow-purple-50 transition-all duration-200 h-full">
            {/* 가중치 배지 */}
            <span className="inline-block text-xs font-bold text-[#6D28D9] bg-purple-50
              border border-purple-200 px-2 py-0.5 rounded-full mb-3">
              {axis.weight}%
            </span>
            <p className="text-sm font-bold text-[#1F2937] mb-1">{axis.name}</p>
            <p className="text-xs text-[#9CA3AF]">{axis.desc}</p>
          </div>
        </FadeInSection>
      ))}
    </div>
  </div>
</section>
```

---

### Step 3: 전체 테스트 통과 확인 + .ai.md 최신화

```bash
cd services/siw && npx vitest run
```

- 기존 11개 + 신규 5개 = 전체 16개 통과 확인
- `services/siw/src/app/(landing)/.ai.md` 최신화 (evaluation 섹션 추가 반영)

---

## ADR

- **Decision**: Option A (텍스트 전용 evaluation 섹션, EVALUATION_AXES 중복 정의)
- **Drivers**: 히어로 RadarChart 중복 방지, 이슈 범위 최소화, 기존 테스트 안정성
- **Alternatives**: Option B (RadarChartInteractive 재활용) — 히어로와 중복, 범위 초과
- **Why chosen**: 히어로에서 인터랙티브 차트로 시각적 임팩트 제공, evaluation 섹션은 8축을 명시적 카드로 설명하는 것이 정보 전달 효과 높음
- **Consequences**: 축 데이터 2곳 분산 — TODO 주석으로 추후 공유 상수 추출 예정
- **Follow-ups**: 별도 이슈로 RadarChartInteractive.AXES와 공유 상수 추출
