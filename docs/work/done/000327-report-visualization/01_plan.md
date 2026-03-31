# [#327] feat: [seung] 리포트/진단 시각화 강화 — 레이더 차트 + 대시보드 점수 배지 — 구현 계획

> 작성: 2026-03-31

---

## 완료 기준

- [ ] `report` 페이지에 8축 레이더 차트 표시 (progress bar와 함께 노출)
- [ ] `diagnosis` 페이지에 5축 레이더 차트 표시 (progress bar와 함께 노출)
- [ ] 대시보드 ResumeCard에 가장 최근 리포트 총점 배지 표시 (리포트 없으면 미표시)

---

## 구현 계획

### 개요

총 4개의 관심사로 분리한다:
1. RadarChart 컴포넌트 신규 작성
2. report 페이지 적용
3. diagnosis 페이지 적용
4. dashboard API + UI 점수 배지

recharts는 이미 설치되어 있고 dashboard/page.tsx에서 LineChart 방식으로 사용 중이다.
RadarChart도 recharts의 동일한 방식으로 작성한다.

---

### Step 1 — RadarChart 컴포넌트 신규 작성

**파일:** `services/seung/src/components/RadarChart.tsx`

- recharts에서 `RadarChart`, `Radar`, `PolarGrid`, `PolarAngleAxis`, `PolarRadiusAxis`, `ResponsiveContainer` import
- props: `data: { axis: string; label: string; score: number }[]`
  - `axis`: 영문 키 (내부 식별용)
  - `label`: 한글 라벨 (PolarAngleAxis 표시용)
  - `score`: 0–100 숫자
- 도메인 0–100 고정, `PolarRadiusAxis` 숨김 (tick 없이 깔끔하게)
- 색상: `#4361ee` (기존 대시보드 포인트 컬러와 통일)
- 높이: `300px`, 너비 100%
- `'use client'` 불필요 (순수 presentational 컴포넌트, props만 받음)

```tsx
// 핵심 구조 예시
<ResponsiveContainer width="100%" height={300}>
  <RadarChart data={data}>
    <PolarGrid />
    <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
    <Radar dataKey="score" stroke="#4361ee" fill="#4361ee" fillOpacity={0.15} strokeWidth={2} />
  </RadarChart>
</ResponsiveContainer>
```

---

### Step 2 — report/page.tsx 에 RadarChart 적용

**파일:** `services/seung/src/app/report/page.tsx`

- `RadarChart` import 추가
- `scoreEntries`로부터 RadarChart용 데이터 변환:
  ```ts
  const radarData = scoreEntries.map(([axis, score]) => ({
    axis,
    label: AXIS_LABEL_MAP[axis] ?? axis,
    score,
  }))
  ```
- "역량 축별 점수" 섹션 (`<h2>역량 축별 점수</h2>`) **위에** RadarChart 배치
- 기존 ScoreGauge + progress bar는 유지

배치 위치 (섹션 내부):
```
ScoreGauge + 등급
─────────────────
RadarChart (신규)
─────────────────
8축 progress bar (기존 유지)
```

---

### Step 3 — diagnosis/page.tsx 에 RadarChart 적용

**파일:** `services/seung/src/app/diagnosis/page.tsx`

- `RadarChart` import 추가
- `scoreEntries`로부터 RadarChart용 데이터 변환:
  ```ts
  const radarData = scoreEntries.map(([key, score]) => ({
    axis: key,
    label: SCORE_LABEL_MAP[key],
    score,
  }))
  ```
- "항목별 점수 바" 섹션 **위에** RadarChart 배치
- 기존 ScoreGauge + progress bar는 유지

---

### Step 4 — dashboard API: latestScore 추가

**파일:** `services/seung/src/lib/types.ts`

`DashboardResumeItem`에 필드 추가:
```ts
latestScore?: number
```

**파일:** `services/seung/src/app/api/dashboard/route.ts`

