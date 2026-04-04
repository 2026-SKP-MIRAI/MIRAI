# siw PPT 발표 리서치 — 효과적인 발표를 위한 기법·순서·구성

> 작성: 2026-03-30
> 목적: siw 서비스 발표 자료를 효과적으로 재구성하기 위한 리서치 및 새 플랜
> 적용 대상: `06_pptx_layout.md` 및 `generate_presentation.js` 리비전

---

## 1. 피치덱 / 발표 구조 — 글로벌 기준

### 1-1. Y Combinator 권장 슬라이드 순서

YC는 "투자자는 슬라이드가 아닌 팀과 아이디어에 투자한다. 슬라이드는 아이디어를 명확하게 만드는 도구"라고 정의한다.

| # | 슬라이드 |
|---|---------|
| 1 | Company Purpose — 한 문장 설명 |
| 2 | **Problem** |
| 3 | **Solution** |
| 4 | **Why Now** |
| 5 | Market Size (TAM/SAM/SOM) |
| 6 | Product |
| 7 | Team |
| 8 | Traction / Metrics |

**핵심:** 슬라이드는 발표자의 말을 *대체*하는 게 아니라 *보조*한다. Problem-Solution이 무조건 먼저다.

출처: [YC — How to Build Your Seed Round Pitch Deck](https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck)

---

### 1-2. Airbnb 초기 피치덱 분석 (2009, $600K 유치)

```
Cover → Problem → Solution → Market Validation
→ Market Size → Product → Business Model
→ Competition → Competitive Advantages → Team → Financial
```

**배울 점:**
- **Cover**: 회사명 + 5~7단어 태그라인만 ("Book rooms with locals, rather than hotels")
- **Problem**: 3가지 문제를 동시에 제시 — 가격 / 문화 / 기술
- **Solution**: 기능(feature)이 아닌 혜택(benefit)으로 작성
- **Business Model**: 수익 구조를 단 하나의 슬라이드에 명확히

