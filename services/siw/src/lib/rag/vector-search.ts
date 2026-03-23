import { ragPrisma } from '@/lib/rag-prisma'

export interface SimilarPosting {
  title: string
  company: string
  similarity: number
  sourceUrl: string
  jobRole: string
  content: string  // 스킬 빈도 추출용 (UI 노출 X)
}

const TECH_SKILLS: Record<string, string[]> = {
  '백엔드': ['Java', 'Spring', 'Python', 'Node.js', 'SQL', 'REST API', 'Docker', 'Kubernetes'],
  '프론트엔드': ['React', 'TypeScript', 'JavaScript', 'CSS', 'Vue.js', 'Next.js', 'HTML'],
  '데이터': ['Python', 'SQL', 'Spark', 'Airflow', 'ML', 'TensorFlow', 'PyTorch', 'pandas'],
  '데브옵스': ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Terraform', 'Jenkins', 'Git'],
  '풀스택': ['React', 'Node.js', 'TypeScript', 'SQL', 'Docker', 'REST API'],
  '모바일': ['Swift', 'Kotlin', 'React Native', 'Flutter', 'iOS', 'Android'],
  'AI/ML': ['Python', 'TensorFlow', 'PyTorch', 'scikit-learn', 'pandas', 'numpy', 'Jupyter'],
  '보안': ['네트워크 보안', 'OWASP', '침투 테스트', '암호화', 'IAM', 'SOC'],
  'QA': ['Selenium', 'Jest', 'Cypress', 'JUnit', '테스트 자동화', 'BDD', 'TDD'],
  '기획': ['기획', 'UX', '데이터 분석', 'SQL', 'Figma', 'Jira', 'Agile'],
}

const ALL_SKILLS = Array.from(new Set(Object.values(TECH_SKILLS).flat()))
const ALL_SKILLS_LOWER = ALL_SKILLS.map((s) => s.toLowerCase())

export async function searchSimilarPostings(
  roleVector: number[],
  jobRole: string,
  topK = 5
): Promise<SimilarPosting[]> {
  const vectorStr = `[${roleVector.join(',')}]`
  const results = await ragPrisma.$queryRaw<
    Array<{
      title: string
      company: string
      content: string
      source_url: string
      job_role: string
      similarity: number
    }>
  >`
    WITH q AS (SELECT ${vectorStr}::vector AS qvec)
    SELECT title, company, content, source_url, job_role,
           1 - (embedding <=> q.qvec) AS similarity
    FROM job_posting_embeddings, q
    WHERE job_role = ${jobRole}
    ORDER BY embedding <=> q.qvec
    LIMIT ${topK}
  `
  return results.map((r) => ({
    title: r.title,
    company: r.company,
    content: r.content ?? '',
    similarity: Number(r.similarity),
    sourceUrl: r.source_url,
    jobRole: r.job_role,
  }))
}

/** 공고 content 텍스트에서 스킬 빈도 기반 추출 → { skill, weight }[] */
export function extractTrendSkills(
  postings: SimilarPosting[]
): { skill: string; weight: number }[] {
  if (postings.length === 0) return []

  const freq: Record<string, number> = {}
  for (const posting of postings) {
    const text = `${posting.title} ${posting.content}`.toLowerCase()
    for (let i = 0; i < ALL_SKILLS.length; i++) {
      if (text.includes(ALL_SKILLS_LOWER[i])) {
        freq[ALL_SKILLS[i]] = (freq[ALL_SKILLS[i]] ?? 0) + 1
      }
    }
  }

  if (Object.keys(freq).length === 0) {
    // fallback: role 기반 정적 스킬 목록
    const fallbackRole = postings[0]?.jobRole
    const fallback = (fallbackRole && TECH_SKILLS[fallbackRole]) ?? []
    return fallback.slice(0, 10).map((skill, i) => ({
      skill,
      weight: Math.max(0.1, 1 - i * 0.1),
    }))
  }

  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([skill, count]) => ({ skill, weight: count / postings.length }))
}

export async function getTrendSkillsForRole(
  roleVector: number[],
  jobRole: string
): Promise<string[]> {
  try {
    const postings = await searchSimilarPostings(roleVector, jobRole, 10)
    if (postings.length === 0) return []
    return extractTrendSkills(postings).map((s) => s.skill)
  } catch {
    return []
  }
}
