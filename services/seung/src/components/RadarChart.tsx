'use client'

import {
  RadarChart as RechartsRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'

type Props = {
  data: { label: string; score: number }[]
}

export default function RadarChart({ data }: Props) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height={280}>
      <RechartsRadarChart data={data}>
        <PolarGrid stroke="#e5e7eb" />
        <PolarAngleAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Radar dataKey="score" stroke="#4361ee" fill="#4361ee" fillOpacity={0.15} strokeWidth={2} />
      </RechartsRadarChart>
    </ResponsiveContainer>
  )
}
