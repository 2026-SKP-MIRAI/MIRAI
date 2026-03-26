import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ReportResult from '../ReportResult'
import type { ReportResponse } from '@/lib/types'

// chart.js mock
vi.mock('react-chartjs-2', () => ({
  Radar: () => <div data-testid="radar-chart" />,
}))

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  RadialLinearScale: {},
  PointElement: {},
  LineElement: {},
  Filler: {},
  Tooltip: {},
  Legend: {},
}))

const mockReport: ReportResponse = {
  totalScore: 75,
  summary: '테스트 요약',
  scores: {
    communication: 80,
    problemSolving: 70,
    logicalThinking: 65,
    jobExpertise: 75,
    cultureFit: 85,
    leadership: 60,
    creativity: 70,
    sincerity: 90,
  },
  axisFeedbacks: [
    { axis: 'communication', axisLabel: '의사소통', score: 80, feedback: '좋음', type: 'strength' },
    { axis: 'leadership', axisLabel: '리더십', score: 60, feedback: '개선 필요', type: 'improvement' },
  ],
}

describe('ReportResult 모바일 반응형', () => {
  it('레이더/점수 그리드에 반응형 클래스가 적용된다', () => {
    const { container } = render(<ReportResult report={mockReport} />)
    const grid = container.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')
    expect(grid).not.toBeNull()
  })

  it('총점에 반응형 폰트 크래스가 적용된다', () => {
    const { container } = render(<ReportResult report={mockReport} />)
    const scoreEl = container.querySelector('.text-6xl.md\\:text-\\[80px\\]')
    expect(scoreEl).not.toBeNull()
  })
})
