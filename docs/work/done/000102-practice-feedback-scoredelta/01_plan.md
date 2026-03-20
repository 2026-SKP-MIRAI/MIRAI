# [#102] fix(engine): practice feedback scoreDelta LLM 추정값 불일치 — 서버 계산으로 교체

> 작성: 2026-03-20 | 업데이트: 2026-03-20

---

## 완료 기준

- [ ] 이전 85점 → 재답변 88점 시 `scoreDelta = +3` 표시
- [ ] `previousScore` 없는 첫 답변은 `comparisonDelta = null` 유지

---

## 구현 계획

### RALPLAN-DR 요약

**원칙**
1. 산술은 LLM이 아닌 코드에서 수행
2. 하위 호환성 유지 (`previousScore` 선택 필드)
3. 최소 변경 범위

**결정 드라이버**: 정확성 > 하위 호환 > 최소 변경

**선택지**

| 옵션 | 설명 | 결과 |
|------|------|------|
| A. 엔진 후처리 오버라이드 | LLM 응답 파싱 후 `scoreDelta` 덮어쓰기 | **채택** |
| B. LLM 프롬프트 개선 | 프롬프트에 이전 점수 주입 | 기각 — LLM 산술 오류 잔존 위험 |
| C. DB 기반 조회 | 서비스 DB에서 이전 score 조회 | 기각 — 엔진 stateless 불변식 위반 |

**Synthesis**: 이슈 #102는 클라이언트 상태 기반으로 구현하되, `route.ts`에서 향후 DB 조회로 교체 가능한 추상화 지점을 명확히 남긴다.

---

### Step 1: engine/app/schemas.py

`PracticeFeedbackRequest`에 `previousScore` 선택 필드 추가 (L160 다음 줄):

**현재 코드 (L157-161)**
```python
class PracticeFeedbackRequest(BaseModel):
    question:       str          = Field(..., min_length=1, description="면접 질문")
    answer:         str          = Field(..., min_length=1, max_length=5000, description="사용자 답변")
    previousAnswer: str | None   = Field(None, min_length=1, max_length=5000, description="이전 답변 (비교용, 선택)")
```

**변경 후 코드**
```python
class PracticeFeedbackRequest(BaseModel):
    question:       str          = Field(..., min_length=1, description="면접 질문")
    answer:         str          = Field(..., min_length=1, max_length=5000, description="사용자 답변")
    previousAnswer: str | None   = Field(None, min_length=1, max_length=5000, description="이전 답변 (비교용, 선택)")
    previousScore:  int | None   = Field(None, ge=0, le=100, description="이전 답변 점수 (scoreDelta 서버 계산용, 선택)")
```

**검증**: `previousScore=None`이면 기존 동작 유지 (하위 호환).

---

### Step 2: engine/app/services/practice_service.py

`generate_practice_feedback()`에 `previous_score` keyword-only 파라미터 추가 후, `_parse_feedback()` 반환값의 `scoreDelta`를 오버라이드.

**현재 시그니처 (L92-109)**
```python
def generate_practice_feedback(
    question: str,
    answer: str,
    previous_answer: str | None = None,
    *,
    model: str | None = None,
) -> tuple[PracticeFeedbackResponse, UsageMetadata | None]:
    is_retry = previous_answer is not None
    prompt = _build_retry_prompt(question, previous_answer, answer) if is_retry \
             else _build_prompt(question, answer)
    result = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="연습 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    return _parse_feedback(result.content, is_retry=is_retry), _usage_to_metadata(result.usage, result.model)
```

**변경 후 코드**
```python
def generate_practice_feedback(
    question: str,
    answer: str,
    previous_answer: str | None = None,
    *,
    previous_score: int | None = None,
    model: str | None = None,
) -> tuple[PracticeFeedbackResponse, UsageMetadata | None]:
    is_retry = previous_answer is not None
    prompt = _build_retry_prompt(question, previous_answer, answer) if is_retry \
             else _build_prompt(question, answer)
    result = call_llm(
        prompt,
        model=model,
        timeout=30.0,
        max_tokens=2048,
        error_message="연습 피드백 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    )
    response = _parse_feedback(result.content, is_retry=is_retry)

    # previousScore가 있으면 LLM 추정값 대신 서버에서 직접 계산
    if response.comparisonDelta is not None and previous_score is not None:
        response.comparisonDelta.scoreDelta = max(-100, min(100, response.score - previous_score))

    return response, _usage_to_metadata(result.usage, result.model)
```

