import { ragPrisma } from '@/lib/rag-prisma'

export interface SimilarPosting {
  title: string
  company: string
  similarity: number
  sourceUrl: string
  jobRole: string
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
      source_url: string
      job_role: string
      similarity: number
    }>
  >`
    WITH q AS (SELECT ${vectorStr}::vector AS qvec)
    SELECT title, company, source_url, job_role,
           1 - (embedding <=> q.qvec) AS similarity
    FROM job_posting_embeddings, q
    WHERE job_role = ${jobRole}
    ORDER BY embedding <=> q.qvec
    LIMIT ${topK}
  `
  return results.map((r) => ({
    title: r.title,
    company: r.company,
    similarity: Number(r.similarity),
    sourceUrl: r.source_url,
    jobRole: r.job_role,
  }))
}

export function extractTrendSkills(jobRole: string): string[] {
  const skills = TECH_SKILLS[jobRole]
  if (skills) return skills
  // fallback: union of all skills, deduplicated
  const all = Array.from(new Set(Object.values(TECH_SKILLS).flat()))
  return all.slice(0, 10)
}

export async function getTrendSkillsForRole(
  roleVector: number[],
  jobRole: string
): Promise<string[]> {
  try {
    const postings = await searchSimilarPostings(roleVector, jobRole, 10)
    if (postings.length === 0) return []
    return extractTrendSkills(jobRole)
  } catch {
    return []
  }
}
