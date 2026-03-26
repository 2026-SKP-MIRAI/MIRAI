# chore: engine CI 픽스처 버그 수정 + services CI job 추가

## 목적
전체 서비스의 CI 파이프라인 정상화 — engine 테스트 오류 수정 및 services 배포 전 테스트 게이트 추가

## 배경
- engine: `test_report_service.py:9-10`에서 `fixtures/output/mock_report_response.json`, `mock_history_5items.json`을 모듈 로드 시 읽지만 레포에 파일 없음 → `FileNotFoundError`로 전체 unit test 수집 실패, deploy 차단
- engine: `followup_validator.py`가 `get_embeddings_fn`을 개별 호출(weak_part 1회, question 1회)로 변경되면서 `test_interview_service.py`의 overlap 관련 mock이 구버전 배치 호출 구조를 가정하여 테스트 4개 실패
- services: kwan/siw/seung 모두 `vitest run` 테스트 스크립트 있으나, deploy 워크플로우에 test job 없이 바로 build → deploy 중

## 완료 기준
- [ ] engine: `test_report_service.py` 외부 픽스처 의존 제거 (인라인 mock 교체)
- [ ] engine: `test_interview_service.py` overlap mock을 현재 개별 호출 구조에 맞게 수정 (overlap 테스트 통과)
- [ ] engine: `pytest engine/tests/unit -v` 전체 통과
- [ ] kwan: `deploy-kwan.yml`에 test job 추가 (`npm run test` → build)
- [ ] siw: `deploy-siw.yml`에 test job 추가 (test job은 추가됨; siw 서비스 pre-existing 테스트 버그는 #282에서 별도 처리)
- [ ] seung: `deploy-seung.yml`에 test job 추가
- [ ] GitHub Actions에서 각 워크플로우 정상 동작 확인

## 구현 플랜
1. `engine/tests/unit/services/test_report_service.py` — 외부 JSON 파일 읽기 제거, 인라인 mock 데이터로 교체
2. `engine/tests/unit/services/test_interview_service.py` — `make_embeddings_fn` mock을 현재 개별 호출(weak_part 1회 → question 1회) 구조에 맞게 수정, `captured_texts` 인덱스 수정
3. `deploy-{kwan,siw,seung}.yml` — engine의 `test-engine` job 패턴 기반으로 `test-{service}` job 추가 (Node.js 22 + npm ci + npm run test), `build-and-push` job에 `needs` 추가
4. 각 서비스 로컬에서 테스트 통과 선행 확인 (실패 시 테스트 수정 포함)
5. `.github/workflows/.ai.md` 최신화

## 수정 대상 파일
- `engine/tests/unit/services/test_report_service.py`
- `engine/tests/unit/services/test_interview_service.py`
- `.github/workflows/deploy-kwan.yml`
- `.github/workflows/deploy-siw.yml`
- `.github/workflows/deploy-seung.yml`
- `.github/workflows/.ai.md`

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### engine: test_report_service.py 픽스처 인라인 교체
`fixtures/output/` 디렉토리에 존재하지 않는 두 JSON 파일(`mock_report_response.json`, `mock_history_5items.json`)을 모듈 로드 시 읽으려 해 `FileNotFoundError`가 발생, 전체 unit test 수집이 실패하고 CI가 차단되고 있었다. `from pathlib import Path`와 파일 읽기 코드를 제거하고, `ReportResponse` 스키마에 맞는 `MOCK_REPORT_JSON`과 `MOCK_HISTORY`를 인라인 상수로 교체했다.

### engine: test_interview_service.py overlap mock 수정
`followup_validator.py`가 `get_embeddings_fn`을 배치 호출(texts 2개)에서 개별 호출(weak_part 1회 → question 1회)로 변경됐는데, 테스트의 `make_embeddings_fn`이 여전히 배치 구조(`[[v1], [v2]]` 반환)를 가정하고 있어 overlap 테스트 4개가 실패했다. `idx == 0`이면 weak_part 기준 벡터 `[[1.0, 0.0]]`을 반환하고, 이후 호출은 scores 기반 유사도 벡터를 반환하도록 수정했다. `captured_texts` 인덱스도 `[1]` → `[0]`으로 교정했다.

### deploy-kwan/siw/seung.yml: test gate 추가
3개 서비스 워크플로우 모두 test job 없이 바로 build → deploy로 연결되어 있었다. `deploy-engine.yml`의 `test-engine` job 패턴을 기반으로 `test-{service}` job을 추가하고, `build-and-push`에 `needs: [test-{service}]`, `deploy`의 `if` 조건에 `needs.test-{service}.result == 'success'`를 추가했다. kwan은 테스트가 외부 JSON 픽스처를 임포트하는 구조여서 YAML 내 `Create test fixtures` 스텝으로 실행 전 파일을 생성하는 방식으로 해결했다. siw는 test job을 추가했으나 서비스 코드와 테스트 간 pre-existing 불일치(필드명, UI 텍스트, mock 오염)로 CI 실패 중이며, 이는 #282에서 별도로 처리한다.

### .github/workflows/.ai.md 최신화
각 서비스 워크플로우 상태를 "test gate 추가"로 업데이트하고, kwan/siw/seung 흐름도(test → build → deploy 체인)를 추가했다.