**변경 위치**:
- L97: `previous_score: int | None = None,` 파라미터 추가 (keyword-only, `*` 뒤)
- L109: `return` 전에 delta 오버라이드 로직 삽입

**설계 판단**:
- `previous_score`가 None이면 기존 동작 유지 (LLM 추정값 그대로 사용 또는 None)
- `comparisonDelta`가 None인데 `previous_score`가 있는 경우: `is_retry=False` 이거나 LLM이 delta를 반환 안 한 경우 → 오버라이드 하지 않음
- `clamp(-100, 100)`: `ComparisonDelta.scoreDelta` 필드의 `ge=-100, le=100` Pydantic 제약 준수

---

### Step 3: engine/app/routers/practice.py

`body.previousScore`를 `keyword-only` 파라미터로 서비스에 전달.

**현재 코드 (L1-16)**
```python
from fastapi import APIRouter
from app.schemas import PracticeFeedbackRequest, PracticeFeedbackResponse
from app.services.practice_service import generate_practice_feedback

router = APIRouter()


@router.post("/practice/feedback", response_model=PracticeFeedbackResponse)
async def practice_feedback_endpoint(body: PracticeFeedbackRequest):
    data, usage = generate_practice_feedback(
        body.question,
        body.answer,
        body.previousAnswer,
    )
    data.usage = usage
    return data
```

**변경 후 코드**
```python
from fastapi import APIRouter
from app.schemas import PracticeFeedbackRequest, PracticeFeedbackResponse
from app.services.practice_service import generate_practice_feedback

router = APIRouter()


@router.post("/practice/feedback", response_model=PracticeFeedbackResponse)
async def practice_feedback_endpoint(body: PracticeFeedbackRequest):
    data, usage = generate_practice_feedback(
        body.question,
        body.answer,
        body.previousAnswer,
        previous_score=body.previousScore,
    )
    data.usage = usage
    return data
```

**변경 위치**: L13에 `previous_score=body.previousScore,` 추가.

---

### Step 4: services/siw/src/app/api/practice/feedback/route.ts

`previousScore`를 body에서 추출하여 엔진으로 전달. 향후 DB 교체 지점 주석 명시.

**변경 후 코드 (전체)**
```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const { question, answer, previousAnswer, previousScore } = body;
  // TODO(#102): 향후 DB에서 세션의 마지막 점수를 조회하는 로직으로 교체
  //   const previousScore = await getPreviousScoreFromDB(sessionId);

  const engineUrl =
    (process.env.ENGINE_BASE_URL ?? "http://localhost:8000") + "/api/practice/feedback";

  try {
    const data = await withEventLogging('practice_feedback', null, async (meta) => {
      const engineRes = await fetch(engineUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, previousAnswer, previousScore }),
        signal: AbortSignal.timeout(30000),
      });
      const d = await engineRes.json();
      if (!engineRes.ok)
        throw Object.assign(new Error("engine_practice_failed"), { data: d, status: engineRes.status });
      if (d.usage) meta.usage = d.usage;
      return d;
    });
    return Response.json(data, { status: 200 });
  } catch (err) {
    if (err instanceof Error && 'data' in err) {
      const errData = (err as { data: { detail?: string } }).data;
      const status = (err as unknown as { status: number }).status;
      if (status === 400)
        return Response.json({ message: errData.detail ?? "잘못된 요청입니다." }, { status: 400 });
      return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });
    }
    return Response.json({ message: "피드백 생성에 실패했습니다." }, { status: 500 });
  }
}
```

**변경 요약**:
- destructuring에 `previousScore` 추가
- `JSON.stringify`에 `previousScore` 포함

---

