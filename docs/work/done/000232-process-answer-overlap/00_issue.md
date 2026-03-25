# fix: [engine] process_answer overlap 검증 누락 — validate_followup_overlap 연결

## 사용자 관점 목표
꼬리질문이 답변의 실제 약점을 정확히 공략한다. (#199에서 만든 품질 검증이 실제 면접 플로우에 작동한다.)

## 배경
#199에서 \`validate_followup_overlap\`을 구현했지만 \`/api/interview/followup\` 전용으로만 연결됐고, 실제 면접 플로우인 \`process_answer\`에는 의도적으로 미적용(NOTE 주석)했다. 그런데 프론트엔드에서 \`/api/interview/followup\`을 호출하지 않아 검증 로직이 한 번도 실행되지 않는 상태다. 결과적으로 꼬리질문 품질 검증이 전혀 작동하지 않고 있다.

## 완료 기준
- [x] \`process_answer\`에서 \`shouldFollowUp=True\`일 때 \`validate_followup_overlap\` 적용 — overlap < 0.5 시 \`_check_followup\` 재호출 (최대 2회)
- [x] \`process_answer\` 경로의 NOTE 주석 제거 및 로그 추가 (overlap score, 재생성 여부)
- [x] pytest 기존 \`test_interview_service.py\` 케이스 통과 + overlap 검증 케이스 추가

## 구현 플랜
1. \`process_answer\` 내 \`shouldFollowUp=True\` 분기에 \`validate_followup_overlap\` 삽입
2. 재생성 클로저: \`_check_followup\` 재호출 후 \`FollowupResponse\` 반환 (방법 A)
3. NOTE 주석 제거, 로그 추가
4. 테스트 케이스 추가

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-24

**현황**: 0/3 완료

**완료된 항목**:
- 없음

**미완료 항목**:
- `process_answer`에서 `validate_followup_overlap` 적용
- NOTE 주석 제거 및 로그 추가
- pytest overlap 검증 케이스 추가

**변경 파일**: 0개 (구현 대기, 01_plan.md 작성 완료)

### 2026-03-25

**현황**: 3/3 완료

**완료된 항목**:
- `process_answer`에서 `validate_followup_overlap` 적용 (overlap < 0.5 시 최대 2회 재생성)
- NOTE 주석 제거 및 `logger.info` 로그 추가
- `TestProcessAnswerOverlap` 클래스 추가 (3개 케이스) + 기존 27개 케이스 유지 (30/30 PASS)

**미완료 항목**:
- 없음

**변경 파일**: 2개 (`interview_service.py`, `test_interview_service.py`)

### 2026-03-25 (2차 — 임계값 완화 + 코드 간소화 + 임베딩 모델 복원)

**현황**: OVERLAP_THRESHOLD 0.5 → 0.4 완화 + 검증 로직 최적화 + baai/bge-m3 복원

**완료된 항목**:
- `OVERLAP_THRESHOLD` 0.5 → 0.4 완화 — cross-form(질문↔서술) 쌍은 같은 토픽이어도 유사도가 낮게 나옴, 0.5는 false rejection 빈번
- weak_part 임베딩 캐싱 — 루프 밖에서 1회만 임베딩하여 API 비용 절감 (재생성 시 50% 절감)
- 빈 followupQuestion 가드 추가 — 재생성 결과가 빈 문자열이면 즉시 반환
- single-pass 코사인 유사도 최적화 — 3N → 1N 루프 (1024차원 벡터)
- 임베딩 모델 `baai/bge-m3`로 복원 — 이전 커밋에서 `text-embedding-3-small`로 변경했으나, RAG DB가 `vector(1024)`로 생성되어 있어 차원 불일치 발생. overlap 검증은 DB 저장 없이 인메모리 비교만 하므로 모델 무관 → `baai/bge-m3` 통일
- 테스트 업데이트 — mock 패턴 변경 + 빈 질문/question 임베딩 실패 케이스 2개 추가 (66/66 PASS)
- `engine/.ai.md` 임계값 0.4 반영 + 임베딩 모델 복원

**근거 출처**:
- S. Anand (2024) "Embeddings Similarity Threshold"
- OpenAI Community "Rule of thumb cosine similarity thresholds"
- Steck et al. (WWW 2024) "Is Cosine-Similarity of Embeddings Really About Similarity?"

**변경 파일**: 6개 (`followup_validator.py`, `overlap.py`, `test_followup_validator.py`, `embedding_service.py`, `schemas.py`, `test_embed_route.py`, `engine/.ai.md`)