- `SessionWithReport` 타입의 `report` 에 `totalScore: number` 필드 추가
- `prisma.resume.findMany` include 절에서 `report: { select: { id, createdAt, totalScore } }` 로 변경
- `result` 매핑 시 가장 최근 리포트의 totalScore를 `latestScore` 로 노출:
  ```ts
  // createdAt 기준 가장 최근 report 선택
  const latestReport = reports.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )[0]

  return {
    ...기존 필드들,
    latestScore: latestReport?.totalScore ?? undefined,
  }
  ```

> 주의: Prisma `report` 모델에 `totalScore` 컬럼이 있음을 report API(`/api/report`)의 ReportResponse 타입으로 확인함. DB 스키마 변경 불필요.

---

### Step 5 — dashboard/page.tsx: ResumeCard 점수 배지 UI

**파일:** `services/seung/src/app/dashboard/page.tsx`

`ResumeCard` 컴포넌트 내 파일명/메타 영역에 점수 배지 조건부 렌더링:
- `item.latestScore`가 존재할 때만 표시
- 배치: 파일명 옆 또는 메타 줄(날짜·세션 수) 뒤
- 스타일: `ScoreGauge`와 동일한 색상 함수 로직 인라인 적용

```tsx
{item.latestScore !== undefined && (
  <span className={`text-xs font-bold rounded-full px-2 py-0.5 ${scoreColor}`}>
    {item.latestScore}점
  </span>
)}
```

점수 색상 기준 (ScoreGauge.tsx 기준 통일):
- ≥ 80: 초록 (`text-emerald-600 bg-emerald-50`)
- ≥ 60: 노랑 (`text-amber-600 bg-amber-50`)
- < 60: 빨강 (`text-red-600 bg-red-50`)

---

### Step 6 — 테스트 작성

**파일 1 (신규):** `services/seung/tests/components/RadarChart.test.tsx`

- render 후 `<svg>` 존재 확인
- data prop 전달 시 label 텍스트 렌더 확인
- 빈 배열 props → 크래시 없이 렌더 확인

**파일 2 (수정):** `services/seung/tests/api/dashboard.test.ts`

- 기존 테스트에 `latestScore` 필드 검증 추가:
  - report가 있는 resume → `latestScore` 가 해당 totalScore와 일치
  - report 없는 resume → `latestScore` 가 undefined
- mock 데이터에 `totalScore` 필드 추가

---

### 변경 파일 요약

| 파일 | 변경 유형 |
|------|-----------|
| `services/seung/src/components/RadarChart.tsx` | 신규 |
| `services/seung/src/lib/types.ts` | 수정 (DashboardResumeItem) |
| `services/seung/src/app/api/dashboard/route.ts` | 수정 (latestScore 포함) |
| `services/seung/src/app/dashboard/page.tsx` | 수정 (배지 UI) |
| `services/seung/src/app/report/page.tsx` | 수정 (RadarChart 추가) |
| `services/seung/src/app/diagnosis/page.tsx` | 수정 (RadarChart 추가) |
| `services/seung/tests/components/RadarChart.test.tsx` | 신규 |
| `services/seung/tests/api/dashboard.test.ts` | 수정 (latestScore 검증) |

---

### 구현 순서 (의존성 고려)

```
Step 1 (RadarChart 컴포넌트)
  ↓
Step 2 (report 페이지)  ←→  Step 3 (diagnosis 페이지)  [병렬 가능]
  ↓
Step 4 (dashboard API 타입 + route)
  ↓
Step 5 (dashboard UI 배지)
  ↓
Step 6 (테스트)
```

### 엣지 케이스 / 주의사항

- `scores` 객체가 비어있거나 일부 축이 누락된 경우 RadarChart 렌더 문제 없음 (빈 배열 전달)
- `latestScore`는 `undefined` (필드 미존재) vs `null` (명시적 없음) 구분 — `undefined`로 처리해 JSON 직렬화 시 키 자체가 빠지도록 함
- recharts RadarChart는 SSR 환경에서 크래시 가능 → 해당 페이지가 이미 `'use client'`이므로 문제 없음
- PolarAngleAxis 라벨이 긴 경우 잘림 가능 — `tick={{ fontSize: 11 }}`로 최소화, 5–8축 수준에서는 문제 없음