### Step 5: services/siw/src/app/(app)/interview/[sessionId]/page.tsx

4가지 변경사항:

**변경 1: `lastScore` 상태 선언 (라인 23 근처, `lastAnswer` 다음)**

```typescript
// 변경 전
const [lastAnswer, setLastAnswer] = useState("");
const [practiceAnswer, setPracticeAnswer] = useState("");

// 변경 후
const [lastAnswer, setLastAnswer] = useState("");
const [lastScore, setLastScore] = useState<number | null>(null);  // 추가
const [practiceAnswer, setPracticeAnswer] = useState("");
```

**변경 2: 첫 답변 시 `lastScore` 저장 (라인 90-92 근처)**

```typescript
// 변경 전
if (!isRetried) {
  setLastAnswer(currentAnswerText);
}

// 변경 후
if (!isRetried) {
  setLastAnswer(currentAnswerText);
  setLastScore(data.score);  // 첫 답변의 점수를 기억 (재답변 비교 기준)
}
```

**변경 3: 재답변 요청 body에 `previousScore` 추가 (라인 76-80 근처)**

```typescript
// 변경 전
const body: Record<string, string> = {
  question: currentQuestion?.question ?? "",
  answer: currentAnswerText,
};
if (prevAnswer) body.previousAnswer = prevAnswer;

// 변경 후
const body: Record<string, unknown> = {
  question: currentQuestion?.question ?? "",
  answer: currentAnswerText,
};
if (prevAnswer) body.previousAnswer = prevAnswer;
if (isRetried && lastScore !== null) body.previousScore = lastScore;
```

> 주의: `Record<string, string>` → `Record<string, unknown>`으로 타입 변경 필요 (number 값 허용).

**변경 4: `handleNextQuestion`에서 `lastScore` 초기화 (라인 129-131 근처)**

```typescript
// 변경 전
setPracticeFeedback(null);
setIsRetried(false);
setLastAnswer("");
setPracticeAnswer("");

// 변경 후
setPracticeFeedback(null);
setIsRetried(false);
setLastAnswer("");
setLastScore(null);  // 다음 질문으로 넘어갈 때 점수 기준점 초기화
setPracticeAnswer("");
```

---

### Step 6: 테스트 작성

#### 6-1. 단위 테스트 (pytest)

파일: `engine/tests/unit/services/test_practice_service.py`

기존 파일 하단에 테스트 14, 15, 16 추가:

```python
# ── 테스트 14 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_overridden_by_previous_score():
    """previousScore 전달 시 scoreDelta = new_score - previous_score (서버 계산)"""
    # LLM이 score=88, scoreDelta=13 (추정값 불일치) 반환하는 시나리오
    json_str = json.dumps({
        "score": 88,
        "feedback": {"good": ["향상됨"], "improve": ["아직 부족"]},
        "keywords": ["STAR"],
        "improvedAnswerGuide": "더 향상됨",
        "comparisonDelta": {"scoreDelta": 13, "improvements": ["수치 추가"]},
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변", "이전답변",
            previous_score=85,
        )
    assert result.comparisonDelta is not None
    # 88 - 85 = 3, LLM 추정값 13이 아닌 서버 계산값 3이어야 함
    assert result.comparisonDelta.scoreDelta == 3


# ── 테스트 15 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_none_without_previous_score():
    """previousAnswer 없으면 comparisonDelta=None, previousScore 있어도 무시"""
    json_str = _single_json()
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변",
            previous_score=85,  # previousAnswer 없으면 comparisonDelta=None
        )
    assert result.comparisonDelta is None


# ── 테스트 16 ─────────────────────────────────────────────────────────────────

def test_generate_practice_feedback_score_delta_clamped_to_minus100_plus100():
    """scoreDelta가 -100~+100 범위를 벗어나는 경우 clamp 처리"""
    # 극단적 케이스: previous_score=0, new_score=100 → delta=100 (경계값)
    json_str = json.dumps({
        "score": 100,
        "feedback": {"good": ["완벽"], "improve": ["없음"]},
        "keywords": ["STAR"],
        "improvedAnswerGuide": "완벽한 답변",
        "comparisonDelta": {"scoreDelta": 50, "improvements": []},
    })
    with patch("app.services.llm_client.OpenAI", return_value=make_mock_llm(json_str)):
        from app.services.practice_service import generate_practice_feedback
        result, _ = generate_practice_feedback(
            "질문", "답변", "이전답변",
            previous_score=0,
        )
    assert result.comparisonDelta is not None
    # 100 - 0 = 100, 경계값 그대로
    assert result.comparisonDelta.scoreDelta == 100
    assert -100 <= result.comparisonDelta.scoreDelta <= 100
```

