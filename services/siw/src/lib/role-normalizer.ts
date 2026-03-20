/**
 * targetRole 문자열을 정규화된 직무 카테고리로 변환한다.
 * - 불필요한 공백 제거
 * - 빈 문자열이면 기본값 반환
 */

const ROLE_MAP: Array<[RegExp, string]> = [
  [/프론트엔드|frontend|front.end|react|vue|angular/i, "프론트엔드 개발자"],
  [/백엔드|backend|back.end|서버|server/i, "백엔드 개발자"],
  [/풀스택|fullstack|full.stack/i, "풀스택 개발자"],
  [/데이터\s*엔지니어|data\s*engineer/i, "데이터 엔지니어"],
  [/데이터\s*사이언티스트|data\s*scientist/i, "데이터 사이언티스트"],
  [/머신러닝|machine\s*learning|딥러닝|deep\s*learning|AI\s*엔지니어/i, "ML 엔지니어"],
  [/devops|데브옵스|인프라|infra|sre/i, "DevOps 엔지니어"],
  [/ios|swift|안드로이드|android|kotlin|모바일/i, "모바일 개발자"],
  [/소프트웨어|software|sw\s*개발|개발자/i, "소프트웨어 개발자"],
  [/기획|pm|product\s*manager|프로덕트\s*매니저/i, "PM"],
  [/디자이너|ux|ui\s*\/\s*ux|designer/i, "디자이너"],
]

const DEFAULT_ROLE = "소프트웨어 개발자"

export function normalizeRole(raw: string | null | undefined): string {
  if (!raw || raw.trim() === "") return DEFAULT_ROLE
  const trimmed = raw.trim()
  for (const [pattern, normalized] of ROLE_MAP) {
    if (pattern.test(trimmed)) return normalized
  }
  // 매칭 실패 시 원문 그대로 반환 (최대 50자 제한)
  return trimmed.slice(0, 50)
}
