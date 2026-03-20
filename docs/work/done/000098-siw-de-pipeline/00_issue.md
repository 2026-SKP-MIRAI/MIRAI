# feat: [siw][DE] Pipeline 1 대시보드 — LLM 옵저버빌리티 시각화 (기능별 호출·latency·에러율)

## 사용자 관점 목표
Pipeline 1(#95)에서 수집·집계된 LLM 호출 데이터를 시각화하여
운영자가 서비스 품질을 데이터로 모니터링하고 의사결정할 수 있다.

## 배경
#95 Pipeline 1이 `llm_events_daily` 테이블에 데이터를 쌓지만
이를 볼 수 있는 인터페이스가 없다.
대시보드까지 구현해야 "수집 → 변환 → 적재 → 시각화"
데이터 파이프라인 전체 사이클이 완성된다.

> 🚧 작업 시작 조건: #95 Pipeline 1 완료 이후 진행
> (llm_events_daily 데이터가 쌓여야 의미 있음)

## 완료 기준
- [x] `/dashboard/observability` 페이지 신규 — 관리자 인증 필요 (API 403 + 페이지 리다이렉트)
- [x] 기능별 일별 호출 건수 grouped bar chart
- [x] 평균 latency 추이 line chart (300ms·1500ms 기준선 포함)
- [x] 기능별 에러율 표시 (progress bar + CTA 버튼)
- [x] `GET /api/dashboard/observability` 엔드포인트 신규 — `llm_events_daily` 조회 후 반환
- [x] vitest: observability API 테스트 (7케이스) + UI 테스트 (5케이스)
- [x] 테스트 코드 포함 (154/154 전체 통과)
- [x] `services/siw/.ai.md` 최신화
- [x] 불변식 위반 없음
- [x] 관리자 권한 체크 (`user.app_metadata.role === "admin"`) — 비관리자 403

## 추가 구현 (AC 외 확장)
- [x] `prompt_tokens` + `completion_tokens` 컬럼 추가 (DB 마이그레이션 + DAG + 대시보드 Doughnut 차트)
- [x] 비용 추적 카드 (예상 AI 비용, 총 토큰 사용량)
- [x] 가중평균 latency/에러율 계산 (호출 건수 기준 — 단순 행 평균 대비 정확)
- [x] `dynamic({ ssr: false })` — hydration mismatch 완전 해결
- [x] 이미지 PDF 타임아웃 수정 (`resume_parse` 30s → 180s, `maxDuration` 60 → 300)
- [x] 인터뷰 토큰 추적 미구현 → 별도 이슈 #165 생성

## 작업 내역

### 2026-03-20 — 구현 완료

**변경 파일** (10개):
| 파일 | 작업 |
|------|------|
| `src/app/(app)/dashboard/observability/page.tsx` | `"use client"` + `dynamic({ ssr: false })` 래퍼 |
| `src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx` | 전체 대시보드 클라이언트 컴포넌트 (신규) |
| `src/app/api/dashboard/observability/route.ts` | GET API — 관리자 체크, 가중평균, 토큰 컬럼 (신규) |
| `src/lib/observability/schemas.ts` | Zod 스키마 — 토큰 필드 포함 (신규) |
| `airflow/dags/llm_quality_dag.py` | `prompt_tokens`, `completion_tokens` 집계/적재 추가 |
| `airflow/migrations/add_prompt_completion_tokens.sql` | DB 컬럼 마이그레이션 (신규) |
| `src/app/api/resumes/route.ts` | parse 타임아웃 180s, maxDuration 300 |
| `tests/api/observability-route.test.ts` | API 테스트 7케이스 (신규) |
| `tests/ui/observability-page.test.tsx` | UI 테스트 5케이스 (신규) |
| `tests/e2e/observability-dashboard.spec.ts` | E2E 테스트 6케이스 (신규) |