#### 6-2. 통합 테스트 (Vitest)

파일: `services/siw/tests/api/practice-feedback-route.test.ts`

기존 `describe` 블록 내에 추가:

```typescript
it("첫 답변: previousScore 없이 요청 → comparisonDelta null", async () => {
  // global.fetch mock은 beforeEach에서 이미 mockFeedbackResponse(comparisonDelta: null) 반환
  const { POST } = await import("@/app/api/practice/feedback/route");
  const req = new Request("http://localhost/api/practice/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "자기소개 해주세요.",
      answer: "저는 개발자입니다.",
      // previousScore 없음
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.comparisonDelta).toBeNull();

  // 엔진으로 previousScore 없이 전달되었는지 확인
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/practice/feedback"),
    expect.objectContaining({
      body: expect.not.stringContaining("previousScore"),
    })
  );
});

it("재답변: previousScore=85 포함 요청 → scoreDelta=+3 반환", async () => {
  const responseWithDelta = {
    score: 88,
    feedback: { good: ["개선됨"], improve: [] },
    keywords: ["리더십"],
    improvedAnswerGuide: "가이드",
    comparisonDelta: { scoreDelta: 3, improvements: ["논리 구조 강화"] },
  };
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    status: 200,
    ok: true,
    json: async () => responseWithDelta,
  } as Response);

  const { POST } = await import("@/app/api/practice/feedback/route");
  const req = new Request("http://localhost/api/practice/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "자기소개 해주세요.",
      answer: "저는 더 발전했습니다.",
      previousAnswer: "저는 개발자입니다.",
      previousScore: 85,
    }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.comparisonDelta).toEqual({
    scoreDelta: 3,
    improvements: ["논리 구조 강화"],
  });

  // 엔진 호출 시 previousScore=85 포함 확인
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/practice/feedback"),
    expect.objectContaining({
      body: expect.stringContaining('"previousScore":85'),
    })
  );
});
```

#### 6-3. E2E 테스트 (Playwright)

파일: `services/siw/tests/e2e/practice-scoredelta.spec.ts`

기존 `practice-mode.spec.ts`의 패턴을 따르되, API 모킹으로 scoreDelta 값을 검증.

