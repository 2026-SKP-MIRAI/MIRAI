# feat: [seung] 리포트/진단 시각화 강화 — 레이더 차트 + 대시보드 점수 배지

## 사용자 관점 목표
면접 결과와 서류 진단 결과를 한눈에 파악할 수 있고, 대시보드에서 최근 점수를 바로 확인할 수 있다.

## 배경
현재 report·diagnosis 페이지는 progress bar + ScoreGauge만 제공한다.
각 역량 축 간의 상대적 강약점을 직관적으로 파악하기 어렵고,
대시보드의 ResumeCard에는 최근 면접 점수가 표시되지 않아 카드 클릭 전까지 결과를 알 수 없다.

## 완료 기준
- [x] `report` 페이지에 8축 레이더 차트 표시 (progress bar와 함께 노출)
- [x] `diagnosis` 페이지에 5축 레이더 차트 표시 (progress bar와 함께 노출)
- [x] 대시보드 ResumeCard에 가장 최근 리포트 총점 배지 표시 (리포트 없으면 미표시)

## 구현 플랜
1. **RadarChart 컴포넌트 신규 작성**:
   - `src/components/RadarChart.tsx` — recharts `RadarChart` 사용 (이미 recharts 설치됨)
   - props: `data: { axis: string; label: string; score: number }[]`
2. **report/page.tsx 적용**:
   - 8축 점수 데이터를 RadarChart에 전달
   - 기존 ScoreGauge + progress bar 섹션 위 또는 아래에 배치
3. **diagnosis/page.tsx 적용**:
   - 5축 점수 데이터를 RadarChart에 전달
   - 동일한 RadarChart 컴포넌트 재사용
4. **대시보드 ResumeCard 점수 배지**:
   - `DashboardResumeItem` 타입에 `latestScore?: number` 추가
   - `/api/dashboard` 응답에 최근 리포트 totalScore 포함
   - ResumeCard UI에 점수 배지 렌더링

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 `.ai.md` 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

### 신규 파일

**`src/components/RadarChart.tsx`**
recharts 기반 레이더 차트 컴포넌트. props: `{ label: string; score: number }[]`. `'use client'` 필수 (recharts DOM API 의존). `PolarRadiusAxis domain={[0, 100]}` 고정으로 점수 축 일관성 확보. `data.length === 0`이면 `null` 반환 — 빈 배열 시 빈 SVG 공백 노출 방지 (PR 리뷰 반영).

**`tests/components/RadarChart.test.tsx`**
jsdom에서 recharts가 DOM dimension을 0으로 읽어 SVG를 렌더링하지 않는 문제로 recharts 전체 mock. `data-testid` 기반으로 SVG 렌더, `dataKey` 전달, domain 값 등 7개 테스트.

### 수정 파일

**`src/lib/types.ts`**
`DashboardResumeItem`에 `latestScore?: number` 추가. 리포트 없을 때 JSON 키 자체를 생략하는 방식과 일관성 유지.

**`src/app/api/dashboard/route.ts`**
`SessionWithReport.report` 타입에 `totalScore: number` 추가. Prisma 쿼리를 `include: { report: true }` → `report: { select: { id: true, createdAt: true, totalScore: true } }` 로 변경해 over-fetching 방지 (PR 리뷰 반영). `sessionsWithReport`에서 가장 최근 리포트를 reduce로 찾아 `latestScore`로 반환. 리포트 없을 때 spread 패턴으로 키 자체 생략.

**`src/app/report/page.tsx`**
`RadarChart` import + `scoreEntries` 8축 데이터 변환 후 ScoreGauge 헤더와 progress bar 사이에 삽입.

**`src/app/diagnosis/page.tsx`**
`RadarChart` import + `scoreEntries` 5축 데이터 변환 후 ScoreGauge 헤더와 progress bar 사이에 삽입. `SCORE_LABEL_MAP[key] ?? key` fallback 추가.

**`src/app/dashboard/page.tsx`**
`ResumeCard` 메타 영역에 점수 배지 조건부 렌더. 점수 구간별 색상: ≥80 초록, ≥60 노랑, <60 빨강.

**`tests/api/dashboard.test.ts`**
mock 리포트 데이터에 `totalScore` 추가. `latestScore` 검증 2개 추가 (리포트 있는 경우 값 확인, 없는 경우 undefined 확인).

