// feature_type → 한국어 이름·설명 매핑 (실제 로깅되는 9개 타입만)
export const FEATURE_META: Record<string, { name: string; desc: string }> = {
  interview_start:    { name: "면접 시작",        desc: "면접 세션을 시작할 때 AI가 첫 질문을 생성하는 단계입니다." },
  interview_answer:   { name: "답변 분석",        desc: "사용자의 면접 답변을 AI가 읽고 내용을 분석하는 단계입니다." },
  interview_followup: { name: "꼬리 질문",        desc: "이전 답변을 바탕으로 AI가 심층 추가 질문을 생성하는 단계입니다." },
  report_generate:    { name: "리포트 생성",      desc: "면접 전 과정을 종합해 최종 피드백 리포트를 생성하는 단계입니다." },
  practice_feedback:  { name: "연습 피드백",      desc: "연습 모드에서 사용자 답변에 대한 즉각적 피드백을 제공하는 단계입니다." },
  resume_parse:       { name: "이력서 파싱",      desc: "업로드된 이력서를 AI가 읽고 주요 정보를 추출하는 단계입니다." },
  resume_analyze:     { name: "이력서 분석",      desc: "파싱된 이력서 내용을 AI가 종합 평가하는 단계입니다." },
  resume_questions:   { name: "이력서 질문 생성", desc: "이력서 내용 기반으로 예상 면접 질문을 AI가 생성하는 단계입니다." },
  resume_feedback:    { name: "이력서 피드백",    desc: "이력서 개선 포인트를 AI가 분석하여 피드백을 제공하는 단계입니다." },
}

// feature_type → mode 매핑 (event-logger.ts의 FEATURE_MODE와 동일하게 유지)
export const FEATURE_MODE: Record<string, "interview" | "practice" | "resume"> = {
  interview_start:    "interview",
  interview_answer:   "interview",
  interview_followup: "interview",
  report_generate:    "interview",
  practice_feedback:  "practice",
  resume_parse:       "resume",
  resume_analyze:     "resume",
  resume_questions:   "resume",
  resume_feedback:    "resume",
}

// mode → UI 표시명 매핑
export const MODE_LABEL: Record<string, string> = {
  interview: "면접",
  practice:  "연습",
  resume:    "이력서",
}

// mode별 feature_type 그룹핑 (FEATURE_MODE 기반, 3개 그룹)
export const MODE_GROUPS: Record<string, string[]> = {
  interview: ["interview_start", "interview_answer", "interview_followup", "report_generate"],
  practice:  ["practice_feedback"],
  resume:    ["resume_parse", "resume_analyze", "resume_questions", "resume_feedback"],
}