```typescript
import { test, expect } from "@playwright/test";

test.describe("연습 모드 scoreDelta E2E", () => {
  test(
    "첫 답변: comparisonDelta null 확인",
    async ({ page }) => {
      // 1. 이력서 목록 페이지 접속
      await page.goto("/resumes");

      // 2. 이미 업로드된 이력서의 "이 이력서로 면접" 클릭
      await expect(page.getByRole("link", { name: /이 이력서로 면접/ }).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole("link", { name: /이 이력서로 면접/ }).first().click();

      // 3. 연습 모드 선택
      await expect(page.getByTestId("mode-practice")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("mode-practice").click();

      // 4. 면접 시작
      await page.getByTestId("start-interview").click();
      await expect(page).toHaveURL(/\/interview\/.+/, { timeout: 30_000 });

      // 5. 첫 질문 표시 대기
      await expect(page.getByTestId("chat-message").first()).toBeVisible({
        timeout: 30_000,
      });

      // 6. 첫 답변 입력 및 제출
      await page.getByTestId("answer-input").fill(
        "저는 팀 프로젝트에서 백엔드 개발을 담당했습니다."
      );
      await page.getByTestId("submit-answer").click();

      // 7. 피드백 카드 표시 대기
      await expect(page.getByTestId("feedback-score")).toBeVisible({
        timeout: 60_000,
      });

      // 8. 첫 답변이므로 scoreDelta(feedback-delta) 없음 확인
      await expect(page.getByTestId("feedback-delta")).not.toBeVisible();
    },
    { timeout: 180_000 }
  );

  test(
    "재답변: scoreDelta가 실제 점수 차이와 일치하는지 확인",
    async ({ page }) => {
      // 1. 이력서 목록 페이지 접속
      await page.goto("/resumes");

      // 2. 이미 업로드된 이력서의 "이 이력서로 면접" 클릭
      await expect(page.getByRole("link", { name: /이 이력서로 면접/ }).first()).toBeVisible({
        timeout: 10_000,
      });
      await page.getByRole("link", { name: /이 이력서로 면접/ }).first().click();

      // 3. 연습 모드 선택
      await expect(page.getByTestId("mode-practice")).toBeVisible({ timeout: 10_000 });
      await page.getByTestId("mode-practice").click();

      // 4. 면접 시작
      await page.getByTestId("start-interview").click();
      await expect(page).toHaveURL(/\/interview\/.+/, { timeout: 30_000 });

      // 5. 첫 질문 표시 대기
      await expect(page.getByTestId("chat-message").first()).toBeVisible({
        timeout: 30_000,
      });

      // 6. 첫 답변 입력 및 제출
      await page.getByTestId("answer-input").fill(
        "저는 팀 프로젝트에서 백엔드 개발을 담당했습니다."
      );
      await page.getByTestId("submit-answer").click();

      // 7. 첫 피드백 카드 표시 대기 (score 저장됨)
      await expect(page.getByTestId("feedback-score")).toBeVisible({
        timeout: 60_000,
      });

      // 8. 첫 답변 점수 읽기
      const firstScoreText = await page.getByTestId("feedback-score").textContent();

      // 9. 다시 답변하기 클릭
      await page.getByTestId("btn-retry").click();

      // 10. 입력창 다시 표시 확인
      await expect(page.getByTestId("answer-input")).toBeVisible();

      // 11. 개선된 답변 입력 및 제출
      await page.getByTestId("answer-input").fill(
        "저는 팀 프로젝트에서 백엔드 개발 리더를 맡아 REST API 설계와 " +
        "데이터베이스 최적화를 담당했습니다. 쿼리 튜닝으로 응답 시간을 40% 단축했습니다."
      );
      await page.getByTestId("submit-answer").click();

      // 12. 재답변 피드백 + comparisonDelta 표시 대기
      await expect(page.getByTestId("feedback-score")).toBeVisible({
        timeout: 60_000,
      });
      await expect(page.getByTestId("feedback-delta")).toBeVisible({
        timeout: 60_000,
      });

      // 13. scoreDelta 텍스트 확인: 부호(+/-) 포함 숫자 형태여야 함
      const deltaText = await page.getByTestId("feedback-delta").textContent();
      expect(deltaText).toMatch(/[+-]?\d+/);

      // 14. 새 점수와 첫 점수의 차이가 표시된 scoreDelta와 일치하는지 확인
      const newScoreText = await page.getByTestId("feedback-score").textContent();
      // 점수 파싱 (예: "88점" → 88)
      const firstScore = parseInt((firstScoreText ?? "").replace(/\D/g, ""), 10);
      const newScore = parseInt((newScoreText ?? "").replace(/\D/g, ""), 10);
      const expectedDelta = newScore - firstScore;
      const displayedDelta = parseInt((deltaText ?? "").replace(/[^-\d]/g, ""), 10);

      if (!isNaN(firstScore) && !isNaN(newScore) && !isNaN(displayedDelta)) {
        expect(displayedDelta).toBe(expectedDelta);
      }

      // 15. 다음 질문으로 이동
      await page.getByTestId("btn-next-question").click();

      // 16. 피드백 카드 사라짐 확인
      await expect(page.getByTestId("feedback-score")).not.toBeVisible({
        timeout: 15_000,
      });
    },
    { timeout: 300_000 }
  );
});
```

---

