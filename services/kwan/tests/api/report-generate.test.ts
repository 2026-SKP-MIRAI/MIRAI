// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCallEngineReportGenerate, mockPrisma, mockCreateClient, mockCookies } = vi.hoisted(() => ({
  mockCallEngineReportGenerate: vi.fn(),
  mockCreateClient: vi.fn(),
  mockCookies: vi.fn(),
  mockPrisma: {
    interviewSession: { findUnique: vi.fn() },
    report: { findFirst: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/engine-client', () => ({ callEngineReportGenerate: mockCallEngineReportGenerate }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mockCreateClient }))
vi.mock('next/headers', () => ({ cookies: mockCookies }))

import { POST } from '@/app/api/report/generate/route'

function makeMockResponse(ok: boolean, status: number, data: unknown): Response {
  return { ok, status, json: async () => data } as unknown as Response
}

const DEFAULT_REPORT = {
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
}

const MOCK_HISTORY = Array.from({ length: 5 }, (_, i) => ({
  persona: 'hr',
  personaLabel: 'HR 담당자',
  question: `질문 ${i + 1}`,
  answer: `답변 ${i + 1}`,
  questionType: 'main',
}))

const MOCK_SESSION = {
  id: 'session-1',
  resumeId: 'resume-1',
  sessionComplete: true,
  history: MOCK_HISTORY,
  resume: { resumeText: '안녕하세요. 저는 소프트웨어 엔지니어입니다.' },
}

describe('POST /api/report/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null,
        }),
      },
    })
    mockPrisma.interviewSession.findUnique.mockResolvedValue(MOCK_SESSION)
    mockPrisma.report.findFirst.mockResolvedValue(null)
    mockCallEngineReportGenerate.mockResolvedValue(
      makeMockResponse(true, 200, DEFAULT_REPORT)
    )
    mockPrisma.report.create.mockResolvedValue({ id: 'report-1', ...DEFAULT_REPORT })
    mockCookies.mockResolvedValue({ get: vi.fn().mockReturnValue(undefined) })
  })

  it('sessionId 누락 → 400', async () => {
    const req = { json: async () => ({}) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('sessionId가 필요합니다.')
  })

  it('session 없음 → 404', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce(null)
    const req = { json: async () => ({ sessionId: 'non-existent' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('세션을 찾을 수 없습니다.')
  })

  it('session 미완료 → 400', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      sessionComplete: false,
    })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('면접이 아직 완료되지 않았습니다.')
  })

  it('history가 배열이 아님 → 500', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      history: null,
    })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('서버 오류가 발생했습니다.')
  })

  it('history < 5 → 422', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      history: MOCK_HISTORY.slice(0, 3),
    })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toContain('답변이 부족합니다')
  })

  it('정상 흐름 → 201 + reportId + Math.round 적용 확인', async () => {
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.reportId).toBe('report-1')
    expect(mockPrisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalScore: Math.round(DEFAULT_REPORT.totalScore),
          sessionId: 'session-1',
        }),
      })
    )
  })

  it('기존 리포트 존재 (멱등) → 200 + 기존 reportId', async () => {
    mockPrisma.report.findFirst.mockResolvedValueOnce({ id: 'existing-report' })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reportId).toBe('existing-report')
    expect(mockCallEngineReportGenerate).not.toHaveBeenCalled()
  })

  it('P2002 동시 요청 → 200 fallback', async () => {
    const p2002Error = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    mockPrisma.report.create.mockRejectedValueOnce(p2002Error)
    mockPrisma.report.findUnique.mockResolvedValueOnce({ id: 'concurrent-report' })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reportId).toBe('concurrent-report')
  })

  it('DB session lookup 실패 → 500', async () => {
    mockPrisma.interviewSession.findUnique.mockRejectedValueOnce(new Error('DB connection failed'))
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('DB report lookup 실패 → 500', async () => {
    mockPrisma.report.findFirst.mockRejectedValueOnce(new Error('DB connection failed'))
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeTruthy()
  })

  it('engine timeout → 500', async () => {
    const timeoutError = new Error('timeout')
    timeoutError.name = 'TimeoutError'
    mockCallEngineReportGenerate.mockRejectedValueOnce(timeoutError)
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('요청 시간이 초과됐습니다. 잠시 후 다시 시도해주세요.')
  })

  it('AxisScores 일부 필드 null + not_evaluated 타입 포함 → 201 + DB에 not_evaluated 저장', async () => {
    const notEvaluatedFeedbacks = [
      { axis: 'leadership', axisLabel: '리더십', score: null, type: 'not_evaluated', feedback: '리더십 관련 정보 부족.' },
      { axis: 'creativity', axisLabel: '창의성', score: null, type: 'not_evaluated', feedback: '창의성 관련 답변 부족.' },
    ]
    const reportWithNotEvaluated = {
      ...DEFAULT_REPORT,
      scores: { ...DEFAULT_REPORT.scores, leadership: null, creativity: null },
      axisFeedbacks: [
        ...DEFAULT_REPORT.axisFeedbacks.slice(0, 6),  // 6개
        ...notEvaluatedFeedbacks,                      // + 2개 = 8개
      ],
    }
    mockCallEngineReportGenerate.mockResolvedValueOnce(
      makeMockResponse(true, 200, reportWithNotEvaluated)
    )
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockPrisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          axisFeedbacks: expect.arrayContaining([
            expect.objectContaining({ type: 'not_evaluated', score: null }),
          ]),
        }),
      })
    )
  })

  it('not_evaluated 타입 + score non-null 조합 → 201 + 스키마 파싱 통과 확인', async () => {
    const reportWithNotEvaluatedNonNull = {
      ...DEFAULT_REPORT,
      axisFeedbacks: [
        ...DEFAULT_REPORT.axisFeedbacks.slice(0, 7),
        { axis: 'sincerity', axisLabel: '성실성', score: 50, type: 'not_evaluated', feedback: '평가 참고값.' },
      ],
    }
    mockCallEngineReportGenerate.mockResolvedValueOnce(
      makeMockResponse(true, 200, reportWithNotEvaluatedNonNull)
    )
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(201)
    expect(mockPrisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          axisFeedbacks: expect.arrayContaining([
            expect.objectContaining({ type: 'not_evaluated', score: 50 }),
          ]),
        }),
      })
    )
  })

  it('engine 422 → 422 전달 + engine detail 메시지 사용', async () => {
    mockCallEngineReportGenerate.mockResolvedValueOnce(
      makeMockResponse(false, 422, { detail: '답변 부족' })
    )
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe('답변 부족') // engine detail 그대로 전달
  })

  it('should return 401 when not authenticated', async () => {
    mockCreateClient.mockResolvedValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('로그인이 필요합니다.')
  })

  it('should return 403 when session belongs to another user', async () => {
    mockPrisma.interviewSession.findUnique.mockResolvedValueOnce({
      ...MOCK_SESSION,
      userId: 'other-user',
    })
    const req = { json: async () => ({ sessionId: 'session-1' }) } as unknown as Request
    const res = await POST(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('접근 권한이 없습니다.')
  })
})
