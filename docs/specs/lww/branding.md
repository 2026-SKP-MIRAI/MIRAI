# lww 브랜드 가이드

> 서비스: lww ("취업준비부터 직장생활까지, 재밌게")
> 포지셔닝: "Duolingo for 면접" — 유쾌함 · 쉬움 · 성장
> UI 레퍼런스: LinkedIn(프로필·피드·채용) + 당근마켓(친근한 채팅·커뮤니티 UX) + 블라인드(익명 게시판)

---

## 1. 키 컬러 옵션

경쟁사 컬러 회피 원칙을 기반으로 3가지 팔레트 옵션을 제안한다. 최종 선택은 팀이 결정한다.

### 회피 목록

| 브랜드 | 회피 컬러 |
|--------|----------|
| 사람인 | 주황/레드 계열 |
| 잡다 | 파랑 계열 (#0062FF 등) |
| 뷰인터 | 차가운 회색 계열 |
| 잡플래닛 | 초록 #00C853 |
| LinkedIn | #0A66C2 (파랑) |
| 당근마켓 | #FF6F0F (주황) |
| 카카오 | #FEE500 (노랑) |

---

### 옵션 A — "바이올렛 포커스"

**무드 키워드**: 집중 · 성장 · 프리미엄 에듀테크

| 역할 | HEX | 설명 |
|------|-----|------|
| Primary | `#7C3AED` (Violet-600) | CTA 버튼, 강조 |
| Secondary | `#E9D5FF` (Violet-100) | 배경, 보조 |

**선정 근거**
- 경쟁사 파랑(잡다, LinkedIn), 주황(사람인, 당근), 초록(잡플래닛), 노랑(카카오) 전체 회피
- Notion·Figma의 보라 계열과 다른 더 밝고 생동감 있는 Violet-600
- 차분하면서도 활기 있는 톤으로 "진지하지 않아도 실력이 쌓인다"는 메시지와 어울림

**사용 시 느낌**: 앱을 켰을 때 집중력이 생기면서도 무겁지 않다. 면접 연습이라는 목적에 어울리는 프리미엄감을 주면서도 게임처럼 가볍게 접근 가능.

---

### 옵션 B — "틸 에너지"

**무드 키워드**: 신선함 · 성장 · 가능성

| 역할 | HEX | 설명 |
|------|-----|------|
| Primary | `#0D9488` (Teal-600) | CTA 버튼, 강조 |
| Secondary | `#CCFBF1` (Teal-100) | 배경, 보조 |

**선정 근거**
- 청록(Teal)은 파랑과 초록의 중간 계열로, 경쟁사 전체(파랑·초록·주황·노랑·레드·회색) 회피
- Duolingo 초록(#58CC02)과도 확연히 다른 blue-green 계열
- LinkedIn 파랑(#0A66C2)과 색상환 상 거리가 충분

**사용 시 느낌**: 깔끔하고 신뢰감 있으면서도 에너지가 느껴진다. "이렇게 쉬워도 돼?" 라는 서비스 톤과 가장 자연스럽게 연결되는 컬러.

---

### 옵션 C — "코랄 챌린지"

**무드 키워드**: 도전 · 열정 · 활력

| 역할 | HEX | 설명 |
|------|-----|------|
| Primary | `#E11D48` (Rose-600) | CTA 버튼, 강조 |
| Secondary | `#FFE4E6` (Rose-100) | 배경, 보조 |

**선정 근거**
- 사람인 레드(붉은 주황 계열)와 다른 핑크-마젠타(로즈) 계열로 명확히 구분됨
- Hue 기준으로 약 345° (Rose) vs. 사람인 약 10-15° (Red-Orange) — 색상환 상 20도 이상 차이
- "도전적이고 열정적인 에너지"를 직관적으로 전달

**사용 시 느낌**: "지루한 면접 준비는 그만"이라는 슬로건과 가장 강하게 연결. 눈에 띄는 개성 있는 브랜드 인상. 단, 여성 편향 인식을 주지 않도록 세컨더리 컬러 밸런스 주의.

---

## 2. 확정 팔레트 CSS 토큰 (Shadcn UI 형식)

> 아래는 옵션별 토큰 초안이다. 팀이 하나의 옵션을 선택한 후 `globals.css`에 적용한다.

### 옵션 A: 바이올렛 포커스

```css
/* Option A: 바이올렛 포커스 */
:root {
  /* Brand */
  --primary: #7C3AED;           /* Violet-600 - CTA 버튼, 강조 */
  --primary-foreground: #FFFFFF;
  --secondary: #E9D5FF;          /* Violet-100 - 배경, 보조 */
  --secondary-foreground: #4C1D95; /* Violet-900 */

  /* Surface */
  --background: #FFFFFF;
  --foreground: #111827;         /* Gray-900 */
  --muted: #F9FAFB;              /* Gray-50 */
  --muted-foreground: #6B7280;   /* Gray-500 */

  /* Border & Input */
  --border: #E5E7EB;             /* Gray-200 */
  --input: #E5E7EB;
  --ring: #7C3AED;               /* Violet-600 - focus ring */

  /* Card */
  --card: #FFFFFF;
  --card-foreground: #111827;

  /* Popover */
  --popover: #FFFFFF;
  --popover-foreground: #111827;

  /* Semantic */
  --success: #22C55E;            /* Green-500 - 합격·완료 */
  --success-foreground: #FFFFFF;
  --warning: #F59E0B;            /* Amber-500 - 주의 */
  --warning-foreground: #FFFFFF;
  --destructive: #EF4444;        /* Red-500 - 에러 */
  --destructive-foreground: #FFFFFF;
  --info: #3B82F6;               /* Blue-500 - 정보 */
  --info-foreground: #FFFFFF;

  /* Coin (게임머니 강조) */
  --coin: #F59E0B;               /* Amber-500 */
  --coin-foreground: #FFFFFF;

  /* Radius */
  --radius: 0.75rem;             /* rounded-xl 기본 */
}

.dark {
  /* Brand */
  --primary: #A78BFA;           /* Violet-400 - 다크모드에서 더 밝게 */
  --primary-foreground: #1E1B4B; /* Violet-950 */
  --secondary: #2E1065;          /* Violet-950 */
  --secondary-foreground: #DDD6FE; /* Violet-200 */

  /* Surface */
  --background: #09090B;         /* Zinc-950 */
  --foreground: #FAFAFA;         /* Zinc-50 */
  --muted: #18181B;              /* Zinc-900 */
  --muted-foreground: #A1A1AA;   /* Zinc-400 */

  /* Border & Input */
  --border: #27272A;             /* Zinc-800 */
  --input: #27272A;
  --ring: #A78BFA;               /* Violet-400 */

  /* Card */
  --card: #18181B;               /* Zinc-900 */
  --card-foreground: #FAFAFA;

  /* Popover */
  --popover: #18181B;
  --popover-foreground: #FAFAFA;

  /* Semantic (다크모드) */
  --success: #4ADE80;            /* Green-400 */
  --success-foreground: #052E16;
  --warning: #FCD34D;            /* Amber-300 */
  --warning-foreground: #451A03;
  --destructive: #F87171;        /* Red-400 */
  --destructive-foreground: #450A0A;
  --info: #60A5FA;               /* Blue-400 */
  --info-foreground: #172554;

  /* Coin */
  --coin: #FCD34D;               /* Amber-300 */
  --coin-foreground: #451A03;
}
```

---

### 옵션 B: 틸 에너지

```css
/* Option B: 틸 에너지 */
:root {
  /* Brand */
  --primary: #0D9488;           /* Teal-600 - CTA 버튼, 강조 */
  --primary-foreground: #FFFFFF;
  --secondary: #CCFBF1;          /* Teal-100 - 배경, 보조 */
  --secondary-foreground: #134E4A; /* Teal-900 */

  /* Surface */
  --background: #FFFFFF;
  --foreground: #111827;         /* Gray-900 */
  --muted: #F9FAFB;              /* Gray-50 */
  --muted-foreground: #6B7280;   /* Gray-500 */

  /* Border & Input */
  --border: #E5E7EB;             /* Gray-200 */
  --input: #E5E7EB;
  --ring: #0D9488;               /* Teal-600 */

  /* Card */
  --card: #FFFFFF;
  --card-foreground: #111827;

  /* Popover */
  --popover: #FFFFFF;
  --popover-foreground: #111827;

  /* Semantic */
  --success: #22C55E;            /* Green-500 */
  --success-foreground: #FFFFFF;
  --warning: #F59E0B;            /* Amber-500 */
  --warning-foreground: #FFFFFF;
  --destructive: #EF4444;        /* Red-500 */
  --destructive-foreground: #FFFFFF;
  --info: #3B82F6;               /* Blue-500 */
  --info-foreground: #FFFFFF;

  /* Coin */
  --coin: #F59E0B;               /* Amber-500 */
  --coin-foreground: #FFFFFF;

  /* Radius */
  --radius: 0.75rem;
}

.dark {
  /* Brand */
  --primary: #2DD4BF;           /* Teal-400 */
  --primary-foreground: #042F2E; /* Teal-950 */
  --secondary: #042F2E;          /* Teal-950 */
  --secondary-foreground: #99F6E4; /* Teal-200 */

  /* Surface */
  --background: #09090B;
  --foreground: #FAFAFA;
  --muted: #18181B;
  --muted-foreground: #A1A1AA;

  /* Border & Input */
  --border: #27272A;
  --input: #27272A;
  --ring: #2DD4BF;

  /* Card */
  --card: #18181B;
  --card-foreground: #FAFAFA;

  /* Popover */
  --popover: #18181B;
  --popover-foreground: #FAFAFA;

  /* Semantic */
  --success: #4ADE80;
  --success-foreground: #052E16;
  --warning: #FCD34D;
  --warning-foreground: #451A03;
  --destructive: #F87171;
  --destructive-foreground: #450A0A;
  --info: #60A5FA;
  --info-foreground: #172554;

  /* Coin */
  --coin: #FCD34D;
  --coin-foreground: #451A03;
}
```

---

### 옵션 C: 코랄 챌린지

```css
/* Option C: 코랄 챌린지 */
:root {
  /* Brand */
  --primary: #E11D48;           /* Rose-600 - CTA 버튼, 강조 */
  --primary-foreground: #FFFFFF;
  --secondary: #FFE4E6;          /* Rose-100 - 배경, 보조 */
  --secondary-foreground: #881337; /* Rose-900 */

  /* Surface */
  --background: #FFFFFF;
  --foreground: #111827;         /* Gray-900 */
  --muted: #F9FAFB;              /* Gray-50 */
  --muted-foreground: #6B7280;   /* Gray-500 */

  /* Border & Input */
  --border: #E5E7EB;             /* Gray-200 */
  --input: #E5E7EB;
  --ring: #E11D48;               /* Rose-600 */

  /* Card */
  --card: #FFFFFF;
  --card-foreground: #111827;

  /* Popover */
  --popover: #FFFFFF;
  --popover-foreground: #111827;

  /* Semantic */
  --success: #22C55E;            /* Green-500 */
  --success-foreground: #FFFFFF;
  --warning: #F59E0B;            /* Amber-500 */
  --warning-foreground: #FFFFFF;
  --destructive: #EF4444;        /* Red-500 */
  --destructive-foreground: #FFFFFF;
  --info: #3B82F6;               /* Blue-500 */
  --info-foreground: #FFFFFF;

  /* Coin */
  --coin: #F59E0B;               /* Amber-500 */
  --coin-foreground: #FFFFFF;

  /* Radius */
  --radius: 0.75rem;
}

.dark {
  /* Brand */
  --primary: #FB7185;           /* Rose-400 */
  --primary-foreground: #4C0519; /* Rose-950 */
  --secondary: #4C0519;          /* Rose-950 */
  --secondary-foreground: #FECDD3; /* Rose-200 */

  /* Surface */
  --background: #09090B;
  --foreground: #FAFAFA;
  --muted: #18181B;
  --muted-foreground: #A1A1AA;

  /* Border & Input */
  --border: #27272A;
  --input: #27272A;
  --ring: #FB7185;

  /* Card */
  --card: #18181B;
  --card-foreground: #FAFAFA;

  /* Popover */
  --popover: #18181B;
  --popover-foreground: #FAFAFA;

  /* Semantic */
  --success: #4ADE80;
  --success-foreground: #052E16;
  --warning: #FCD34D;
  --warning-foreground: #451A03;
  --destructive: #F87171;
  --destructive-foreground: #450A0A;
  --info: #60A5FA;
  --info-foreground: #172554;

  /* Coin */
  --coin: #FCD34D;
  --coin-foreground: #451A03;
}
```

---

## 3. Tailwind Config 설정 예시

CSS 변수를 Tailwind에서 사용하려면 `tailwind.config.js`에 아래와 같이 등록한다.

```js
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        success: {
          DEFAULT: 'var(--success)',
          foreground: 'var(--success-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          foreground: 'var(--warning-foreground)',
        },
        info: {
          DEFAULT: 'var(--info)',
          foreground: 'var(--info-foreground)',
        },
        coin: {
          DEFAULT: 'var(--coin)',
          foreground: 'var(--coin-foreground)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', 'Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
```

---

## 4. 타이포그래피 스케일

> 모바일 기준. Pretendard 폰트를 기본 sans-serif로 사용하고, 숫자·코드에는 JetBrains Mono를 적용한다.

| 역할 | 폰트 | 크기 | 줄높이 | 굵기 | Tailwind 클래스 예시 |
|------|------|-----:|--------|-----:|----------------------|
| Display (스플래시 카피) | Pretendard | 28px | 1.3 | 700 | `text-[28px] leading-[1.3] font-bold` |
| H1 (화면 제목) | Pretendard | 24px | 1.3 | 700 | `text-2xl leading-[1.3] font-bold` |
| H2 (섹션 제목) | Pretendard | 20px | 1.4 | 600 | `text-xl leading-[1.4] font-semibold` |
| H3 (카드 제목) | Pretendard | 17px | 1.4 | 600 | `text-[17px] leading-[1.4] font-semibold` |
| Body-lg (채팅·피드 본문) | Pretendard | 16px | 1.6 | 400 | `text-base leading-relaxed font-normal` |
| Body (일반 본문) | Pretendard | 14px | 1.6 | 400 | `text-sm leading-relaxed font-normal` |
| Body-sm (보조 텍스트) | Pretendard | 13px | 1.5 | 400 | `text-[13px] leading-[1.5] font-normal` |
| Caption | Pretendard | 12px | 1.4 | 400 | `text-xs leading-[1.4] font-normal` |
| Caption-sm (배지·카운터) | Pretendard | 11px | 1.3 | 400 | `text-[11px] leading-[1.3] font-normal` |
| Mono/숫자 | JetBrains Mono | 14px | 1.4 | 400 | `font-mono text-sm leading-[1.4]` |

> **참고**: design.md의 타입 스케일과 동기화된 버전이다. 개발 구현 시 design.md 스케일을 최종 기준으로 사용한다.

### 폰트 로드 방법

```css
/* globals.css */

/* Pretendard (CDN) */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');

/* Inter (Google Fonts) */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

/* JetBrains Mono (코드·모노 숫자) */
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  font-family: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont,
    system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo',
    'Noto Sans KR', 'Malgun Gothic', 'Apple Color Emoji', 'Segoe UI Emoji',
    'Segoe UI Symbol', sans-serif;
}
```

> Pretendard Variable을 사용하면 모든 굵기를 하나의 파일로 커버할 수 있어 로딩 성능에 유리하다.

---

## 5. 브랜드 톤앤매너

### 브랜드 키워드

**유쾌함 · 쉬움 · 성장**

취업 준비는 무겁고 진지한 것이라는 고정관념을 깨고, "이렇게 가볍게 해도 실력이 쌓이네?" 라는 경험을 제공한다.

---

### 헤드라인 방향

| 상황 | 헤드라인 예시 |
|------|---------------|
| 서비스 소개 | "이렇게 쉬워도 돼?" |
| 가치 제안 | "지루한 면접 준비는 그만" |
| 기능 강조 | "AI 면접관이랑 대화하다 보면 어느새 합격 준비 완료" |
| 동기 부여 | "오늘도 한 판, 내일은 더 잘할 거야" |
| 코인 획득 | "면접 한 번에 코인 N개, 쌓이다 보면 빠르게 성장" [미확정] |

---

### 카피라이팅 가이드

**어조**
- 친근한 존댓말 (해요체) 기본
- 긍정적이고 가볍게, 응원하는 말투
- 짧고 명확하게 — 2줄 이상 넘기지 않음

**금지 표현**

| 유형 | 금지 | 대안 |
|------|------|------|
| 진지한 평가 표현 | "시험", "평가", "점수" 강조 | "연습", "피드백", "리뷰" |
| 게임화 부정 표현 | "자동사냥", "수익" | "코인 쌓기", "성장" |
| 압박감 조성 | "반드시", "꼭", "당장" | "한번", "가볍게", "조금씩" |
| 딱딱한 존댓말 | "하십시오", "하여야 합니다" | "해보세요", "해볼까요" |

**권장 표현**
- "면접 연습", "연습하다 보면", "오늘도 한 판", "코인 쌓기"
- "잠깐이면 돼요", "AI랑 얘기하다 보면", "모르면 모른다고 해도 괜찮아요"

---

### 마이크로카피 예시

| 상황 | 마이크로카피 |
|------|-------------|
| 빈 상태 (면접 기록 없음) | "아직 면접 기록이 없어요. 오늘 첫 면접 시작해볼까요? 🎯" |
| 면접 완료 | "오늘의 면접 완료! 코인 N개 획득 🪙" [미확정] |
| 연속 출석 | "3일 연속 출석! 이 속도라면 금방 준비 끝나겠는데요 ✨" |
| 에러 (연결 끊김) | "앗, 연결이 잠깐 끊겼어요. 다시 시도해주세요." |
| 에러 (서버 오류) | "잠시 문제가 생겼어요. 조금 뒤에 다시 시도해주세요." |
| 로딩 | "AI 면접관이 준비 중이에요..." |
| 첫 로그인 환영 | "안녕하세요! 취업 준비, 같이 가볍게 시작해봐요 😊" |
| 코인 부족 | "코인이 조금 부족해요. 면접 연습을 더 하면 쌓을 수 있어요!" |
| 프로필 완성 독려 | "프로필을 완성하면 더 정확한 면접 피드백을 받을 수 있어요." |

---

### 마스코트 도입 검토

- Duolingo 올빼미처럼 lww를 대표하는 취준생 아이콘화 마스코트 도입 검토 중
- 후보 콘셉트: 부엉이 "취준이" — 밤새 공부하는 취준생의 상징, 귀엽고 친근한 이미지
- **Phase 1**: 미정 (캐릭터 없이 아이콘과 일러스트로 브랜드 구성)
- **Phase 2**: 브랜딩 강화 시 마스코트 확정 및 캐릭터 모션 적용 예정

---

## 6. 아이콘 & 일러스트 스타일

### 아이콘

| 항목 | 가이드 |
|------|--------|
| 라이브러리 | Lucide Icons (기본), Heroicons (보조) |
| 스타일 | 라인 아이콘 (stroke-width: 1.5~2) |
| 사이즈 | 16px (인라인), 20px (버튼), 24px (탭바), 32px (카드 헤더) |
| 컬러 | 컨텍스트 컬러 상속 (`currentColor`) |
| 코인 아이콘 | 황금색 동전 심볼 (`--coin` 컬러 적용, 게임 UI 레퍼런스) |

```tsx
// 코인 아이콘 예시 컴포넌트
import { Coins } from 'lucide-react'

export function CoinBadge({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-coin/10 px-2 py-0.5 text-sm font-medium text-coin">
      <Coins className="h-4 w-4" />
      {amount}
    </span>
  )
}
```

### 일러스트

| 항목 | 가이드 |
|------|--------|
| 스타일 | 플랫 디자인, 캐릭터 표정이 있는 친근한 디자인 |
| 인물 표현 | 다양한 연령/성별/배경 포함, 취준생 대표 페르소나 반영 |
| 컬러 사용 | 브랜드 Primary 컬러 + 중성 팔레트 조합 |
| 사용처 | 온보딩, 빈 상태(empty state), 완료 화면, 코인 획득 애니메이션 |
| 포맷 | SVG 기본, 애니메이션 시 Lottie JSON |

---

## 7. 컴포넌트 가이드라인

### 버튼

```tsx
// Primary 버튼 — rounded-full, 모바일 친화적
<button className="rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95">
  면접 시작하기
</button>

// Secondary 버튼
<button className="rounded-full bg-secondary px-6 py-3 text-base font-semibold text-secondary-foreground transition hover:bg-secondary/80">
  나중에 할게요
</button>

// Ghost 버튼
<button className="rounded-full px-6 py-3 text-base font-semibold text-muted-foreground transition hover:bg-muted">
  건너뛰기
</button>
```

| 항목 | 가이드 |
|------|--------|
| 형태 | `rounded-full` (Pill 형태) — 모바일 친화적, 터치 영역 확보 |
| 기본 높이 | 모바일 52px, 데스크탑 40px |
| 비활성화 | `opacity-50 cursor-not-allowed` |
| 로딩 | 스피너 아이콘 + 텍스트 "처리 중..." |

---

### 카드

```tsx
// 기본 카드
<div className="rounded-2xl bg-card p-4 shadow-sm">
  <h3 className="text-[17px] font-semibold leading-[1.4] text-card-foreground">
    카드 제목
  </h3>
  <p className="mt-1 text-sm text-muted-foreground">
    보조 텍스트
  </p>
</div>
```

| 항목 | 가이드 |
|------|--------|
| 형태 | `rounded-2xl` (16px 라운드) |
| 그림자 | `shadow-sm` — 너무 강한 그림자 지양 |
| 배경 | `--card` (흰색 또는 다크 카드색) |
| 패딩 | 모바일 16px, 데스크탑 24px |

---

### 채팅 버블

```tsx
// 사용자 메시지 (오른쪽)
<div className="ml-auto max-w-[240px] rounded-2xl rounded-br-sm bg-primary px-4 py-3 text-primary-foreground">
  <p className="text-sm leading-relaxed">안녕하세요, 면접 연습 하러 왔어요.</p>
</div>

// AI 메시지 (왼쪽)
<div className="mr-auto max-w-[240px] rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
  <p className="text-sm leading-relaxed text-foreground">
    반갑습니다! 오늘 어떤 직무 면접을 연습해볼까요?
  </p>
</div>
```

| 항목 | 가이드 |
|------|--------|
| 내 메시지 | `bg-primary text-primary-foreground`, 오른쪽 정렬 |
| AI 메시지 | `bg-muted text-foreground`, 왼쪽 정렬 |
| 모서리 | `rounded-2xl` 기본, 꼬리 부분만 `rounded-b{l/r}-sm` |
| 최대 너비 | 240px |

---

### 코인 배지

```tsx
// 코인 배지 컴포넌트
<span className="inline-flex items-center gap-1.5 rounded-full bg-coin/10 px-3 py-1 text-sm font-semibold text-coin">
  <Coins className="h-4 w-4" />
  <span>+10</span>
</span>

// 코인 획득 토스트
<div className="flex items-center gap-2 rounded-2xl bg-coin/10 px-4 py-3 shadow-md">
  <Coins className="h-6 w-6 text-coin" />
  <div>
    <p className="text-sm font-semibold text-coin">코인 N개 획득! {/* [미확정] */}</p>
    <p className="text-xs text-muted-foreground">오늘의 면접을 완료했어요</p>
  </div>
</div>
```

| 항목 | 가이드 |
|------|--------|
| 배경 | `bg-coin/10` (Amber 10% 투명도) |
| 텍스트/아이콘 | `text-coin` (`--coin: Amber-500`) |
| 형태 | `rounded-full` (인라인 배지) |
| 아이콘 | Lucide `Coins` 또는 게임 UI 스타일 동전 SVG |

---

## 마스코트 검토

> **현황**: Phase 1 미적용, Phase 2 도입 여부 결정 예정

### 검토 배경

Duolingo는 올빼미 "Duo"를 마스코트로 사용하며 강력한 브랜드 인지도와 리텐션 넛지(스트릭 깨면 Duo가 울음)를 만들어냈다. lww도 면접 코치 역할의 캐릭터를 도입할 경우 유사 효과를 기대할 수 있다.

### 옵션

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| **A. 캐릭터 마스코트** | 면접 코치 캐릭터 (예: 넥타이 맨 토끼, 서류 들고 있는 캐릭터) | 강한 브랜드 아이덴티티, 감정 연결 | 디자인 리소스 투자 필요, 잘못 만들면 어색함 |
| **B. 아이콘 심볼** | 마스코트 대신 브랜드 심볼 아이콘 사용 | 개발 부담 없음, 유연 | 브랜드 임팩트 낮음 |
| **C. 도입 안 함** | 텍스트·이모지 기반 브랜딩 유지 | 빠른 런칭 | 경쟁사 대비 기억에 덜 남음 |

### 결정 기준

- MVP 및 Phase 1에서는 마스코트 없이 진행 (리소스 집중)
- Phase 2 커뮤니티 런칭 전, 유저 리텐션 지표 확인 후 도입 여부 결정
- 도입 시: 옵션 A 우선 검토 (Duolingo 레퍼런스)

---

## 참고 및 의사결정 로그

| 날짜 | 항목 | 내용 |
|------|------|------|
| 2026-03-16 | 컬러 옵션 초안 | 옵션 A(바이올렛), B(틸), C(코랄) 3종 제시, 팀 선택 대기 |
| 2026-03-16 | 마스코트 | Phase 1 미정, Phase 2에서 확정 예정 |
| 2026-03-16 | 폰트 | Pretendard + JetBrains Mono 조합 확정 |
| 2026-03-16 | 버튼 형태 | rounded-full (Pill) — 모바일 친화성 우선 |
