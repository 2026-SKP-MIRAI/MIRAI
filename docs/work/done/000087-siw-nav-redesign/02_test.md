# [#87] 테스트 전략 및 검증 보고서

> 작성: 2026-03-13

---

## 1. 단위 테스트 현황 (Vitest)

### API 테스트 (`tests/api/interview-complete-route.test.ts`)

환경: `node`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 200: 정상 종료 | `interviewRepository.complete()` 호출 → `{ ok: true }` | ✅ |
| 2 | 404: 세션 없음 | `Error("session_not_found")` throw → 404 | ✅ |
| 3 | 멱등성 | 이미 완료된 세션 재호출 → 200 (에러 없음) | ✅ |
| 4 | 500: 기타 오류 | 예상치 못한 에러 → 500 | ✅ |

### API 테스트 (`tests/api/growth-sessions-route.test.ts`)

환경: `node`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 200: 세션 목록 반환 | `listCompleted()` → `GrowthSession[]` 길이 2 | ✅ |
| 2 | 200: 빈 배열 | `listCompleted()` → `[]` | ✅ |
| 3 | resumeLabel 말줄임표 | resumeText 35자 → resumeLabel 31자 (30자+"…") | ✅ |
| 4 | 500: repository throws | `listCompleted()` 에러 → 500 | ✅ |

### UI 테스트 (`tests/ui/report-result.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | totalScore 렌더링 | `76` 텍스트 표시 | ✅ |
| 2 | summary 렌더링 | 요약 텍스트 표시 | ✅ |
| 3 | 8개 축 한국어 이름 | 의사소통/문제해결/논리적 사고/직무 전문성/조직 적합성/리더십/창의성/성실성 | ✅ |
| 4 | strength 피드백 | type=strength 축 레이블 렌더링 | ✅ |
| 5 | improvement 피드백 | 개선점 탭 클릭 후 피드백 텍스트 렌더링 | ✅ |
| 6 | 총평 탭 존재 | "총평" 탭 버튼 렌더링 | ✅ |
| 7 | 개선점 탭 존재 | "개선점" 탭 버튼 렌더링 | ✅ |

### UI 테스트 (`tests/ui/interview-new-page.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 페이지 렌더링 | "면접" 텍스트 heading 존재 | ✅ |
| 2 | 로딩 상태 | fetch pending 중 크래시 없이 렌더링 | ✅ |

### UI 테스트 (`tests/ui/interview-session-exit.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 면접 종료 버튼 렌더링 | "면접 종료" 버튼 존재 | ✅ |
| 2 | 모달 확인 | 종료 버튼 클릭 후 모달 텍스트 노출 | ✅ |

### UI 테스트 (`tests/ui/growth-page.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 성장 추이 heading 렌더링 | "성장 추이" 텍스트 존재 | ✅ |
| 2 | 세션 목록 렌더링 | fetch 후 "테스트 이력서 A" 표시 | ✅ |
| 3 | 빈 상태 메시지 | 빈 배열 반환 시 "면접을 완료" 텍스트 표시 | ✅ |

### UI 테스트 (`tests/ui/dashboard-page.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 대시보드 heading 렌더링 | "대시보드" 텍스트 존재 | ✅ |
| 2 | 세션 데이터 로드 | fetch 후 totalScore `76` 표시 | ✅ |
| 3 | 빈 상태 | 빈 배열 반환 시 크래시 없이 렌더링 | ✅ |

### UI 테스트 (`tests/ui/resumes-detail-page.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 이력서 상세 렌더링 | 이력서 상세 heading 존재 | ✅ |
| 2 | MOCK 배지 표시 | 8축 역량 평가 "준비 중" badge 존재 | ✅ |

---

## 2. 전체 테스트 결과 요약

| 구분 | 파일 수 | 케이스 수 | 결과 |
|------|--------|----------|------|
| API (신규) | 2 | 8 | ✅ 전체 통과 |
| UI (신규) | 5 | 17 | ✅ 전체 통과 |
| UI (수정) | 1 | 7 | ✅ 전체 통과 |
| **Phase 5 합계** | **8** | **27** | ✅ **27/27** |

---

## 2-B. Phase 7 추가 후 최종 테스트 결과 (2026-03-13)

