# [#82] feat: services/siw — 면접 완료 후 8축 역량 평가 리포트 페이지 구현 — 구현 계획

> 작성: 2026-03-12

---

## 완료 기준

- [ ] `sessionComplete=true` 시 "리포트 보기" 버튼 → `/interview/[sessionId]/report` 이동
- [ ] `POST /api/report/generate` 엔진 프록시 라우트 구현 (sessionId → DB에서 resumeText·history 조회 → 엔진 호출, fetch timeout 90s 이상)
- [ ] history 5개 미만인 세션에서 리포트 요청 시 "질문을 더 진행해 주세요" 안내 처리
- [ ] 리포트 페이지에서 `totalScore`, `summary`, 8축 점수·피드백 렌더링 (기존 `score-grid-wrapper / axis-row` CSS 재활용)
- [ ] vitest 전체 통과 (기존 테스트 유지 + 신규 테스트 추가)
- [ ] `tsc --noEmit` 에러 0건
- [ ] Prisma 스키마 변경 없음
- [ ] 기존 엔드포인트 스키마 변경 없음

---

## 아키텍처 결정

### 스키마 변경 없음 근거

`InterviewSession` 모델은 이미 `resumeText`(String)와 `history`(Json) 필드를 보유하고 있다.
엔진 API `POST /api/report/generate`는 입력으로 `{ resumeText, history }` 만 요구하므로,
siw는 기존 DB에서 두 필드를 읽어 엔진에 전달하면 된다. **Prisma 마이그레이션 불필요.**

