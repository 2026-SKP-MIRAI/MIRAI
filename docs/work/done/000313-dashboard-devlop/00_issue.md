# feat: [siw] 운영 현황 대시보드 — 실제 데이터 출처 기반 전면 디벨롭

## 사용자 관점 목표

관리자는 AI 운영 현황을 실제 데이터 기반으로 한눈에 파악하고 이상 징후를 빠르게 감지할 수 있다.
사용자는 자신의 면접 성장 흐름을 직관적으로 확인하고 다음 행동을 즉시 결정할 수 있다.

## 배경

현재 대시보드 2종이 실제 데이터 출처를 갖고 있으나, 표현 방식과 구성이 현업 기준에 미치지 못한다.

### 현황 파악

**Observability 대시보드** (`/dashboard/observability`)
- 데이터 출처: `analytics.llm_events_daily` (PostgreSQL)
- 실제 로깅되는 feature_type 9개: `interview_start`, `interview_answer`, `interview_followup`, `report_generate`, `practice_feedback`, `resume_parse`, `resume_analyze`, `resume_questions`, `resume_feedback`
- **버그:** `FEATURE_META` 매핑이 실제 타입과 불일치 — 6개 타입이 한국어 이름 없이 raw key로 표시됨 (`interview_feedback`, `question_generate`, `answer_evaluate`, `feedback_generate`는 실제로 없는 타입)

**메인 대시보드** (`/dashboard`)
- 데이터 출처: `/api/growth/sessions`, `/api/resumes` (Supabase)
- KPI 4카드 + 최근 면접 기록 + 퀵 액션

### 현업 레퍼런스 기반 개선 근거

**LLM 운영 대시보드 (Langfuse, Grafana/OpenLIT, Datadog)**
- "평균은 거짓말한다" — 평균 레이턴시만 표시하면 테일 레이턴시 이상 감지 불가. 현재 `avgLatencyMs`만 표시 중 (출처: OpenTelemetry LLM Observability, OneUptime)
- feature/mode별 차원 분해(breakdown)가 없으면 원인 파악 불가 — 현재 feature 전체 혼합 표시 (출처: Langfuse Metrics, Datadog OpenAI Monitoring)
- 비용은 기능별로 귀속(attribution)되어야 예산 최적화 가능 (출처: Grafana Blog LLM in production)

**SRE 대시보드 설계 원칙 (OpenObserve, Cortex)**
- **3-30-300 규칙**: 3초 안에 KPI 스캔, 30초에 컨텍스트 파악, 300초에 드릴다운. 현재 KPI → 차트 순서가 이 흐름을 따르지 않음
- **위→아래 = 중요도 순**: 가장 critical한 지표(에러율, 레이턴시 이상)가 상단에 있어야 함
- **색상은 신호**: 에러율 임계값(5%) 기준선이 시각적으로 불명확

**개인 성장 대시보드 (Smashing Magazine, SimpleKPI, UX Design Awards)**
- **연속성 시각화**: Duolingo 스트릭 연구 — 연속 달성 일수 표시 시 재방문 60% 증가. 현재 미구현
- **캘린더 히트맵**: 과거 성취 패턴 인식에 효과적 (GitHub contribution graph 방식). 현재 리스트 형태만 존재
- **Zeigarnik Effect**: 미완료 상태 시각화가 완료 행동을 유발 — 빈 상태일 때 "첫 면접 시작하기" CTA 강화 필요
- **5초 규칙**: 가장 중요한 정보(성장률, 최근 점수)가 5초 내 파악 가능해야 함

## 완료 기준

- [x] Observability: `FEATURE_META`를 실제 9개 feature_type에 맞게 수정 (없는 타입 제거, 누락 타입 한국어 매핑 추가)
- [x] Observability: mode별 그룹핑(면접/연습/이력서) 시각화 추가 — Langfuse 차원 분해 원칙
- [x] Observability: 에러율 임계값(5%) 기준선 시각적 강조 명확화 — SRE 색상=신호 원칙
- [x] Observability: 레이아웃을 3-30-300 규칙 기반으로 재구성 (Critical KPI → 추이 차트 → 드릴다운 순)
- [x] 메인 대시보드: 연속 면접 일수(스트릭) 카드 추가 — 기존 sessions 데이터 기반 계산
- [x] 메인 대시보드: 최근 30일 면접 완료 캘린더 히트맵 추가 — 기존 sessions.createdAt 기반
- [x] 메인 대시보드: 빈 상태(sessions=0) UX 개선 — Zeigarnik Effect 기반 CTA 강화

## 구현 플랜

### 범위 제약
- 데이터 구조 변경 없음 — 기존 `analytics.llm_events_daily`, `growth/sessions`, resumes 데이터 안에서만 동작
- 새 API 엔드포인트 추가 없음 — 기존 `/api/dashboard/observability`, `/api/growth/sessions` 재사용

### 변경 대상 파일

**Observability 대시보드:**
1. `services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx`
   - `FEATURE_META` 수정 (실제 9개 타입 반영)
   - mode 그룹핑 섹션 추가 (interview 3개 / practice 1개 / resume 4개 / report 1개)
   - 레이아웃: Critical KPI (에러율 이상 감지) → 추이 → 기능별 드릴다운 순서 재배치
   - 에러율 5% 기준선 강조 개선

