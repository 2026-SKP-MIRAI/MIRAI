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
- [ ] siw: `deploy-siw.yml`에 test job 추가
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

