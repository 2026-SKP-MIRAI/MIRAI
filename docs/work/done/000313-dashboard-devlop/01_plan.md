# [#313] feat: [siw] 운영 현황 대시보드 — 실제 데이터 출처 기반 전면 디벨롭 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [ ] Observability: `FEATURE_META`를 실제 9개 feature_type에 맞게 수정 (없는 타입 제거, 누락 타입 한국어 매핑 추가)
- [ ] Observability: mode별 그룹핑(면접/연습/이력서) 시각화 추가 — Langfuse 차원 분해 원칙
- [ ] Observability: 에러율 임계값(5%) 기준선 시각적 강조 명확화 — SRE 색상=신호 원칙
- [ ] Observability: 레이아웃을 3-30-300 규칙 기반으로 재구성 (Critical KPI → 추이 차트 → 드릴다운 순)
- [ ] 메인 대시보드: 연속 면접 일수(스트릭) 카드 추가 — 기존 sessions 데이터 기반 계산
- [ ] 메인 대시보드: 최근 30일 면접 완료 캘린더 히트맵 추가 — 기존 sessions.createdAt 기반
- [ ] 메인 대시보드: 빈 상태(sessions=0) UX 개선 — Zeigarnik Effect 기반 CTA 강화

---

## 구현 계획

> 전체 플랜: `.omc/plans/000313-dashboard-devlop.md` 참조

### 작업 순서 요약

1. **Step 1**: `FEATURE_META` 버그 수정 + `constants.ts` 공유 모듈 추출
   - 실제 9개 타입 반영, 없는 4개 제거
   - `event-logger.ts`의 `FEATURE_MODE`를 `lib/observability/constants.ts`로 이전 (DRY)
   - MODE_GROUPS 3개 그룹 정의: interview(4개) / practice(1개) / resume(4개)
   - ⚠️ `report_generate`는 `event-logger.ts` 기준 interview 모드에 속함

2. **Step 2**: Observability 레이아웃 재구성 + 훅 분리
   - `useObservabilityCharts.ts` 훅 추출 (차트 계산 로직 분리)
   - 3-30-300 레이아웃 재배치
   - 에러율 5% 기준선 강조 (callCount ≥ 10인 경우에만, 미만은 "데이터 부족" 표시)
   - mode별 그룹핑 (3개 그룹 탭/접이식)

3. **Step 3**: 메인 대시보드 개선
   - `toKSTDateString()` 유틸 함수 추가 (UTC ISO → KST 날짜 문자열, `Asia/Seoul` 타임존)
   - 스트릭 카드: KST 기준 연속 일수 계산
   - 30일 캘린더 히트맵: KST 기준 날짜 집계
   - 빈 상태 UX: Zeigarnik Effect 기반 3단계 온보딩 체크리스트

4. **Step 4**: 테스트 + .ai.md 최신화
   - KST 타임존 경계 케이스 포함 (UTC 14:59 vs 15:00)
   - callCount 가드 테스트
   - useObservabilityCharts 훅 단위 테스트

### 변경 대상 파일

| 파일 | 유형 | Step |
|------|------|------|
| `services/siw/src/lib/observability/constants.ts` | **신규** | 1 |
| `services/siw/src/app/(app)/dashboard/observability/useObservabilityCharts.ts` | **신규** | 2 |
| `services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx` | 수정 | 1, 2 |
| `services/siw/src/app/(app)/dashboard/page.tsx` | 수정 | 3 |
| `services/siw/src/app/(app)/dashboard/observability/__tests__/` | **신규** | 4 |
| `services/siw/src/app/(app)/dashboard/__tests__/` | **신규** | 4 |
| `services/siw/src/app/(app)/dashboard/.ai.md` | 수정 | 4 |
| `services/siw/src/app/(app)/dashboard/observability/.ai.md` | 수정 | 4 |

> 전체 상세 플랜: `.omc/plans/000313-dashboard-devlop.md` 참조
