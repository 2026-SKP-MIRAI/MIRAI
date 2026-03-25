# #232 process_answer overlap 검증 연결

## 목표
꼬리질문이 답변의 실제 약점을 정확히 공략하도록 `validate_followup_overlap`을 `process_answer` 경로에 연결한다.

## 완료된 작업

### 1. process_answer에 validate_followup_overlap 적용
- `process_answer`에서 `shouldFollowUp=True`일 때 overlap 검증 적용
- `_check_followup` 재호출 클로저로 재생성 구현
- NOTE 주석 제거 및 로그 추가

### 2. 임베딩 모델 변경
- `baai/bge-m3` → `text-embedding-3-small` (OpenRouter 경유)
- 1536차원, OpenAI 호환 API

### 3. OVERLAP_THRESHOLD 완화: 0.5 → 0.4
- **문제**: 질문형 ↔ 서술형(cross-form) 비교 시 같은 토픽이어도 0.35~0.55 범위에 분포 → 0.5 임계값은 false rejection 빈번
- **결정**: 0.4로 완화

#### 임계값 근거 (text-embedding-3-small 실증 데이터)

| 쌍 유형 | 점수 범위 |
|---------|----------|
| 거의 동일한 텍스트 | 0.95–1.0 |
| 의미 동치, 다른 표현 | 0.50–0.70 |
| **같은 토픽, 다른 형식 (질문 vs 서술)** | **0.35–0.55** |
| 주제만 관련 | 0.25–0.45 |
| 무관 | 0.05–0.25 |

- 질문형 vs 서술형 **cross-form penalty**: 0.05~0.15 감점
- 0.40은 cross-form 관련 쌍의 중앙값이며, 무관 텍스트(<0.25)와 충분한 마진 확보
- 0.35는 "weakly related" 경계(0.25~0.45)에 걸쳐 너무 느슨

#### 출처
- S. Anand (2024) "Embeddings Similarity Threshold" — https://www.s-anand.net/blog/embeddings-similarity-threshold/
- OpenAI Community — https://community.openai.com/t/rule-of-thumb-cosine-similarity-thresholds/693670
- Steck et al. (WWW 2024) "Is Cosine-Similarity of Embeddings Really About Similarity?" — https://arxiv.org/abs/2403.05440
- OpenAI Community (3-small vs ada-002 점수 차이) — https://community.openai.com/t/reduced-cosine-of-similarity-relevance-scores-with-text-embedding-3-small-vs-text-embedding-ada-002/873048

#### 지표 한계 인식
- 코사인 유사도는 **"약점 정렬(alignment)"** 보조 지표이지, **"후속 질문 품질"** 지표가 아님
- 품질 평가가 필요하면 LLM 판정(rubric 기반 yes/no) 또는 NLI 모델 추가 레이어 검토 필요

## 커밋 이력
1. `e94a1d0` — validate_followup_overlap 적용
2. `d67195e` — baai/bge-m3 → text-embedding-3-small 변경
3. `b6908d1` — OVERLAP_THRESHOLD 0.5 → 0.4 완화