출처: [Airbnb 피치덱 분석 — Slidebean](https://slidebean.com/blog/airbnb-pitch-deck)

---

### 1-3. Guy Kawasaki 10/20/30 Rule

- **10 Slides**: 핵심만. 투자자는 연속 피칭을 봐서 집중력 유지가 핵심
- **20 Minutes**: 발표 20분, 나머지는 Q&A
- **30-Point Font**: 큰 폰트가 메시지를 압축하고 명확하게 만든다. 폰트 작으면 읽으려다 발표자 말을 안 들음

출처: [Pitchworx — Guy Kawasaki 10/20/30 Rule](https://pitchworx.com/the-10-20-30-rule-of-presentations-by-guy-kawasaki-explained/)

---

## 2. 스토리텔링 기법

### 2-1. Simon Sinek — 골든 서클 "Start With Why"

대부분의 발표: **What → How → Why** (기능 설명 → 방법 → 이유)

효과적인 발표: **Why → How → What** (존재 이유 → 방법 → 기능)

```
❌  "저희 서비스는 AI 면접 코칭 앱입니다. 자소서를 올리면..."
✅  "우리는 실력 있는 사람이 불안 때문에 떨어지는 게 불공평하다고 믿습니다.
    그래서 월 2만원으로 접근 가능한 AI 면접 코치를 만들었습니다."
```

출처: [Simon Sinek — The Golden Circle](https://simonsinek.com/golden-circle)

---

### 2-2. StoryBrand Framework — "고객이 영웅, 브랜드는 가이드"

"If you confuse, you lose." — 브랜드가 주인공이 아니라 *고객이 주인공*이다.

| 단계 | siw 적용 |
|------|---------|
| **A Character** (영웅 = 고객) | 취준생 — 면접이 두렵고, 준비할 돈도 시간도 부족한 |
| **Has a Problem** (외부·내부·철학) | 외부: 면접 준비 비용 300~500만 원 / 내부: 불안 / 철학: 이런 불평등이 맞나 |
| **Meets a Guide** (브랜드 = 가이드) | MirAI — "우리도 이 문제를 이해합니다" |
| **Who Gives a Plan** (3단계 플랜) | ① 자소서 업로드 ② AI 맞춤 면접 ③ 리포트로 성장 |
| **Calls to Action** | 무료로 시작하기 / Pro 월 19,900원 |
| **Avoids Failure** | 행동 안 하면 = 비싼 컨설팅 or 준비 없이 면접장 |
| **Ends in Success** | 자신감 있게 면접에 임하는 취준생 |

출처: [StoryBrand Framework — Creativeo](https://www.creativeo.co/post/storybrand-framework)

---

### 2-3. Barbara Minto — 피라미드 원칙 + SCQA

**Answer First**: 결론을 먼저, 근거는 그 다음.

**SCQA 오프닝 훅:**
```
Situation    → "취업 시장이 식고 있습니다. 대기업 신입 채용 43% 감소."
Complication → "그런데 면접은 더 중요해졌습니다. 92.1%가 면접으로 채용 결정."
Question     → "그렇다면 취준생은 어떻게 준비하고 있을까요?"
Answer       → "46.4%가 면접을 가장 어렵다고 느끼면서도 연 평균 2회밖에 경험하지 못합니다."
```

출처: [Pyramid Principle — WinningPresentations](https://winningpresentations.com/pyramid-principle-presentations/)

---

### 2-4. Nancy Duarte — Resonate & Sparkline

**Presentation Sparkline:** What Is(현재) ↔ What Could Be(가능성)을 반복하며 긴장-해소를 교차

```
[현재] 취업 시장 냉각, 면접 준비 비용 300~500만 원
[가능성] 월 19,900원으로 AI 면접 코치
[현재] 불안이 실력자를 떨어뜨린다 r=−0.19
[가능성] 준비하면 합격 가능성 2.3배
```

**STAR Moment**: 청중이 나중에 회자할 하나의 극적 순간을 의도적으로 설계.
→ siw에서의 STAR Moment: **"자소서를 올리면, AI가 나만의 면접관이 된다"** 순간

**One Message Per Slide**: 슬라이드 1장 = 아이디어 1개. Glance Test: 3초 내 슬라이드 의미 파악 가능해야.

출처: [Duarte — Resonate](https://www.duarte.com/resources/books/resonate/)

---

## 3. 데이터 / 감정 비율

TED Talk 500편 분석 결과:
- 효과적인 발표의 **감정 비중: 65%**
- 논리/데이터 비중: 10%
- 이야기 형식 정보: 사실 단독 대비 **22배 더 기억에 남음**

**최적 비율: 70% 이야기+인사이트 / 30% 증거+데이터**

실용 원칙: 감정적 공감이 없으면 논리와 데이터가 받아들여지지 않는다. **공감 먼저, 데이터는 확신을 주는 역할**.

출처: [TED Talk 오프닝 기법 — Moxie Institute](https://www.moxieinstitute.com/how-to-begin-speech-like-ted-talk/)

---

## 4. 한국 발표 문화 특이사항

### 4-1. PT 면접 / 데모데이 공통 원칙

- 구조: **문제 → 분석 → 해결 → 제안** 흐름이 평가자에게 가장 친숙
- 슬라이드당 핵심 메시지 1개. 발표자가 슬라이드를 읽으면 감점
- 발표자가 자신 있게 결론을 먼저 말하는 태도 → 신뢰감 형성
- 발표 5~10분 기준 슬라이드 5~8장 적정 (데모데이 기준 7~12장)

출처: [링커리어 — PT 면접 준비법](https://community.linkareer.com/employment_data/4151910)

### 4-2. 스파크랩 데모데이 우수팀 패턴

- 짧은 발표에서 **숫자 이야기만** 함 → 좋은 숫자 = 아름다운 비즈니스
- **APPENDIX 전략**: 5분 발표에서 의도적으로 상세 내용 생략 → Q&A 유도 → 준비성 어필
- 문제의 크기가 클수록 솔루션에 대한 관심 증가

출처: [스파크랩 데모데이 공식](https://sparklabsdemoday.com/)

---

## 5. 면접관 이형 스타일 분석

> 참고: 직접 채널 접근이 어려워 한국 발표 전문가·취업 유튜버 공통 패턴으로 분석

**한국 상위 발표 유튜버들의 공통 기법:**

| 기법 | 내용 |
|------|------|
| **훅 오프닝** | 첫 30초를 질문 또는 충격적 사실로 시작 — 자기소개로 시작 금지 |
| **숫자 3개 법칙** | 핵심 포인트는 3개로 압축. 청중이 기억할 수 있는 한계 |
| **반전 구조** | "나쁜 소식 → 더 나쁜 소식 → 그런데 해결책이 있다" |
| **Why Me** | 내가 이 문제를 왜 해결할 수 있는지를 반드시 포함 |
| **시각 우선** | 텍스트 최소화. 발표자의 말이 슬라이드보다 항상 더 풍부 |
| **결론 먼저** | 슬라이드 제목이 곧 결론. "A입니다 왜냐면 B, C, D" |
| **여백의 미** | 슬라이드 여백이 많을수록 핵심이 잘 보임 |

---

## 6. 종합: 효과적인 PPT를 위한 원칙 10가지

```
1. 감정 먼저, 데이터는 확신을 위한 도구
2. 고객(청중)이 영웅, 브랜드는 가이드 (StoryBrand)
3. Why → How → What 순서 (골든 서클)
4. 결론을 먼저 말하고 근거를 제시 (피라미드 원칙)
5. 슬라이드 1장 = 메시지 1개 (Duarte)
6. SCQA 오프닝: 상황 → 문제 → 질문 → 답변
7. What Is ↔ What Could Be 반복으로 긴장-해소 교차 (Sparkline)
8. STAR Moment: 청중이 기억할 하나의 극적 순간 의도 설계
9. 숫자는 임팩트 있게 — 큰 폰트, 하나의 핵심 수치
10. Glance Test: 3초 내 슬라이드 의미 파악 가능해야
```

---

## 7. 리서치 기반 siw PPT 재플랜

### 서사 설계: SCQA + StoryBrand + Sparkline 결합

```
[오프닝 훅 — 30초 안에 공감 확보]
  충격적 사실 하나: "대기업 신입 채용이 43% 감소했습니다."
  반전: "그런데 면접은 더 중요해졌습니다."

[Act 1 — 취준생의 현실 (What Is)]
  S01. 타이틀 — 훅
  S02. 식어가는 취업 시장 (Why Now 역설)
  S03. 면접이 더 중요해졌다 (92.1%)
  S04. 그런데 준비하지 못한다 (46.4% · 연 2회 · 455만원)
  S05. 불안이 실력자를 떨어뜨린다 (r=−0.19)

[전환 — Guide 등장]
  S06. 그래서, MirAI

[Act 2 — 솔루션 (What Could Be)]
  S07. 핵심 가치 제안 — Mirroring × Equivalence
  S08. 7가지 기능 개요 (4-Step)
  S09. 시장 + 비즈니스 모델

[Act 3 — 어떻게 만들었나 (How)]
  S10. 하네스 엔지니어링
  S11. 엔진-서비스 아키텍처 + 불변식

[Act 4 — 무엇을 만들었나 (What)]
  S12. 기능 01+02 (자소서 분석·피드백)
  S13. 기능 03+04 (패널 면접·꼬리질문)
  S14. 기능 05+07 (연습·8축 리포트)

[마무리 — STAR Moment]
  S15. What We Built + tagline
```

**총 15장** — Guy Kawasaki 10/20/30 원칙상 10장이 이상적이나
프로젝트 발표 특성상 기능·기술 설명이 포함되어 15장으로 압축.

### 슬라이드별 Glance Test 기준

| 슬라이드 | 3초 내 전달 메시지 |
|---------|-----------------|
| S01 | "면접 한 번이 당락을 결정한다" |
| S02 | "대기업 신입 43% 감소" |
| S03 | "기업 92.1%가 면접 중심 채용" |
| S04 | "46.4% 가장 어렵다 · 연 2회 · 455만원" |
| S05 | "r=−0.19 불안이 실력자를 떨어뜨린다" |
| S06 | "그래서, MirAI" |
| S07 | "자소서 올리면 AI 면접관" |
| S08 | "4-Step 7가지 기능" |
| S09 | "TAM 259억 · LTV/CAC 9.8x" |
| S10 | "Humans steer. Agents execute." |
| S11 | "siw(TS) ← HTTP → engine(Python)" |
| S12 | "PDF → 맞춤 질문 + 5항목 피드백" |
| S13 | "3인 패널 + CLARIFY·CHALLENGE·EXPLORE" |
| S14 | "즉각 피드백 + 8축 역량 리포트" |
| S15 | "자소서를 올리면, AI가 나만의 면접관" |

### 디자인 원칙 (보라 톤 + 감정 우선)

```
색상:
  - dark bg: #0D0620 (어두운 보라) — 감정 슬라이드
  - purple: #7C3AED — 주 강조
  - violet: #A855F7 — 보조
  - lavender: #C4B5FD — 밝은 accent
  - pink/rose: #EC4899 / #F43F5E — 위기감·문제 강조
  - offwhite: #FAF5FF — 설명 슬라이드

레이아웃:
  - 문제 슬라이드 (S02~S05): 큰 숫자 하나 + dark bg → 감정 우선
  - 전환 슬라이드 (S06): 여백 + 큰 텍스트 → STAR Moment
  - 설명 슬라이드 (S07~S14): light bg + 2-column card
  - 마무리 (S15): dark bg + tagline → 기억에 남는 마무리

타이포그래피:
  - 임팩트 숫자: 72~90pt bold
  - 슬라이드 타이틀: 26pt bold
  - 본문: 11~13pt
```

---

## 출처 목록

- [YC — How to Build Your Seed Round Pitch Deck](https://www.ycombinator.com/library/2u-how-to-build-your-seed-round-pitch-deck)
- [Sequoia Capital — Writing a Business Plan](https://articles.sequoiacap.com/writing-a-business-plan)
- [Guy Kawasaki 10/20/30 Rule — Pitchworx](https://pitchworx.com/the-10-20-30-rule-of-presentations-by-guy-kawasaki-explained/)
- [Airbnb 피치덱 분석 — Slidebean](https://slidebean.com/blog/airbnb-pitch-deck)
- [Simon Sinek — The Golden Circle](https://simonsinek.com/golden-circle)
- [StoryBrand Framework — Creativeo](https://www.creativeo.co/post/storybrand-framework)
- [Minto Pyramid Principle — WinningPresentations](https://winningpresentations.com/pyramid-principle-presentations/)
- [Barbara Minto MECE — McKinsey](https://www.mckinsey.com/alumni/news-and-events/global-news/alumni-news/barbara-minto-mece-i-invented-it-so-i-get-to-say-how-to-pronounce-it)
- [Nancy Duarte — Resonate](https://www.duarte.com/resources/books/resonate/)
- [TED Talk 오프닝 기법 — Moxie Institute](https://www.moxieinstitute.com/how-to-begin-speech-like-ted-talk/)
- [스타트업 발표 스토리텔링 — 2Slides](https://2slides.com/ko/blog/ai-presentation-maker-startups-pitch-decks)
- [IR덱 vs 피치덱 차이 — founders.company](https://founders.company/blog/3-things-for-ir-pitching/)
- [SparkLabs Demoday 공식](https://sparklabsdemoday.com/)
- [링커리어 — PT 면접 준비법](https://community.linkareer.com/employment_data/4151910)
- [링커리어 — PPT 발표 잘하는법](https://community.linkareer.com/employment_data/4134148)
- [Brunch — 발표 잘하는 척하는 방법](https://brunch.co.kr/@junbd/16)
- [PUBLY — PPT 발표 잘하는 법](https://publy.co/content/6560)
