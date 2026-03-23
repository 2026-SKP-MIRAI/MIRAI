export function getGrade(score: number): { label: string; color: string; bg: string } {
  if (score >= 90) return { label: 'S', color: 'text-purple-700', bg: 'bg-purple-100' }
  if (score >= 80) return { label: 'A', color: 'text-green-700', bg: 'bg-green-100' }
  if (score >= 70) return { label: 'B', color: 'text-blue-700', bg: 'bg-blue-100' }
  if (score >= 60) return { label: 'C', color: 'text-yellow-700', bg: 'bg-yellow-100' }
  return { label: 'D', color: 'text-red-700', bg: 'bg-red-100' }
}