리포트 결과는 DB에 저장하지 않는다 (engine은 stateless, 리포트는 요청 시 재생성).
이는 아키텍처 불변식(#4: DB는 서비스가 소유, engine은 stateless)을 준수한다.

### 엔진 API 계약

- 엔드포인트: `POST {ENGINE_BASE_URL}/api/report/generate`
- 입력: `{ resumeText: string, history: HistoryItem[] }` (**`type` 필드 제외**)
- 출력: `{ scores: AxisScores, totalScore: int, summary: string, axisFeedbacks: AxisFeedback[8], growthCurve: null }`
- 에러: 422 (history < 5개), 400 (필드 누락), 500 (LLM 오류)
- **⚠️ timeout: 엔진 내부 LLM timeout=60s → siw fetch timeout 90s 이상 필수**
  - `AbortSignal.timeout(90000)` + `export const maxDuration = 120`

### 8축 영문 키 ↔ 한국어 라벨 매핑

| 영문 키 | 한국어 라벨 |
|---------|-----------|
| `communication` | 의사소통 |
| `problemSolving` | 문제해결 |
| `logicalThinking` | 논리적 사고 |
| `jobExpertise` | 직무 전문성 |
| `cultureFit` | 조직 적합성 |
| `leadership` | 리더십 |
| `creativity` | 창의성 |
| `sincerity` | 성실성 |

### type 분기 규칙

- `score >= 75` → `"strength"` (강점 — 칭찬)
- `score < 75` → `"improvement"` (개선 — 실행형 피드백)
- 엔진이 자동 보정하므로 siw는 그대로 사용

---

## 신규 파일 목록

| 파일 경로 | 역할 |
|----------|------|
| `src/lib/types.ts` (수정) | `AxisScores`, `AxisFeedback`, `ReportResponse` 타입 추가 |
| `src/app/api/report/generate/route.ts` | 엔진 프록시 라우트 (POST) |
| `src/components/ReportResult.tsx` | 8축 결과 렌더링 컴포넌트 |
| `src/app/(app)/interview/[sessionId]/report/page.tsx` | 리포트 결과 페이지 |
| `tests/api/report-generate-route.test.ts` | API 라우트 단위 테스트 |
| `tests/ui/report-result.test.tsx` | ReportResult 컴포넌트 UI 테스트 |

## 수정 파일 목록

| 파일 경로 | 변경 내용 |
|----------|----------|
| `src/app/(app)/interview/[sessionId]/page.tsx` | `sessionComplete` 완료 카드에 "리포트 보기" 버튼 추가, "준비 중" 텍스트 제거 |
| `services/siw/.ai.md` | Week 3 역량 평가 완료 표시, 신규 파일 구조 반영 |

---

## 타입 정의

`src/lib/types.ts` 파일 끝에 추가 (기존 타입 변경 없음):

```typescript
export type AxisScores = {
  communication: number;
  problemSolving: number;
  logicalThinking: number;
  jobExpertise: number;
  cultureFit: number;
  leadership: number;
  creativity: number;
  sincerity: number;
};

export type AxisFeedback = {
  axis: string;
  axisLabel: string;
  score: number;
  type: "strength" | "improvement";
  feedback: string;
};

export type ReportResponse = {
  scores: AxisScores;
  totalScore: number;
  summary: string;
  axisFeedbacks: AxisFeedback[];
  growthCurve: null;
};
```

---

## API 라우트 설계

**파일**: `src/app/api/report/generate/route.ts`

```
POST /api/report/generate
Body: { sessionId: string }

1. sessionId 유효성 검사 → 400
2. interviewRepository.findById(sessionId) → resumeText, history
   - P2025 NotFound → 404
3. history.length < 5 → 422 "질문을 더 진행해 주세요 (최소 5개 필요합니다)."
4. historyForEngine = history.map(({ type: _type, ...rest }) => rest)
5. fetch(ENGINE_BASE_URL + "/api/report/generate", {
     method: "POST",
     body: JSON.stringify({ resumeText, history: historyForEngine }),
     signal: AbortSignal.timeout(90000),  // ← CRITICAL
   })
6. 엔진 응답 → Response.json() 그대로 반환
7. 엔진 에러 → 500

export const runtime = "nodejs"
export const maxDuration = 120  // ← CRITICAL (Vercel 함수 최대 실행 시간)
```

**에러 처리 매트릭스**:

| 상황 | HTTP 상태 | 메시지 |
|------|----------|--------|
| sessionId 없음 | 400 | 기본 에러 메시지 |
| 세션 없음 (P2025) | 404 | 기본 에러 메시지 |
| history < 5개 | 422 | "질문을 더 진행해 주세요 (최소 5개 필요합니다)." |
| 엔진 오류 | 500 | 기본 에러 메시지 |

---

## 컴포넌트 설계

**파일**: `src/components/ReportResult.tsx`

- `"use client"` 컴포넌트
- Props: `{ report: ReportResponse }`
- 레이아웃:
  ```
  [glass-card] 종합 점수 카드
    - totalScore (대형 숫자)
    - summary (텍스트)

  [score-grid-wrapper] 8축 점수 그리드
    - [axis-row] × 8 (axisFeedbacks 배열 순회)
      - axis-row__name: axisLabel (한국어)
      - axis-row__current-score: score
      - axis-row__bar-current: score% 너비
        - strength: #10B981 (emerald) 그라디언트
        - improvement: #7C3AED (violet) 그라디언트
      - axis-row__desc: feedback 텍스트
  ```
- CSS 재활용: `globals.css`에 이미 정의된 `score-grid-wrapper`, `axis-row`, `axis-row__*` 클래스 사용
- 참조: `RadarChartInteractive.tsx` (hover 인터랙션 패턴)

---

## 페이지 설계

**파일**: `src/app/(app)/interview/[sessionId]/report/page.tsx`

- `"use client"` 컴포넌트
- `useParams()` → `sessionId`
- 마운트 시 `POST /api/report/generate { sessionId }` 호출
- 상태 머신:
  ```
  loading → success: <ReportResult />
          → error(422): "질문을 더 진행해 주세요" + "면접으로 돌아가기" 링크
          → error(기타): "리포트 생성에 실패했습니다" + "다시 시도" 버튼
  ```
- 헤더: `glass-panel` + MirAI 로고 (기존 interview 페이지와 동일)
- 로딩 메시지: "역량 리포트를 분석 중입니다... (최대 60초 소요됩니다)"
- 레이아웃: `min-h-screen bg-[#F8F9FB]`, `max-w-3xl mx-auto px-4 py-6`

---

## 면접 완료 UI 수정

**파일**: `src/app/(app)/interview/[sessionId]/page.tsx`

line 106~108 근처 `sessionComplete` 완료 카드:
- 제거: TODO 주석, "역량 리포트 기능은 준비 중입니다" 텍스트
- 추가: "리포트 보기" `btn-primary` 버튼 → `router.push(\`/interview/${sessionId}/report\`)`
- 유지: "다시 하기" `btn-outline` 버튼 → `router.push("/resume")`

---

## 테스트 전략

### API 테스트 (`tests/api/report-generate-route.test.ts`)

Vitest, node 환경. `vi.mock` 전략:
- `@/lib/interview/interview-repository` → `findById` mock
- `global.fetch` → engine 호출 mock

테스트 케이스:
1. ✅ 200: history 5개 이상 → 리포트 반환
2. ✅ 400: sessionId 없음
3. ✅ 422: history < 5개
4. ✅ 404: Prisma P2025 에러
5. ✅ 500: 엔진 fetch 실패

### UI 테스트 (`tests/ui/report-result.test.tsx`)

Vitest, jsdom 환경. `@testing-library/react` 사용.

테스트 케이스:
1. ✅ totalScore 렌더링
2. ✅ summary 텍스트 렌더링
3. ✅ 8개 축 한국어 이름 모두 렌더링
4. ✅ `type="strength"` 피드백 텍스트 렌더링
5. ✅ `type="improvement"` 피드백 텍스트 렌더링

---

## 구현 순서 (의존성 기반)

```
1단계 (병렬):
  - src/lib/types.ts 타입 추가
  - src/app/(app)/interview/[sessionId]/page.tsx UI 수정

2단계 (1단계 완료 후):
  - src/app/api/report/generate/route.ts
  - src/components/ReportResult.tsx

3단계 (2단계 완료 후):
  - src/app/(app)/interview/[sessionId]/report/page.tsx
  - tests/api/report-generate-route.test.ts
  - tests/ui/report-result.test.tsx

4단계 (3단계 완료 후):
  - services/siw/.ai.md 업데이트

5단계 (최종):
  - npx tsc --noEmit
  - npx vitest run
  → 에러 0건, 전체 테스트 통과 확인
```

---

## 아키텍처 불변식 준수 확인

- [x] 인증은 서비스(siw)에서만 — 엔진은 인증 없이 내부 호출만 수신
- [x] 외부 AI API 호출은 엔진에서만 — siw가 엔진을 통해 간접 호출 (직접 LLM 호출 없음)
- [x] 서비스 간 직접 통신 금지 — engine만 호출
- [x] DB는 siw가 소유 — engine은 stateless, 리포트 저장 불필요
- [x] Prisma 스키마 변경 없음 — 기존 resumeText + history 재활용
- [x] 신규 엔드포인트 1개만 추가 (`/api/report/generate`), 기존 엔드포인트 변경 없음
- [x] `AbortSignal.timeout(90000)` + `maxDuration: 120` 설정
- [x] history 전달 시 `type` 필드 제외 (engine HistoryItem 스키마 일치)

---

## 후속 이슈 해결 (2026-03-12 검토 결과)

### 발견된 이슈 및 처리 현황

| 심각도 | 이슈 | 처리 |
|--------|------|------|
| 🔴 CRITICAL | `vi.mock` 호이스팅 버그 — `mockSession`이 팩토리 실행 시 `undefined` | ✅ 수정 완료 |
| 🟡 MODERATE | `report/page.tsx` fetch 로직 중복 (DRY 위반) | ✅ 수정 완료 |
| 🟢 LOW | 엔진 호출 재시도 없음 | 의도적 미수정 (플랜 미명시) |
| 🟢 LOW | `report/page.tsx` 에러/로딩 상태 UI 테스트 없음 | 향후 과제 (02_test.md 참조) |

### CRITICAL 수정: vi.hoisted() 패턴 적용

**변경 전**: `const mockSession = { ... }` — vi.mock 팩토리 호이스팅 이후 평가되어 `undefined`

**변경 후**:
```typescript
const { mockSession, mockReportResponse } = vi.hoisted(() => ({
  mockSession: { ... },
  mockReportResponse: { ... },
}));
```

### MODERATE 수정: useCallback 추출

**변경 전**: `useEffect` 내 fetch 함수와 "다시 시도" onClick에 동일 로직 중복

**변경 후**: `fetchReport`를 `useCallback`으로 추출 → `useEffect(() => { fetchReport(); }, [fetchReport])` + `<button onClick={fetchReport}>`
