# [#263] chore: engine CI 픽스처 버그 수정 + services CI job 추가 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [ ] engine: `test_report_service.py` 외부 픽스처 의존 제거 (인라인 mock 교체)
- [ ] engine: `test_interview_service.py` overlap mock을 현재 개별 호출 구조에 맞게 수정 (overlap 테스트 통과)
- [ ] engine: `pytest engine/tests/unit -v` 전체 통과
- [ ] kwan: `deploy-kwan.yml`에 test job 추가 (`npm run test` → build)
- [ ] siw: `deploy-siw.yml`에 test job 추가
- [ ] seung: `deploy-seung.yml`에 test job 추가
- [ ] GitHub Actions에서 각 워크플로우 정상 동작 확인

---

## 구현 계획

### Part 1a: Engine 테스트 픽스처 인라인 교체

**파일**: `engine/tests/unit/services/test_report_service.py`

**문제**: lines 3, 7-10에서 존재하지 않는 파일을 모듈 로드 시 읽어 `FileNotFoundError` 발생 → 전체 test 수집 실패

```python
# 삭제 대상
from pathlib import Path
FIXTURES_OUTPUT = Path(__file__).parent.parent.parent / "fixtures/output"
MOCK_REPORT_JSON = (FIXTURES_OUTPUT / "mock_report_response.json").read_text(encoding="utf-8")
MOCK_HISTORY = json.loads((FIXTURES_OUTPUT / "mock_history_5items.json").read_text(encoding="utf-8"))
```

**수정**:
1. `from pathlib import Path` 제거
2. lines 7-10 삭제 후 인라인 상수로 교체:
   - `MOCK_REPORT_JSON` — `ReportResponse` 스키마 기반 JSON 문자열 (8개 축, scores, totalScore, summary, axisFeedbacks)
   - `MOCK_HISTORY` — `HistoryItem` 5개 리스트 (persona, personaLabel, question, answer)
   - 기존 `MOCK_V2_FEEDBACK_JSON` (line 13-25)의 `json.dumps(...)` 패턴과 동일하게 정의

---

### Part 1b: test_interview_service overlap mock 수정

**파일**: `engine/tests/unit/services/test_interview_service.py`

**문제**: `followup_validator.py`가 `get_embeddings_fn`을 weak_part 1회 + question 매 루프 1회 개별 호출로 동작하는데, `make_embeddings_fn` mock이 2-element 벡터(`[[1.0, 0.0], [s, b]]`)를 반환해 `emb[0]`이 항상 `[1.0, 0.0]`고정 → cosine similarity 항상 1.0 → 재생성 로직 실행 안 됨

**수정**:
- `make_embeddings_fn`: 1번째 호출(weak_part)은 고정 기준 벡터 `[[1.0, 0.0]]`, 이후 호출(question)은 `scores` 순서대로 단일 벡터 반환
- `test_empty_reasoning_uses_answer_as_weak_part`: `captured_texts[1]` → `[0]`, `capture_emb` return 단일 벡터
- `test_whitespace_reasoning_uses_answer_fallback`: 동일

---

### Part 2: Services CI test job 추가

**참조 패턴**: `deploy-engine.yml`의 `test-engine` job

각 서비스에 삽입할 `test-{service}` job (Node.js 22 + npm ci + npm run test):

```yaml
test-{service}:
  runs-on: ubuntu-latest
  timeout-minutes: 10
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '22'
        cache: 'npm'
        cache-dependency-path: 'services/{service}/package-lock.json'
    - name: Install dependencies
      working-directory: services/{service}
      run: npm ci
    - name: Run tests
      working-directory: services/{service}
      run: npm run test
```

**각 워크플로우 수정사항**:

| 워크플로우 | 추가 job | build job 변경 | deploy job 변경 |
|---|---|---|---|
| `deploy-kwan.yml` | `test-kwan` | `needs: [test-kwan]` 추가 | `needs: [test-kwan, build-and-push-kwan]`, if에 test 성공 조건 추가 |
| `deploy-siw.yml` | `test-siw` | `needs: [test-siw]` 추가 | `needs: [test-siw, build-and-push-siw]`, if에 test 성공 조건 추가 |
| `deploy-seung.yml` | `test-seung` | `needs: [test-seung]` 추가 | `needs: [test-seung, build-and-push-seung]`, if에 test 성공 조건 추가 |

deploy job의 `if` 조건 패턴 (engine과 동일):
```yaml
if: ${{ always() && needs.test-{service}.result == 'success' && (needs.build-and-push-{service}.result == 'success' || needs.build-and-push-{service}.result == 'skipped') }}
```

---

### Part 3: .ai.md 최신화

**파일**: `.github/workflows/.ai.md`

- 워크플로우 현황 테이블에 test job 반영
- deploy-kwan/siw/seung 흐름도에 test 단계 추가

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|-----------|
| `engine/tests/unit/services/test_report_service.py` | 외부 픽스처 → 인라인 mock |
| `engine/tests/unit/services/test_interview_service.py` | overlap mock 수정 |
| `.github/workflows/deploy-kwan.yml` | test-kwan job 추가 |
| `.github/workflows/deploy-siw.yml` | test-siw job 추가 |
| `.github/workflows/deploy-seung.yml` | test-seung job 추가 |
| `.github/workflows/.ai.md` | 워크플로우 문서 최신화 |

## 실행 순서

1. `test_report_service.py` 인라인 mock 교체
2. `test_interview_service.py` overlap mock 수정
3. `deploy-kwan.yml` → `deploy-siw.yml` → `deploy-seung.yml` test job 추가
4. `.github/workflows/.ai.md` 최신화
