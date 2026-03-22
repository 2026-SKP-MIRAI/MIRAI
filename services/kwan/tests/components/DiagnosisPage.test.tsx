import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import DiagnosisPage from '@/app/diagnosis/page'

const { mockPush, mockReplace, stableRouter } = vi.hoisted(() => {
  const mockPush = vi.fn()
  const mockReplace = vi.fn()
  return { mockPush, mockReplace, stableRouter: { push: mockPush, replace: mockReplace } }
})

vi.mock('next/navigation', () => ({
  useRouter: () => stableRouter,
  useSearchParams: () => new URLSearchParams('resumeId=test-resume-id'),
}))

const DEFAULT_DIAGNOSIS = {
  scores: {
    specificity: 80,
    achievementClarity: 70,
    logicStructure: 85,
    roleAlignment: 75,
    differentiation: 60,
  },
  strengths: ['논리적 구조가 우수합니다.', '구체적인 수치를 잘 활용했습니다.'],
  weaknesses: ['차별성이 부족합니다.', '성과 근거가 다소 약합니다.'],
  suggestions: [
    { section: '지원동기', issue: '추상적 표현 사용', suggestion: '구체적 경험으로 대체하세요.' },
  ],
}

function makeMockFetch(ok: boolean, status: number, data: unknown) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => data,
  })
}

describe('DiagnosisPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockPush.mockReset()
    mockReplace.mockReset()
  })

  it('로딩 상태 렌더링', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    render(<DiagnosisPage />)
    expect(screen.getByText(/로딩 중|불러오는 중/)).toBeTruthy()
  })

  it('5축 점수 바 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('구체성')).toBeTruthy())
    expect(screen.getByText('성과 명확성')).toBeTruthy()
    expect(screen.getByText('논리 구조')).toBeTruthy()
    expect(screen.getByText('직무 정합성')).toBeTruthy()
    expect(screen.getByText('차별성')).toBeTruthy()
  })

  it('강점 목록 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('논리적 구조가 우수합니다.')).toBeTruthy())
    expect(screen.getByText('구체적인 수치를 잘 활용했습니다.')).toBeTruthy()
  })

  it('약점 목록 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('차별성이 부족합니다.')).toBeTruthy())
    expect(screen.getByText('성과 근거가 다소 약합니다.')).toBeTruthy()
  })

  it('개선 제안 카드 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('지원동기')).toBeTruthy())
    expect(screen.getByText('추상적 표현 사용')).toBeTruthy()
    expect(screen.getByText('구체적 경험으로 대체하세요.')).toBeTruthy()
  })

  it('면접 시작 버튼 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('면접 시작')).toBeTruthy())
  })

  it('면접 시작 버튼 클릭 → /interview?resumeId=xxx 이동 (모드 선택은 interview 페이지에서)', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, DEFAULT_DIAGNOSIS))

    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('면접 시작')).toBeTruthy())

    fireEvent.click(screen.getByText('면접 시작'))

    expect(mockPush).toHaveBeenCalledWith('/interview?resumeId=test-resume-id')
  })

  it('에러 상태 렌더링', async () => {
    vi.stubGlobal('fetch', makeMockFetch(true, 200, { error: '진단 결과가 없습니다.' }))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText('진단 결과가 없습니다.')).toBeTruthy())
  })

  it('fetch 실패 → 에러 메시지', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')))
    render(<DiagnosisPage />)
    await waitFor(() => expect(screen.getByText(/오류/)).toBeTruthy())
  })
})