**메인 대시보드:**
2. `services/siw/src/app/(app)/dashboard/page.tsx`
   - 스트릭 카운터: sessions 배열에서 날짜 연속성 계산 로직 추가
   - 캘린더 히트맵: 최근 30일 sessions.createdAt 기반 그리드 렌더링
   - 빈 상태 분기: sessions.length === 0일 때 개선된 CTA UI

### 작업 순서
1. `FEATURE_META` 버그 수정 (가장 임팩트 크고 간단)
2. Observability 레이아웃 재구성 + mode 그룹핑
3. 메인 대시보드 스트릭 + 캘린더 히트맵

## 참고 출처
- Langfuse Metrics Overview: https://langfuse.com/docs/metrics/overview
- Grafana Blog LLM in production: https://grafana.com/blog/ai-observability-llms-in-production/
- Datadog OpenAI Monitoring: https://www.datadoghq.com/solutions/openai/
- OneUptime OpenTelemetry LLM: https://oneuptime.com/blog/post/2026-02-06-track-token-usage-prompt-costs-model-latency-opentelemetry/view
- OpenObserve SRE Dashboards: https://openobserve.ai/blog/metrics-dashboards-for-sre-devops/
- Cortex SRE Dashboard Guide: https://www.cortex.io/post/sre-dashboards
- Smashing Magazine Streak UX: https://www.smashingmagazine.com/2026/02/designing-streak-system-ux-psychology/
- UXPin Dashboard Principles: https://www.uxpin.com/studio/blog/dashboard-design-principles/

## 개발 체크리스트
- [x] 테스트 코드 포함 (21개)
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-28

**현황**: 7/7 완료

#### 신규 파일

**`services/siw/src/lib/observability/constants.ts`**
- FEATURE_META 9개 타입 한국어 매핑 (interview_start, interview_answer, interview_followup, report_generate, practice_feedback, resume_parse, resume_analyze, resume_questions, resume_feedback)
- FEATURE_MODE: feature_type → mode 매핑 (event-logger.ts와 DRY 원칙 유지)
- MODE_GROUPS: interview(4개) / practice(1개) / resume(4개) — report_generate는 interview 그룹에 포함

**`services/siw/src/app/(app)/dashboard/observability/useObservabilityCharts.ts`**
- 차트 계산 로직을 ObservabilityDashboard.tsx에서 분리한 순수 useMemo 훅
- 에러율: 최신 날짜 단일 기준 → 전체 기간 집계로 변경 (callCount<10 가드 유지)
- modeGroupStats: mode별 총호출/평균레이턴시/에러율/피처별 카운트 집계
- modeLatencyLineData: mode별 가중 평균 레이턴시 3개 선
- costLineData: 일별 비용(USD) 단일 라인

**`services/siw/src/app/(app)/dashboard/observability/__tests__/useObservabilityCharts.test.ts`**
- FEATURE_META 9개 타입 검증, 구 타입 부재 확인
- MODE_GROUPS 일관성 검증 (FEATURE_MODE와 교차 검증)
- featureName/featureDesc fallback 동작 검증
- 총 21개 테스트

**`services/siw/src/app/(app)/dashboard/.ai.md`**
- 대시보드 디렉토리 .ai.md 신규 작성

#### 수정 파일

**`services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx`**
- 3-30-300 레이아웃 재구성: KPI 5카드 → 기능 그룹별 현황 → 응답 속도 추이 → 일별 비용 → 기능별 오류율
- 기능 그룹별 현황: 실전 면접/연습 면접/이력서 분석 3컬럼 색상 카드, 그룹 점유율 바, 피처별 사용량 바
- 레이턴시 차트: feature 9개 → mode 3개 가중 평균으로 통합, 고정 기준선 제거 (LLM 구조상 300ms 기준 적용 불가)
- 에러율: errorLevel 색상 함수(정상/주의/위험), callCount<10 "데이터 부족" 배지, 전체 기간 집계
- 불필요 차트 제거: grouped bar, 이중 Y축 비용·토큰, 도넛 (그룹 카드에서 이미 커버)

**`services/siw/src/app/(app)/dashboard/page.tsx`**
- toKSTDateString(): UTC ISO → KST 날짜 문자열 (Intl API, Asia/Seoul)
- calcStreak(): KST 기준 연속 면접 일수, 오늘/어제부터 시작 조건
- calcHeatmap(): 최근 30일 날짜별 면접 횟수 맵
- KPI 5번째 카드: 연속 면접 일수 (Flame 아이콘), grid-cols-5
- 30일 히트맵: 보라색 농도 30컬럼 그리드
- 빈 상태: 3단계 온보딩 체크리스트 (이력서 업로드→첫 면접→리포트 확인)
- 세션 목록 스크롤바 숨김, "GitHub 기여 그래프 방식" 텍스트 제거

**`services/siw/src/app/(app)/dashboard/observability/.ai.md`**
- 새 구조·설계 결정 반영하여 업데이트
- 메인 대시보드: 빈 상태 UX 개선

**변경 파일**: 0개 (구현 미시작)