### Step 7: .ai.md 업데이트

파일: `engine/.ai.md` (L171-176 `/api/practice/feedback` 섹션 교체)

```markdown
### `/api/practice/feedback` (POST, JSON) — Phase 3
- 입력: `{ question: str, answer: str, previousAnswer?: str, previousScore?: int(0-100) }`
- 출력: `{ score: int(0-100), feedback: {good: str[], improve: str[]}, keywords: str[], improvedAnswerGuide: str, comparisonDelta?: { scoreDelta: int, improvements: str[] } }`
- 에러: 400 (필드 누락/빈 문자열, previousScore 범위 초과), 500 (LLM 오류/JSON 파싱 실패)
- timeout: 30s, max_tokens: 2048
- previousAnswer 없으면 comparisonDelta=null, 있으면 comparisonDelta 포함
- **scoreDelta 계산**: previousScore 전달 시 `scoreDelta = new_score - previousScore` (서버 계산, LLM 추정값 오버라이드). previousScore 없으면 LLM 추정값 사용.
- 프롬프트: `engine/app/prompts/practice_feedback_v1.md` (단일), `practice_feedback_retry_v1.md` (재답변)
```

---

## 엣지케이스 목록

| 케이스 | 동작 | 근거 |
|--------|------|------|
| `previousScore`만 있고 `previousAnswer` 없는 경우 | `comparisonDelta=None` 유지, `previousScore` 무시 | `is_retry=False` → `_parse_feedback(is_retry=False)` → `delta=None` → 오버라이드 조건 불충족 |
| `scoreDelta`가 -100 또는 +100 경계를 초과하는 경우 | `max(-100, min(100, delta))` clamp | `ComparisonDelta.scoreDelta` 필드 `ge=-100, le=100` Pydantic 제약 준수 |
| LLM이 `comparisonDelta`를 null로 반환하지만 `previousScore`가 있는 경우 | `comparisonDelta=None` 유지 | `response.comparisonDelta is not None` 조건 실패 → 오버라이드 생략 |
| `previousScore=0`인 경우 | 정상 처리 (`scoreDelta = new_score - 0 = new_score`) | `0`은 유효한 이전 점수. Pydantic `ge=0` 통과 |
| 페이지 새로고침 시 `lastScore` 유실 | `null` 초기화 → `previousScore` 미전달 → LLM 추정값 사용 | React 상태는 세션 내 단기 비교 용도. 의도된 동작 |
| `isRetried=true`인데 `lastScore=null`인 경우 | `previousScore` body 미포함 → 엔진이 delta 없이 응답 | 방어 로직: `if (isRetried && lastScore !== null)` 조건으로 처리 |
| 여러 번 재답변 (3차, 4차) 시 `lastScore` 기준점 | 항상 **첫 답변 점수(원점)**와 비교 | `lastScore`는 `if (!isRetried)` 블록에서만 저장. 원래 답변 대비 개선 측정 일관성 |

---

## 검증 체크리스트

- [ ] `pytest engine/tests/unit/services/test_practice_service.py -v` — 테스트 14, 15, 16 통과
- [ ] `npm test` (siw) — 통합 테스트 통과 (`practice-feedback-route.test.ts` 포함)
- [ ] `npx playwright test practice-scoredelta` — E2E 통과
- [ ] 실제 수동 테스트: 연습 모드 → 첫 답변 → 재답변 → scoreDelta 확인
- [ ] `engine/.ai.md` 업데이트 완료

---

## 다른 서비스 적용 가이드

> **배경**: engine의 `/api/practice/feedback` 엔드포인트는 `previousScore`를 받아야 정확한 `scoreDelta`를 계산한다.
> `previousScore`를 전달하지 않으면 LLM 추정값이 그대로 사용되어 실제 점수 차이와 다를 수 있다.
> 현재 `services/siw`만 적용됨. 연습 모드가 있는 다른 서비스는 아래 가이드를 따라 적용해야 한다.

### 적용이 필요한 서비스

- [x] `services/siw` — PR #175에서 완료
- [ ] `services/seung` — 미적용 (연습 모드 있음, 동일 버그 존재)

