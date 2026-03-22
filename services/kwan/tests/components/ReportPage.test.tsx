import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ReportPage from '@/app/report/page'

const { mockPush, mockReplace, stableRouter } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockReplace = vi.fn()
  return { mockPush, mockReplace, stableRouter: { push: mockPush, replace: mockReplace } }
})

vi.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams('reportId=test-report-id'),
}))

const DEFAULT_REPORT = {
  id: 'test-report-id',
  totalScore: 82,
  scores: {
    communication: 85,
    problemSolving: 80,
    logicalThinking: 88,
    jobExpertise: 75,
    cultureFit: 82,
    leadership: 78,
    creativity: 83,
    sincerity: 90,
  },
  summary: '전반적으로 우수한 면접 능력을 보여주었습니다.',
  axisFeedbacks: [
    { axis: 'communication', axisLabel: '의사소통', score: 85, type: 'strength', feedback: '명확하고 논리적인 표현이 돋보였습니다.' },
    { axis: 'problemSolving', axisLabel: '문제해결', score: 80, type: 'strength', feedback: '복잡한 문제를 체계적으로 해결합니다.' },
    { axis: 'logicalThinking', axisLabel: '논리적 사고', score: 88, type: 'strength', feedback: '논리적 흐름이 명확합니다.' },
    { axis: 'jobExpertise', axisLabel: '직무 전문성', score: 75, type: 'improvement', feedback: '직무 전문성을 더 보완하세요.' },
    { axis: 'cultureFit', axisLabel: '조직 적합성', score: 82, type: 'strength', feedback: '팀워크가 우수합니다.' },
    { axis: 'leadership', axisLabel: '리더십', score: 78, type: 'improvement', feedback: '리더십 경험을 더 어필하세요.' },
    { axis: 'creativity', axisLabel: '창의성', score: 83, type: 'strength', feedback: '창의적인 접근이 돋보입니다.' },
    { axis: 'sincerity', axisLabel: '성실성', score: 90, type: 'strength', feedback: '성실함이 잘 전달됩니다.' },
  ],
  createdAt: '2026-03-20T00:00:00.000Z',
}

function makeMockFetch(ok: boolean, status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  })
}

describe('ReportPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPush.mockReset()
    mockReplace.mockReset()
  })

  it('로딩 상태 렌더링', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<ReportPage />)
    expect(screen.getByText(/리포트 생성 중/)).toBeTruthy()
  })

  it('총점 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_REPORT))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('종합 점수')).toBeTruthy())
    expect(screen.getAllByText('82').length).toBeGreaterThan(0)
    expect(screen.getByText('/ 100')).toBeTruthy()
  })

  it('8축 점수 바 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_REPORT))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('축별 점수')).toBeTruthy())
    expect(screen.getAllByText('의사소통').length).toBeGreaterThan(0)
    expect(screen.getAllByText('문제해결').length).toBeGreaterThan(0)
    expect(screen.getAllByText('논리적 사고').length).toBeGreaterThan(0)
    expect(screen.getAllByText('직무 전문성').length).toBeGreaterThan(0)
    expect(screen.getAllByText('조직 적합성').length).toBeGreaterThan(0)
    expect(screen.getAllByText('리더십').length).toBeGreaterThan(0)
    expect(screen.getAllByText('창의성').length).toBeGreaterThan(0)
    expect(screen.getAllByText('성실성').length).toBeGreaterThan(0)
  })

  it('종합 평가(summary) 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_REPORT))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('전반적으로 우수한 면접 능력을 보여주었습니다.')).toBeTruthy())
  })

  it('강점 피드백 카드 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_REPORT))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('명확하고 논리적인 표현이 돋보였습니다.')).toBeTruthy())
    expect(screen.getByText('강점 영역')).toBeTruthy()
  })

  it('개선 피드백 카드 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_REPORT))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('직무 전문성을 더 보완하세요.')).toBeTruthy())
    expect(screen.getByText('개선 영역')).toBeTruthy()
  })

  it('에러 상태 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, { error: '리포트를 찾을 수 없습니다.' }))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText('리포트를 찾을 수 없습니다.')).toBeTruthy())
  })

  it('fetch 실패 → 에러 메시지', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    render(<ReportPage />)
    await waitFor(() => expect(screen.getByText(/오류/)).toBeTruthy())
  })
})