### 변경 사항 (`report-result.test.tsx`)
- `getByText("76")` → `getAllByText("76").length > 0`
  - 원인: `ReportResult` 리뉴얼로 totalScore가 헤더 + `score-grid__summary-current` 두 곳에 렌더링되어 `getByText` 중복 오류 발생
  - 수정: `getAllByText`로 교체하여 복수 매칭 허용

### 최종 실행 결과

```
Test Files  18 passed (18)
Tests       79 passed (79)
Duration    4.62s
```

| 구분 | 파일 수 | 케이스 수 | 결과 |
|------|--------|----------|------|
| 기존 Phase 5 | 8 | 27 | ✅ 전체 통과 |
| 기존 기타 (unit, upload) | 10 | 52 | ✅ 전체 통과 |
| **전체 합계** | **18** | **79** | ✅ **79/79** |

---

## 2-C. Phase 8 (Critical/Warning 수정) 후 최종 테스트 결과 (2026-03-13)

### 변경 사항

| 파일 | 변경 내용 |
|------|----------|
| `tests/ui/report-result.test.tsx` | `getByText("76")` → `getAllByText("76").length > 0` (이전 Phase에서 수정됨, 유지) |
| `tests/ui/resumes-detail-page.test.tsx` | fetch mock 응답을 배열 `[{...}]` → 단건 객체 `{...}` 로 변경 — C3 수정으로 `/api/resumes/${id}` 단건 API 사용 반영 |

### 최종 실행 결과

```
Test Files  18 passed (18)
Tests       79 passed (79)
Duration    4.38s
```

| 구분 | 파일 수 | 케이스 수 | 결과 |
|------|--------|----------|------|
| Phase 5 (신규 API·UI) | 8 | 27 | ✅ 전체 통과 |
| Phase 7 (ReportResult 리뉴얼) | 1 | 7 | ✅ 전체 통과 |
| Phase 8 (C1~C3, W8~W10 수정) | 1 (mock 수정) | 2 | ✅ 전체 통과 |
| 기타 (unit, upload) | 8 | 43 | ✅ 전체 통과 |
| **전체 합계** | **18** | **79** | ✅ **79/79** |

---

## 3. Mock 전략

### API 테스트
- `vi.mock("@/lib/interview/interview-repository")` — `complete`, `listCompleted` vi.fn() 교체
- `vi.mock("@prisma/client")` — `Prisma.PrismaClientKnownRequestError` 클래스 mock 제공
- 각 케이스에서 `mockRejectedValueOnce` / `mockResolvedValueOnce` 로 분기 주입

### UI 테스트
- `vi.mock("chart.js")` + `vi.mock("react-chartjs-2")` — Radar/Line/Bar 컴포넌트를 `() => null`로 교체 (canvas 없는 jsdom 환경 대응)
- `vi.mock("framer-motion")` — `motion.div/button`을 일반 div/button으로 교체 (애니메이션 제거)
- `vi.mock("next/navigation")` — `useRouter({ push: vi.fn() })`, `useParams`, `useSearchParams` mock
- `global.fetch = vi.fn()` — URL 기반 분기로 `/api/growth/sessions`, `/api/resumes` 응답 mock

---

## 4. 미검증 영역 (향후 과제)

| 영역 | 우선순위 |
|------|----------|
| `/resumes/[id]` 8축 실데이터 연동 (auth #89 완료 후) | MEDIUM |
| `/growth` 세션 선택 → 차트 업데이트 상호작용 E2E | LOW |
| 면접 종료 모달 history 수 분기 (>=5 vs <5) UI 테스트 | LOW |
| `PATCH /complete` 멱등성 DB 레벨 검증 (integration) | LOW |

---

## 5. 아키텍처 불변식 검증 결과

| 불변식 | 결과 |
|--------|------|
| 인증은 siw에서만 | ✅ |
| AI API 호출은 엔진에서만 (siw → engine → LLM) | ✅ |
| 서비스 간 직접 통신 금지 | ✅ |
| DB는 siw 소유, engine은 stateless | ✅ |
| Prisma 스키마 변경: reportScores, reportTotalScore만 추가 (additive) | ✅ |