---

### 변경 파일 1: BFF route (`src/app/api/practice/feedback/route.ts`)

`previousScore`를 body에서 읽어 엔진으로 전달한다.

**현재 코드 (seung 기준)**
```typescript
const { question, answer, previousAnswer } = body
// ...
body: JSON.stringify({ question, answer, ...(previousAnswer ? { previousAnswer } : {}) }),
```

**변경 후**
```typescript
const { question, answer, previousAnswer, previousScore } = body

// previousScore 유효성 검사 (0~100 정수만 허용)
const validatedPreviousScore =
  typeof previousScore === 'number' && previousScore >= 0 && previousScore <= 100
    ? previousScore
    : undefined

// ...
body: JSON.stringify({
  question,
  answer,
  ...(previousAnswer ? { previousAnswer } : {}),
  ...(validatedPreviousScore !== undefined ? { previousScore: validatedPreviousScore } : {}),
}),
```

**포인트**:
- `previousScore`는 타입 + 범위 검증 후 전달 (클라이언트 입력값이므로 신뢰하지 않음)
- 유효하지 않으면 아예 미전달 → 엔진이 LLM 추정값 사용 (기존 동작)

---

### 변경 파일 2: 인터뷰 페이지 (`src/app/interview/page.tsx` 또는 유사 경로)

`lastScore` 상태를 추가하고, 첫 답변 점수를 저장한 뒤 재답변 시 전달한다.

#### 2-1. 상태 선언 추가

```typescript
// 기존
const [currentAnswer, setCurrentAnswer] = useState<string>('')

// 추가
const [lastScore, setLastScore] = useState<number | null>(null)  // 첫 답변 점수 (재답변 비교 기준)
```

#### 2-2. 첫 답변 피드백 수신 후 점수 저장

```typescript
// handlePracticeFeedback 내부, isRetry === false 분기에서
const data = await res.json()
if (!res.ok) { /* 에러 처리 */ return }

setPracticeFeedback(data)
if (!isRetry) {
  setCurrentAnswer(answer)
  setLastScore(data.score)   // ← 추가: 첫 답변 점수 저장
  setPracticeStep('feedback')
} else {
  setPracticeStep('done')
}
```

#### 2-3. 재답변 요청 body에 `previousScore` 추가

```typescript
// handlePracticeFeedback 내부, 요청 body 구성 시
const isRetry = practiceStep === 'retry'
const body: Record<string, unknown> = { question: currentQuestion, answer }
//                    ↑ string → unknown으로 변경 (number 허용)

if (isRetry) body.previousAnswer = currentAnswer
if (isRetry && lastScore !== null) body.previousScore = lastScore  // ← 추가
```

#### 2-4. 다음 질문으로 넘어갈 때 `lastScore` 초기화

```typescript
// handleNextQuestion 내부
setPracticeStep('idle')
setPracticeFeedback(null)
setCurrentAnswer('')
setLastScore(null)   // ← 추가: 다음 질문의 기준점을 초기화
```

---

### 동작 흐름 요약

```
첫 답변 제출
  → API: { question, answer }  (previousScore 없음)
  → 엔진: comparisonDelta = null 반환
  → 프론트: data.score → lastScore에 저장

재답변 제출
  → API: { question, answer, previousAnswer, previousScore: lastScore }
  → 엔진: scoreDelta = new_score - previousScore (서버 계산)
  → 프론트: comparisonDelta.scoreDelta 표시 (+3 등)

다음 질문
  → lastScore = null 초기화
```

---

### 검증

```typescript
// Vitest: previousScore 전달 여부 확인
expect(global.fetch).toHaveBeenCalledWith(
  expect.stringContaining('/api/practice/feedback'),
  expect.objectContaining({
    body: expect.stringContaining('"previousScore":85'),
  })
)

// 첫 답변 시 미전달 확인
expect(global.fetch).toHaveBeenCalledWith(
  expect.stringContaining('/api/practice/feedback'),
  expect.objectContaining({
    body: expect.not.stringContaining('previousScore'),
  })
)
```
