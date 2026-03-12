# feat: services/siw — 면접 완료 후 8축 역량 평가 리포트 페이지 구현

## 사용자 관점 목표
면접 세션을 완료한 사용자가 8개 역량 축(의사소통·문제해결·논리적 사고·직무 전문성·조직 적합성·리더십·창의성·성실성)에 대한 점수, 종합 총점, 축별 실행형 피드백을 리포트 페이지에서 확인할 수 있다.

## 배경
engine `POST /api/report/generate` 구현 완료 (commit b303114, PR #70).

**엔진 API 계약 요약:**
- 입력: `{ resumeText: str, history: HistoryItem[] }` (history 최소 5개)
- 출력: `{ scores: AxisScores, totalScore: int, summary: str, axisFeedbacks: AxisFeedback[8], growthCurve: null }`
- 에러: 422 (history < 5개), 400 (필드 누락), 500 (LLM 오류)
- ⚠️ 엔진 내부 LLM timeout=60s → siw fetch timeout **90s 이상** 필수 (`AbortSignal.timeout(90000)`, `maxDuration: 120`)

**현재 siw 상태:**
- `interview/[sessionId]/page.tsx` sessionComplete 시 "역량 리포트 기능은 준비 중입니다" 메시지 + "다시 하기" 버튼만 존재 (line 107 TODO: Phase 2에서 `/interview/[sessionId]/result`로 이동)
- `RadarChartInteractive.tsx` (demo data), `score-grid-wrapper / axis-row` CSS 클래스 이미 구현됨 → 재활용 가능
- `src/lib/types.ts`에 리포트 관련 타입 없음
- `InterviewSession` Prisma 모델에 리포트 저장 필드 없음

**엔진 8축 키 (정확한 영문):**
`communication`, `problemSolving`, `logicalThinking`, `jobExpertise`, `cultureFit`, `leadership`, `creativity`, `sincerity`

**type 분기 규칙:** `score >= 75` → `"strength"` (칭찬), `score < 75` → `"improvement"` (실행형 피드백) — 엔진이 자동 보정하므로 siw는 그대로 사용

## 완료 기준 (docs/specs/mirai/ux_flow.md §4 기능07 기준)
- [x] `sessionComplete=true` 시 "리포트 보기" 버튼 → `/interview/[sessionId]/report` 이동
- [x] `POST /api/report/generate` 엔진 프록시 라우트 구현 (sessionId → DB에서 resumeText·history 조회 → 엔진 호출, fetch timeout 90s 이상)
- [x] history 5개 미만인 세션에서 리포트 요청 시 "질문을 더 진행해 주세요" 안내 처리
- [x] 리포트 페이지에서 `totalScore`, `summary`, 8축 점수·피드백 렌더링 (기존 `score-grid-wrapper / axis-row` CSS 재활용)

## 구현 플랜

**1. 타입 정의** `src/lib/types.ts`
```typescript
export type AxisScores = {
  communication: number; problemSolving: number; logicalThinking: number;
  jobExpertise: number; cultureFit: number; leadership: number;
  creativity: number; sincerity: number;
};
export type AxisFeedback = {
  axis: string; axisLabel: string; score: number;
  type: "strength" | "improvement"; feedback: string;
};
export type ReportResponse = {
  scores: AxisScores; totalScore: number; summary: string;
  axisFeedbacks: AxisFeedback[]; growthCurve: null;
};
```

**2. 엔진 프록시 라우트** `src/app/api/report/generate/route.ts`
- 입력: `{ sessionId: string }`
- DB에서 `interviewRepository.findById(sessionId)` → `resumeText` + `history` 조회
- history에서 `type` 필드 제외 후 엔진 호출 (interview-service.ts의 기존 패턴과 동일)
- `AbortSignal.timeout(90000)`, `export const maxDuration = 120`
- 재시도 없이 1회 호출 (LLM 비용 고려)

**3. 리포트 결과 페이지** `src/app/(app)/interview/[sessionId]/report/page.tsx`
- Server Component 또는 Client Component로 `/api/report/generate` 호출
- 로딩 상태 처리 (LLM 응답 12~18s 소요 예상)

**4. ReportResult 컴포넌트** `src/components/ReportResult.tsx`
- `score-grid-wrapper / axis-row / axis-row__*` CSS 재활용
- totalScore + summary 상단 표시
- 8축 점수 바 + `type`별 피드백 (strength: 칭찬, improvement: 실행형)

**5. InterviewChat / 세션 페이지 수정**
- `interview/[sessionId]/page.tsx`: "역량 리포트 기능은 준비 중입니다" → "리포트 보기" 버튼으로 교체 → `router.push(\`/interview/${sessionId}/report\`)`

**6. 테스트**
- `tests/api/report-generate-route.test.ts` (Vitest, node 환경)
- `tests/ui/report-result.test.tsx` (Vitest, jsdom 환경)

## 개발 체크리스트
- [ ] 테스트 코드 포함 (vitest)
- [ ] `services/siw/.ai.md` 최신화 (Week 3 역량 평가 완료 표시)
- [ ] 아키텍처 불변식 준수 (siw에서 LLM 직접 호출 금지, engine만 호출)
- [ ] `AbortSignal.timeout(90000)` + `maxDuration: 120` 설정 확인
- [ ] history 전달 시 engine HistoryItem 스키마 일치 여부 확인 (type 필드 제외)

---

## 작업 내역

### 구현 내용

**`src/lib/types.ts`** — AxisScores, AxisFeedback, ReportResponse 타입 3종 추가
엔진 API 계약에 맞춰 8축 점수 맵(`AxisScores`), 축별 피드백 객체(`AxisFeedback`), 최종 응답 전체(`ReportResponse`) 타입을 정의했다. `growthCurve: null`은 현재 엔진이 미구현이므로 그대로 반영했다.

**`src/app/api/report/generate/route.ts`** — 엔진 프록시 라우트 신규 추가
`sessionId`를 받아 `interviewRepository.findById()`로 `resumeText`와 `history`를 조회한 뒤 엔진에 전달한다. 엔진 내부 LLM timeout(60s)보다 여유 있게 `AbortSignal.timeout(90000)` + `maxDuration=120`으로 설정했다. history의 `type` 필드는 엔진 스키마에 없으므로 구조 분해로 제외(`{ type: _type, ...rest }`)했다. history 5개 미만이면 422를 바로 반환하고, Prisma `P2025`(세션 없음)는 404로 처리한다.

**`src/components/ReportResult.tsx`** — 8축 리포트 결과 렌더링 컴포넌트 신규 추가
기존 `score-grid-wrapper / axis-row / axis-row__*` CSS를 그대로 재활용했다. 상단에 종합 점수(`totalScore`)와 요약(`summary`)을 표시하고, `axisFeedbacks` 배열을 순회해 축별 점수 바와 피드백을 렌더링한다. `type === "strength"`이면 초록, `"improvement"`이면 보라 그라디언트를 적용한다.

**`src/app/(app)/interview/[sessionId]/report/page.tsx`** — 리포트 페이지 신규 추가
`useCallback`으로 추출한 `fetchReport`를 `useEffect`와 "다시 시도" 버튼 모두 재사용한다. 422 응답에는 "면접으로 돌아가기" 링크가 포함된 전용 UI를, 그 외 오류에는 재시도 버튼을 렌더링한다. 로딩 중에는 스피너와 "최대 60초 소요" 안내 문구를 표시한다.

**`src/app/(app)/interview/[sessionId]/page.tsx`** — "리포트 보기" 버튼 추가
`sessionComplete` 카드의 TODO 메시지와 "다시 하기" 단독 버튼을 제거하고, `router.push('/interview/${sessionId}/report')`로 이동하는 `btn-primary` 버튼을 추가했다. "다시 하기" 버튼은 `btn-outline`으로 아래 유지했다.

**`tests/api/report-generate-route.test.ts`** — API 라우트 테스트 5케이스
200(정상), 400(sessionId 없음), 404(세션 없음), 422(history 부족), 500(엔진 오류) 케이스를 `vi.hoisted()` 패턴으로 mock 작성했다.

**`tests/ui/report-result.test.tsx`** — ReportResult 컴포넌트 UI 테스트 5케이스
종합 점수·요약·8축 라벨·점수·피드백 렌더링, strength/improvement 색상 분기를 검증했다.

### 기술적 결정 사항
- Prisma 스키마 변경 없음 — 기존 `InterviewSession.resumeText`와 `history` 필드로 충분
- 엔진 재시도 없음 — LLM 비용 고려, 실패 시 사용자가 직접 재시도
- `score-grid-wrapper / axis-row` CSS 재활용 — 랜딩 페이지 `RadarChartInteractive.tsx`에서 이미 검증된 클래스이므로 별도 컴포넌트 추출 없이 바로 사용

