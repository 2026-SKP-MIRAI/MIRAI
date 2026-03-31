import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// recharts는 jsdom에서 DOM dimension을 0으로 읽어 실제 SVG를 렌더링하지 않는다.
// 컴포넌트가 올바른 props를 recharts에 전달하는지 검증하기 위해 전체 mock.
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  RadarChart: ({ children, data }: { children: React.ReactNode; data: unknown[] }) => (
    <svg data-testid="radar-chart" data-item-count={data?.length ?? 0}>{children}</svg>
  ),
  Radar: ({ dataKey }: { dataKey: string }) => (
    <g data-testid="radar" data-key={dataKey} />
  ),
  PolarGrid: () => <g data-testid="polar-grid" />,
  PolarAngleAxis: ({ dataKey }: { dataKey: string }) => (
    <g data-testid="angle-axis" data-key={dataKey} />
  ),
  PolarRadiusAxis: ({ domain }: { domain: number[] }) => (
    <g data-testid="radius-axis" data-domain={domain?.join(',')} />
  ),
}))

import RadarChart from '@/components/RadarChart'

const sampleData = [
  { label: '의사소통', score: 80 },
  { label: '문제해결', score: 70 },
  { label: '논리적 사고', score: 60 },
  { label: '직무 전문성', score: 75 },
  { label: '조직 적합성', score: 65 },
]

describe('RadarChart', () => {
  it('SVG가 렌더된다', () => {
    render(<RadarChart data={sampleData} />)
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument()
  })

  it('data 개수가 RadarChart에 올바르게 전달된다', () => {
    render(<RadarChart data={sampleData} />)
    expect(screen.getByTestId('radar-chart')).toHaveAttribute('data-item-count', '5')
  })

  it('PolarAngleAxis의 dataKey가 "label"이다', () => {
    render(<RadarChart data={sampleData} />)
    expect(screen.getByTestId('angle-axis')).toHaveAttribute('data-key', 'label')
  })

  it('Radar의 dataKey가 "score"이다', () => {
    render(<RadarChart data={sampleData} />)
    expect(screen.getByTestId('radar')).toHaveAttribute('data-key', 'score')
  })

  it('PolarRadiusAxis domain이 [0, 100]이다', () => {
    render(<RadarChart data={sampleData} />)
    expect(screen.getByTestId('radius-axis')).toHaveAttribute('data-domain', '0,100')
  })

  it('빈 data 배열이면 null을 반환한다 (아무것도 렌더되지 않는다)', () => {
    const { container } = render(<RadarChart data={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('8개 축 데이터도 정상 렌더된다', () => {
    const eightAxis = [
      { label: '의사소통', score: 80 },
      { label: '문제해결', score: 70 },
      { label: '논리적 사고', score: 60 },
      { label: '직무 전문성', score: 75 },
      { label: '조직 적합성', score: 65 },
      { label: '리더십', score: 55 },
      { label: '창의성', score: 72 },
      { label: '성실성', score: 88 },
    ]
    render(<RadarChart data={eightAxis} />)
    expect(screen.getByTestId('radar-chart')).toHaveAttribute('data-item-count', '8')
  })
})
