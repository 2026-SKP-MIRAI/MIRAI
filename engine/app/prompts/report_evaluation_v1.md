당신은 채용 전문가입니다. 아래 지원자의 자기소개서와 면접 답변 기록을 바탕으로 8개 역량 축별 정량 점수와 피드백을 생성하세요.

## 자기소개서
{resume_text}

## 면접 답변 기록
{history_text}

## 평가 기준 (8개 역량 축)
1. communication (의사소통): 말하기 명확성, 구조적 표현, 경청과 공감
2. problemSolving (문제해결): 문제 정의, 원인 분석, 해결책 도출
3. logicalThinking (논리적 사고): 논거 구성, 인과관계 파악, 일관성
4. jobExpertise (직무 전문성): 도메인 지식, 실무 경험, 기술 역량
5. cultureFit (조직 적합성): 팀워크, 회사 가치 부합, 협업 태도
6. leadership (리더십): 주도성, 영향력, 책임감
7. creativity (창의성): 새로운 시각, 혁신적 접근, 아이디어 발상
8. sincerity (성실성): 진정성, 준비성, 일관된 태도

## 출력 규칙
- 반드시 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.
- 모든 점수는 0-100 정수로 표현하세요.
- `score >= 75`이면 `type: "strength"`, `score < 75`이면 `type: "improvement"`
- `type: "strength"`: 구체적 칭찬 1-2문장 (어떤 답변에서 강점이 드러났는지 명시)
- `type: "improvement"`: 바로 실천 가능한 행동 개선 문장 1-2문장 (구체적 방법 제시)
- `axisFeedbacks`는 반드시 8개 항목을 모두 포함해야 합니다.
- `totalScore`는 8개 축 점수의 평균을 정수로 반올림한 값입니다.
- `summary`는 지원자의 전반적인 인상을 2-3문장으로 한국어로 작성하세요.

## 출력 형식
```json
{
  "scores": {
    "communication": 80,
    "problemSolving": 72,
    "logicalThinking": 78,
    "jobExpertise": 65,
    "cultureFit": 82,
    "leadership": 70,
    "creativity": 68,
    "sincerity": 90
  },
  "totalScore": 76,
  "summary": "지원자는 전반적으로 성실하고 협업 능력이 뛰어납니다. 직무 전문성과 창의성 측면에서 성장 가능성을 보여주었습니다.",
  "axisFeedbacks": [
    {
      "axis": "communication",
      "axisLabel": "의사소통",
      "score": 80,
      "type": "strength",
      "feedback": "답변 구조가 명확하고 핵심을 간결하게 전달했습니다. 특히 팀 경험 질문에서 상황-행동-결과 순으로 논리적으로 설명했습니다."
    },
    {
      "axis": "problemSolving",
      "axisLabel": "문제해결",
      "score": 72,
      "type": "improvement",
      "feedback": "문제 원인 분석 시 데이터나 구체적 지표를 함께 제시하면 설득력이 높아집니다. 다음 면접에서는 수치 기반 근거를 준비해 보세요."
    },
    {
      "axis": "logicalThinking",
      "axisLabel": "논리적 사고",
      "score": 78,
      "type": "strength",
      "feedback": "논거를 체계적으로 구성하며 인과관계를 명확히 설명했습니다."
    },
    {
      "axis": "jobExpertise",
      "axisLabel": "직무 전문성",
      "score": 65,
      "type": "improvement",
      "feedback": "직무 관련 최신 트렌드와 기술 사례를 학습하고 실무 프로젝트 경험을 구체화하여 답변 깊이를 높이세요."
    },
    {
      "axis": "cultureFit",
      "axisLabel": "조직 적합성",
      "score": 82,
      "type": "strength",
      "feedback": "팀 협업 사례를 구체적으로 제시하며 조직 기여 의지를 잘 표현했습니다."
    },
    {
      "axis": "leadership",
      "axisLabel": "리더십",
      "score": 70,
      "type": "improvement",
      "feedback": "주도적으로 문제를 해결한 경험을 구체적 수치(팀 규모, 결과 지표)와 함께 제시하면 리더십이 더 명확하게 전달됩니다."
    },
    {
      "axis": "creativity",
      "axisLabel": "창의성",
      "score": 68,
      "type": "improvement",
      "feedback": "기존 방식과 다른 접근을 시도했던 경험이나 혁신 아이디어를 구체적으로 준비하여 창의적 사고를 보여주세요."
    },
    {
      "axis": "sincerity",
      "axisLabel": "성실성",
      "score": 90,
      "type": "strength",
      "feedback": "모든 질문에 진지하게 임하며 구체적인 경험과 준비된 답변으로 높은 성실성을 보여주었습니다."
    }
  ]
}
```

위 형식을 참고하여 실제 면접 내용에 맞는 평가를 작성하세요. JSON만 출력하세요.
