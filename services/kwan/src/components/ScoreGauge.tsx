const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function scoreColor(score: number) {
  if (score >= 80) return '#2DD4BF'
  if (score >= 60) return '#F59E0B'
  return '#F87171'
}

type Props = {
  score: number
}

export default function ScoreGauge({ score }: Props) {
  const color = scoreColor(score)
  return (
    <div className="relative w-24 h-24 shrink-0">
      <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
        <circle cx="48" cy="48" r={RADIUS} fill="none" stroke="var(--kwan-elevated)" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - score / 100)}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-xs mt-0.5" style={{ color: 'var(--kwan-text-muted)' }}>/ 100</span>
      </div>
    </div>
  )
}
