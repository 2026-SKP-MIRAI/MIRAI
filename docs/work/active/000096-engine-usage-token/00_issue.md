# chore: [DE] engine 응답에 usage 메타데이터 추가 — token 사용량 기반 비용 추적

## 목적
Pipeline 1 LLM 옵저버빌리티 고도화 — token 수 기반 정확한 비용 추적을 위해 engine 응답 스키마에 usage 필드를 추가한다.

## 배경
Pipeline 1(#95)에서 latency·호출 건수는 수집되지만,
token 사용량은 engine 내부에서만 알 수 있어 서비스가 비용을 계산할 수 없다.

> 🚧 **작업 시작 조건: #95 Pipeline 1 완료 + 배포 완료 이후 진행**

## 완료 기준
- [ ] engine 각 API 응답 스키마에 `usage` 필드 추가
  ```json
  {
    "firstQuestion": {...},
    "usage": {
      "prompt_tokens": 1240,
      "completion_tokens": 89,
      "latency_ms": 1823,
      "model": "google/gemini-2.5-flash",
      "prompt_version": "interview_hr_v1"
    }
  }
  ```
- [ ] `llm_client.py`의 `call_llm()`이 token usage를 반환에 포함
- [ ] 서비스 event-logger에서 token 수 → 비용 환산 로직 추가
- [ ] `llm_events_daily` 테이블에 `total_tokens`, `estimated_cost_usd` 컬럼 추가
- [ ] pytest: usage 필드 포함 응답 검증

## 구현 플랜
- `engine/app/services/llm_client.py`: OpenRouter 응답의 `usage` 객체 파싱 후 반환값에 포함
- `engine/app/schemas.py`: 각 응답 모델에 `UsageMetadata` 옵셔널 필드 추가
- `services/siw/src/lib/observability/event-logger.ts`: token → USD 환산 함수 추가

## 의존성
- **#95** Pipeline 1 완료 필수

### #95 코드 수정 필요 사항 (이 이슈에서 함께 처리)
- `LLMEvent` 인터페이스에 `prompt_tokens?`, `completion_tokens?`, `model?` 필드 추가
- `llm_events_daily` 테이블에 `total_tokens INT`, `estimated_cost_usd FLOAT` 컬럼 추가
- `llm_quality_dag.py` `aggregate_metrics` 에 token 합산 로직 추가
- `llm_quality_dag.py` `load_to_db` INSERT에 신규 컬럼 반영

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] `engine/.ai.md` 최신화
- [ ] 불변식 위반 없음
- [ ] usage 필드 없는 구버전 응답 호환성 유지 (optional 처리)

---

## 작업 내역

