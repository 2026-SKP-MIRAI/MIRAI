import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Suspense } from 'react'
import InterviewNewPage from '../page'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  },
}))

vi.mock('lucide-react', () => ({
  Users: () => <svg data-testid="icon-users" />,
  Code2: () => <svg data-testid="icon-code2" />,
  Briefcase: () => <svg data-testid="icon-briefcase" />,
  FileText: () => <svg data-testid="icon-file-text" />,
  ArrowRight: () => <svg data-testid="icon-arrow-right" />,
}))

beforeEach(() => {
  mockPush.mockClear()
})

describe('InterviewNewPage — 이력서 없을 때', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve([]),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('"아직 이력서가 없어요" 텍스트가 표시된다', async () => {
    render(<Suspense><InterviewNewPage /></Suspense>)
    await waitFor(() => {
      expect(screen.getByText('아직 이력서가 없어요')).toBeDefined()
    })
  })

  it('"이력서 업로드하러 가기" 버튼이 표시된다', async () => {
    render(<Suspense><InterviewNewPage /></Suspense>)
    await waitFor(() => {
      expect(screen.getByText(/이력서 업로드하러 가기/)).toBeDefined()
    })
  })

  it('버튼 클릭 시 /resumes 로 이동한다', async () => {
    render(<Suspense><InterviewNewPage /></Suspense>)
    const button = await screen.findByText(/이력서 업로드하러 가기/)
    await userEvent.click(button)
    expect(mockPush).toHaveBeenCalledWith('/resumes')
  })
})

describe('InterviewNewPage — 이력서 있을 때', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ id: 'r1', fileName: '내이력서.pdf' }]),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('"이력서 업로드하러 가기" 버튼이 표시되지 않는다', async () => {
    render(<Suspense><InterviewNewPage /></Suspense>)
    await waitFor(() => {
      expect(screen.queryByText(/이력서 업로드하러 가기/)).toBeNull()
    })
  })

  it('이력서 파일명이 표시된다', async () => {
    render(<Suspense><InterviewNewPage /></Suspense>)
    await waitFor(() => {
      expect(screen.getByText('내이력서.pdf')).toBeDefined()
    })
  })
})
