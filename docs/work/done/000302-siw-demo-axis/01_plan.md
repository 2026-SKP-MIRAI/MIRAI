# [#302] feat: [siw] 데모 모드 전면 디벨롭 — 구현 계획

> 작성: 2026-03-27

---

## 완료 기준

- [x] 데모 모드 리포트에서 상위 3개 점수 축만 동적으로 표시
- [x] AbortController로 페이지 이탈 시 in-flight fetch 취소
- [x] evaluate.test.ts mock axisFeedbacks 8개 (엔진 계약 준수)
- [x] 모바일(390px~) 결과 섹션 정상 표시
- [x] 회원가입 "*필수" 텍스트 제거
- [x] tech_lead 페르소나 질문 도메인 중립화

---

## ADR (Architecture Decision Record)

- **Decision**: Option A — 프론트엔드 전용 필터링 (엔진 변경 없음)
- **Drivers**:
  1. `ReportResponse.axisFeedbacks: min_length=8, max_length=8` 계약 보존
  2. 데모 전용 범위 한정 — 다른 4개 서비스에 영향 없음
  3. 최소 변경으로 빠른 배포
- **Alternatives considered**:
  - Option B (엔진 API에 personas 파라미터 추가): `axisFeedbacks` min/max 제약 파괴, 4개 서비스 regression risk — 기각
- **Consequences**: 엔진이 불필요한 5축도 계산하나 비용 무시 가능
- **Follow-ups**: 향후 페르소나별 리포트 기능 도입 시 엔진 API 확장 검토

---

## 구현 내역

### 1. 평가축 동적화 (`demo/page.tsx`)

고정 `DEMO_AXES` 제거 → `topAxes` useMemo로 상위 3축 동적 계산:
```ts
const topAxes = useMemo(
  () => evaluation?.axisFeedbacks
    ?.filter(f => f.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 3)
    .map(f => f.axis) ?? [],
  [evaluation?.axisFeedbacks]
)
```
- `demoAxesFeedbacks`, `improvements`, `strengths` 모두 `topAxes` 기반 필터링
- `AxisFeedback.score: number` → `number | null` (타입-런타임 정합성)

### 2. AbortController (`demo/page.tsx`)

```ts
const abortRef = useRef<AbortController | null>(null)
useEffect(() => { return () => { abortRef.current?.abort() } }, [])
```
- 페이지 이탈·재요청 시 이전 fetch 자동 취소
- catch에서 `AbortError` 무시

### 3. 에러 핸들링 개선 (`demo/page.tsx`)

`handleSubmit`에서 feedback/evaluate 양쪽 모두 실패 시 에러 상태 분기 추가.

### 4. 모바일 반응형 (`demo/page.tsx`)

| 변경 | 내용 |
|---|---|
| 결과 그리드 | `grid-cols-2` → `grid-cols-1 md:grid-cols-2` |
| 레이더 순서 | `order-last md:order-none` (모바일에서 점수 먼저) |
| 점수 폰트 | `style fontSize 80px` → `text-[48px] md:text-[80px]` |
| 레이더 너비 | `max-w-[420px]` → `max-w-full md:max-w-[420px]` |
| 패딩 | `p-8` → `p-5 md:p-8` / `p-4 md:p-8` |

### 5. 회원가입 UI (`signup/page.tsx`)

이용약관·개인정보 체크박스의 `<span class="text-destructive">*필수</span>` 제거. 검증 로직 유지.

### 6. 엔진 프롬프트 도메인 중립화 (`interview_tech_lead_v3.md`)

Few-shot 예시의 소프트웨어 편향 언어 → 도메인 중립 언어로 교체.
- `[도구/방법론]` → `[직무 도메인]에서 [특정 방법/접근법]`
- 비개발 직군(바리스타, 마케터 등)도 도메인 맞는 질문 생성

### 7. 테스트 (`evaluate.test.ts`)

mock `axisFeedbacks` 3→8개, `toHaveLength(8)` (엔진 계약 준수).
