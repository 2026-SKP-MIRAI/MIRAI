# Issue #302 코드베이스 탐색 결과

> 작성: 2026-03-27  
> 탐색 대상: 데모 모드 8축 정량평가 지표를 기술팀장 평가 축으로 수정하기 위한 영향 범위 파악

---

## 1. 현재 상태 분석

### 1.1 데모 페이지 구조
**파일**: `services/siw/src/app/(landing)/demo/page.tsx`

| 항목 | 내용 | 코드 위치 |
|------|------|---------|
| **표시 축 (데모용)** | 3축 고정 필터링 | 64행: `const DEMO_AXES = ["communication", "cultureFit", "sincerity"]` |
| **전체 8축 정의** | 모두 정의됨 | 66-75행: `ALL_AXIS_LABELS` |
| **레이더 차트** | 8축 모두 렌더링 (블러 + 오버레이) | 192-207행: `radarData` |
| **점수 표시** | demo용 3축만 필터링 표시 | 209-212행: `demoAxesFeedbacks` |

**현황**: 데모 페이지는 3축 고정 필터링 적용함 ✓

---

### 1.2 기술팀장 페르소나 평가 축
**파일**: `engine/app/prompts/interview_followup_tech_lead_v3.md` (라인 7)

```
담당 평가 축: jobExpertise, problemSolving, logicalThinking
```

**불일치 내용**:
| 대상 | 축 | 비고 |
|------|-----|------|
| **Demo 페이지** | communication, cultureFit, sincerity | HR/경영진 영역 포함 |
| **기술팀장** | jobExpertise, problemSolving, logicalThinking | 기술 역량 중심 |

→ **완전히 다름** (불일치 확인됨)

---

### 1.3 ReportResult 컴포넌트
**파일**: `services/siw/src/components/ReportResult.tsx` (라인 18-27)

```typescript
const AXIS_LABELS: Record<string, string> = {
  communication: "의사소통",
  problemSolving: "문제해결",
  logicalThinking: "논리적 사고",
  jobExpertise: "직무 전문성",
  cultureFit: "조직 적합성",
  leadership: "리더십",
  creativity: "창의성",
  sincerity: "성실성",
};
```

**현황**:
- 8축 고정 정의
- 렌더링 시 `report.axisFeedbacks` 배열을 그대로 순회 (라인 167)
- **페르소나별 필터링 없음** ✗

---

### 1.4 엔진 점수 계산 로직
**파일**: `engine/app/services/report_service.py`

**AXIS_KEYS** (라인 13-22): 8축 고정 정의

**점수 계산 함수** (라인 72-144):
- `_score_communication()`: STAR 60% + 명확성 40%
- `_score_leadership()`: 주도성 70% + 구체성 30%
- `_score_problem_solving()`: 원인분석 35% + 대안 35% + STAR 30%
- `_score_logical_thinking()`: STAR 50% + 인과관계 40% + 모호성 페널티
- `_score_job_expertise()`: 구체성 50% + 성과 40% + 기본 10%
- `_score_culture_fit()`: 주도성 40% + 명확성 30% + STAR 20% + 기본 10%
- `_score_creativity()`: 대안 50% + 성과 30% + 구체성 10% + 기본 10%
- `_score_sincerity()`: STAR 40% + 길이 35% + 명확성 15% + 기본 10%

**현황**:
- 모든 8축을 **항상 계산** (라인 159-161)
- **페르소나 정보를 받지 않음** → 축 필터링 불가능 ✗

---

### 1.5 리포트 생성 프롬프트
**파일**: `report_evaluation_v2.md`

**프롬프트 요구사항** (라인 22):
```
- `axisFeedbacks`는 반드시 8개 항목을 모두 포함해야 합니다.
```

**현황**:
- 프롬프트가 8축 고정 요구
- 페르소나 정보를 받지 않음 ✗

---

### 1.6 데모 API 라우트 - /api/demo/evaluate
**파일**: `services/siw/src/app/api/demo/evaluate/route.ts` (라인 34-42)

```typescript
const engineRes = await fetch(engineUrl, {
  method: "POST",
  body: JSON.stringify({
    resumeText: `지원 직무: ${targetRole}\n\n이력서 미제출 상태입니다.`,
    history,  // 5개 반복된 항목 (persona 포함)
  }),
})
```

**현황**:
- 엔진 호출 시 `persona` 정보를 **전달하지 않음** ✗
- history 항목에 persona 정보는 있으나, 축 필터링을 위한 metadata로 전달되지 않음

