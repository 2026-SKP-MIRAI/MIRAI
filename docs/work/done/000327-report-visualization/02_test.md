# [#327] feat: [seung] 리포트/진단 시각화 강화 — 레이더 차트 + 대시보드 점수 배지 — 테스트 결과

> 작성: 2026-03-31

---

## 최종 테스트 결과

### vitest 단위 테스트

```
24 passed, 1 failed (기존 실패 — 내 변경 이전부터 존재)
223 tests passed
```

**파일별 결과:**

| 파일 | 테스트 수 | 결과 | 비고 |
|------|-----------|------|------|
| `tests/components/RadarChart.test.tsx` | 7 | ✅ 전체 통과 | 신규 |
| `tests/api/dashboard.test.ts` | 5 | ✅ 전체 통과 | latestScore 검증 추가 |
| 기타 22개 파일 | 211 | ✅ 회귀 없음 | 변경 없음 |
| `tests/lib/auth-schema.test.ts` | 0 | ❌ 기존 실패 | zod 패키지 미설치 — 내 변경과 무관 |

### 기존 실패 확인

`git stash` 후 동일 파일 실행 → 동일 오류 확인. 내 변경 이전부터 존재하는 실패.

```
Error: Failed to resolve import "zod" from "src/lib/schemas/auth.ts"
```

**근본 원인:** `package.json`에 `"zod": "^4.3.6"`가 선언되어 있으나 `node_modules/zod` 미설치 (`node_modules` 폴더는 존재하나 zod만 누락).  
정확한 원인은 partial install / lockfile 불일치 / 다른 cwd 설치 등 중 하나로 추정되며, #327 코드 변경과는 무관한 환경/설치 상태 문제.  
→ **`services/seung/`에서 `npm install` 실행으로 해결 가능. #327 PR 범위 외.**

---

## 상태 범례

| 아이콘 | 의미 |
|--------|------|
| ⬜ | 미구현 |
| 🔴 | RED — 테스트 작성 완료, 실패 확인 |
| 🟢 | GREEN — 구현 완료, 테스트 통과 |
| ✅ | DONE — 완료 |
| ❌ | FAIL — 테스트 실패 (수정 필요) |

---

## AC별 구현 결과

| AC | 상태 | 비고 |
|----|------|------|
| `report` 페이지에 8축 레이더 차트 표시 | ✅ | `RadarChart` 컴포넌트 삽입, progress bar 위 배치 |
| `diagnosis` 페이지에 5축 레이더 차트 표시 | ✅ | 동일 컴포넌트 재사용 |
| 대시보드 ResumeCard 최근 리포트 총점 배지 | ✅ | `latestScore` API 필드 + 조건부 배지 UI |

---

## 변경 파일 및 수정 내용

### 신규 파일

| 파일 | 내용 | 결과 |
|------|------|------|
| `src/components/RadarChart.tsx` | recharts 기반 레이더 차트 컴포넌트 (`'use client'`, props: `data[]`) | ✅ |
| `tests/components/RadarChart.test.tsx` | recharts 전체 mock, 7개 테스트 (SVG 렌더, dataKey 검증, 빈 배열, 8축) | ✅ |

### 수정 파일

| 파일 | 변경 | 결과 |
|------|------|------|
| `src/lib/types.ts` | `DashboardResumeItem`에 `latestScore?: number` 추가 | ✅ |
| `src/app/api/dashboard/route.ts` | `SessionWithReport.report`에 `totalScore: number` 타입 추가 + `latestScore` 계산·반환 | ✅ |
| `src/app/dashboard/page.tsx` | `ResumeCard` 메타 영역에 점수 배지 조건부 렌더 (≥80: 초록, ≥60: 노랑, <60: 빨강) | ✅ |
| `src/app/report/page.tsx` | `RadarChart` import + 8축 데이터 변환 후 progress bar 위에 삽입 | ✅ |
| `src/app/diagnosis/page.tsx` | `RadarChart` import + 5축 데이터 변환 후 progress bar 위에 삽입 | ✅ |
| `tests/api/dashboard.test.ts` | mock 데이터에 `totalScore` 추가, `latestScore` 검증 2개 추가 | ✅ |

---

## 주요 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| recharts 테스트 방법 | recharts 전체 mock + data-testid 검증 | jsdom에서 ResizeObserver/layout 미지원으로 실제 SVG 미렌더 → mock으로 props 전달 여부 검증이 실질적 |
| `latestScore` undefined 처리 | `...(condition && { latestScore })` spread | 리포트 없을 때 JSON 키 자체 생략 (`null` 아님) — 프론트에서 `!== undefined` 체크와 일관성 |
| Prisma report 쿼리 최적화 | `include: { report: true }` → `report: { select: { id, createdAt, totalScore } }` | PR 리뷰 피드백 반영 — 전체 report 행 fetch 대신 필요한 3개 컬럼만 select하여 over-fetching 방지 |
| `RadarChart` 빈 배열 처리 | `if (data.length === 0) return null` 추가 | PR 리뷰 피드백 반영 — 빈 배열 전달 시 빈 SVG가 공백으로 노출되는 문제 방지. 테스트: `container.firstChild`가 null인지 검증 |
| `RadarChart`에 `'use client'` | 추가 | recharts는 DOM API 의존 — 서버 컴포넌트에서 import 시 에러 방지 |
