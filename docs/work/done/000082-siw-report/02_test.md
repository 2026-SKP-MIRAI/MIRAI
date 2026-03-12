# [#82] 테스트 전략 및 검증 보고서

> 작성: 2026-03-12

---

## 1. 단위 테스트 현황 (Vitest)

### API 테스트 (`tests/api/report-generate-route.test.ts`)

환경: `node` (vitest.config.ts `environmentMatchGlobs` 설정)

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | 200 | history 5개 이상 → 리포트 반환, `totalScore=76`, `axisFeedbacks.length=8` | ✅ |
| 2 | 400 | `sessionId` 없음 → 400 Bad Request | ✅ |
| 3 | 422 | `history.length < 5` → 422, message에 "최소 5개" 포함 | ✅ |
| 4 | 404 | Prisma P2025 → 404 Not Found | ✅ |
| 5 | 500 | engine fetch 실패 → 500 Internal Server Error | ✅ |

### UI 테스트 (`tests/ui/report-result.test.tsx`)

환경: `jsdom`

| # | 케이스 | 검증 내용 | 상태 |
|---|--------|----------|------|
| 1 | totalScore 렌더링 | `76` 텍스트 표시 | ✅ |
| 2 | summary 렌더링 | 요약 텍스트 표시 | ✅ |
| 3 | 8개 축 한국어 이름 | 의사소통/문제해결/논리적 사고/직무 전문성/조직 적합성/리더십/창의성/성실성 | ✅ |
| 4 | strength 피드백 | type=strength 피드백 텍스트 렌더링 | ✅ |
| 5 | improvement 피드백 | type=improvement 피드백 텍스트 렌더링 | ✅ |

---

## 2. 수정된 테스트 이슈

### vi.mock 호이스팅 버그 (CRITICAL → 해결됨)

**원인**: Vitest는 `vi.mock()` 호출을 파일 최상단으로 호이스팅합니다. `const mockSession = { ... }` 선언이 팩토리보다 **나중에** 평가되어 팩토리 내 `mockSession = undefined`.

**영향**: 모든 테스트가 `mockResolvedValueOnce`로 override하므로 우연히 통과. 새 테스트 추가 시 `session is undefined` 오류 발생.

**해결**: `vi.hoisted()` 사용 — 팩토리 함수가 호이스팅과 함께 최상단에서 평가됨.

```typescript
const { mockSession, mockReportResponse } = vi.hoisted(() => ({
  mockSession: { id: "test-session-id", resumeText: "테스트 자소서", history: [...5개...], ... },
  mockReportResponse: { scores: {...}, totalScore: 76, ... },
}));
```

---

## 3. E2E 테스트 전략 (Playwright)

### 테스트 파일: `tests/e2e/report.spec.ts`

| # | 시나리오 | Mock 방법 |
|---|---------|----------|
| 1 | 면접 완료 → "리포트 보기" 버튼 표시 | sessionStorage + `page.route()` mock |
| 2 | 리포트 페이지 로딩 스피너 | `page.route()` 지연 응답 |
| 3 | 422 → "질문을 더 진행해 주세요" + "면접으로 돌아가기" | `page.route()` 422 응답 |
| 4 | 성공 → totalScore/summary/8축 렌더링 | `page.route()` 200 mock 리포트 |
| 5 | 500 → "다시 시도" 버튼 | `page.route()` 500 응답 |

**Mock 전략**: `page.route("/api/report/generate", handler)` — 실제 서버 없이 API intercept

---

## 4. 미검증 영역 (향후 과제)

| 영역 | 우선순위 |
|------|----------|
| `report/page.tsx` 로딩 스피너 UI 테스트 | LOW |
| `report/page.tsx` 422 에러 UI 테스트 | LOW |
| `report/page.tsx` 기타 에러 + 다시 시도 UI 테스트 | LOW |
| 엔진 타임아웃 시나리오 (90s) E2E | VERY LOW |

---

## 5. 아키텍처 불변식 검증 결과

| 불변식 | 결과 |
|--------|------|
| 인증은 siw에서만 | ✅ |
| AI API 호출은 엔진에서만 (siw → engine → LLM) | ✅ |
| 서비스 간 직접 통신 금지 | ✅ |
| DB는 siw 소유, engine은 stateless (리포트 DB 저장 없음) | ✅ |
| Prisma 스키마 변경 없음 | ✅ |