---

### 1.7 테스트 파일
**파일**: `services/siw/src/app/api/demo/__tests__/evaluate.test.ts`

```typescript
const mockEvaluateResponse = {
  scores: { communication: 80, problemSolving: 70, ... },  // 8축
  axisFeedbacks: [
    { axis: 'communication', ... },
    { axis: 'cultureFit', ... },
    { axis: 'sincerity', ... },
  ],
}

it('8축 scores + axisFeedbacks 반환', async () => {
  expect(Object.keys(data.scores)).toHaveLength(8)  // 라인 92
})
```

**현황**:
- 테스트가 8축 반환을 검증
- 변경 필요: 기술팀장 모드 시 3축만 반환하도록 수정

---

## 2. 데이터 흐름

```
Demo 페이지
    ↓
/api/demo/question → engine /api/interview/start
    (personas: ["tech_lead"]) ✓
    ↓
User answers question
    ↓
/api/demo/evaluate → engine /api/report/generate
    (persona 정보 미포함) ✗
    ↓
engine report_service.py
    - _apply_rubric() : 8축 모두 계산 (페르소나 정보 없음)
    - _build_prompt_v2() : report_evaluation_v2.md 렌더링
    - LLM 호출 : 8축 고정
    ↓
ReportResponse (8축 scores + axisFeedbacks)
    ↓
Demo 페이지 / ReportResult
    - Demo: 3축만 필터링 표시
    - ReportResult: 8축 모두 표시 (페르소나별 필터링 없음)
```

---

## 3. 변경 필요 파일 및 영향도

### 높음 (필수 변경)
| 파일 | 변경 내용 |
|------|---------|
| `engine/app/services/report_service.py` | 페르소나 정보 수신 → 축 필터링 로직 추가 |
| `engine/app/prompts/report_evaluation_v2.md` | 페르소나별 축 목록 동적화 |

### 중간 (연결/렌더링)
| 파일 | 변경 내용 |
|------|---------|
| `services/siw/src/app/api/demo/evaluate/route.ts` | persona 정보를 엔진에 전달 |
| `services/siw/src/components/ReportResult.tsx` | 페르소나별 축 필터링 렌더링 |

### 낮음 (선택적)
| 파일 | 변경 내용 |
|------|---------|
| `services/siw/src/app/(landing)/demo/page.tsx` | 필터링 로직 통합 (이미 부분 적용) |

### 수정 대상 아님
- `services/siw/src/lib/types.ts` : AxisScores, AxisFeedback 타입은 8축 고정 유지 (백호환성)
- `services/siw/src/app/api/demo/question/route.ts` : 이미 완료
- 일반 리포트 페이지 (seung, kwan, fint) : 8축 유지

---

## 4. 테스트 파일 변경

| 파일 | 변경 사항 |
|------|---------|
| `services/siw/src/app/api/demo/__tests__/evaluate.test.ts` | 8축 검증 → 3축 검증 (라인 92) |
| `engine/tests/unit/services/test_report_service.py` | 페르소나별 축 필터링 테스트 추가 (신규) |

---

## 5. 기술팀장 평가 축 (확정)

```
기술팀장 (tech_lead):
- jobExpertise      (직무 전문성)
- problemSolving    (문제해결)
- logicalThinking   (논리적 사고)
```

---

## 6. 구현 전략

### 옵션 A: 프론트에서 필터링 (빠름, 임시해결)
- 엔진: 변경 없음 (8축 모두 반환)
- 프론트: 축 필터링
- **장점**: 빠른 배포
- **단점**: 책임 불명확

### 옵션 B: 엔진에서 필터링 (정리됨, 권장)
- 엔진: `personas` 정보 수신 → 축 필터링
- 프롬프트: 페르소나별 축 목록 동적화
- **장점**: 설계 명확, 재사용성 높음
- **단점**: 엔진 수정 범위 큼

**권장**: **옵션 B**

---

## 7. 파일 경로

```
engine/
├── app/services/report_service.py
├── app/prompts/report_evaluation_v2.md
└── app/schemas.py

services/siw/
├── src/app/(landing)/demo/page.tsx
├── src/app/api/demo/evaluate/route.ts
├── src/components/ReportResult.tsx
├── src/lib/types.ts
└── src/app/api/demo/__tests__/evaluate.test.ts
```

---
