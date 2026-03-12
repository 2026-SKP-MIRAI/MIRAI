# fix: engine call_llm max_tokens 1024 → 2048 상향

## 목적
면접 진행 시 LLM 응답 JSON이 완성되기 전에 잘리는 이슈 해결

## 배경
`engine/app/services/interview_service.py`의 `_call_llm` 함수에서 `max_tokens=1024`로 설정되어 있어, 면접 응답 JSON이 중간에 잘리는 현상 발생. 2048로 상향하여 충분한 응답 길이를 확보한다.

## 완료 기준
- [x] `call_llm`의 `max_tokens` 값이 2048로 변경됨
- [x] 면접 진행 시 JSON 응답이 잘리지 않음 (로컬 테스트 확인)

## 구현 플랜
1. `engine/app/services/llm_client.py` — `max_tokens=1024` → `max_tokens=2048` 변경
2. `engine/app/services/.ai.md` 최신화

## 개발 체크리스트
- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 변경 파일

- **`engine/app/services/llm_client.py`** (line 24): `max_tokens` 기본값 `1024` → `2048`로 상향.
  모든 LLM 호출의 단일 진입점인 `call_llm`에서 변경해 interview, report 등 모든 서비스에 일괄 적용됨.

- **`engine/app/services/.ai.md`** (line 32): 인터페이스 문서의 `max_tokens` 기본값 주석 동기화.
  "리포트 등 긴 출력은 2048 전달" → "기본 2048; 필요 시 더 높은 값 전달"로 수정.

