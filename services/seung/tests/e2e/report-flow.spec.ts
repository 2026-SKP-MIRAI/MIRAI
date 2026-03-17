import { test, expect } from '@playwright/test'

test.setTimeout(120_000)

test('면접 완료 후 "리포트 생성하기" 클릭 → /report?reportId=xxx → 총점 표시', async ({ page }) => {
  // 면접 세션 상태 API 모킹 (세션 완료 상태)
  await page.route('/api/interview/session*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        currentQuestion: '자기소개를 해주세요.',
        currentPersona: 'hr',
        currentPersonaLabel: 'HR 면접관',
        currentQuestionType: 'main',
        history: [
          {
            persona: 'hr',
            personaLabel: 'HR 면접관',
            question: '자기소개를 해주세요.',
            answer: '저는 개발자입니다.',
            questionType: 'main',
          },
        ],
        sessionComplete: true,
      }),
    })
  })

  // 리포트 생성 API 모킹
  await page.route('/api/report/generate', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ reportId: 'test-report-123' }),
    })
  })

  // 리포트 조회 API 모킹
  await page.route('/api/report*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'test-report-123',
        sessionId: 'test-session-1',
        totalScore: 82,
        scores: {
          communication: 85,
          problemSolving: 80,
          logicalThinking: 82,
          jobExpertise: 78,
          cultureFit: 88,
          leadership: 75,
          creativity: 83,
          sincerity: 90,
        },
        summary: '전반적으로 우수한 역량을 보여주었습니다.',
        axisFeedbacks: [
          {
            axis: 'communication',
            axisLabel: '의사소통',
            score: 85,
            type: 'strength',
            feedback: '명확한 의사소통 능력을 보여주었습니다.',
          },
          {
            axis: 'problemSolving',
            axisLabel: '문제해결',
            score: 80,
            type: 'strength',
            feedback: '체계적인 문제해결 접근법을 보여주었습니다.',
          },
          {
            axis: 'logicalThinking',
            axisLabel: '논리적 사고',
            score: 82,
            type: 'strength',
            feedback: '논리적인 사고 능력이 뛰어납니다.',
          },
          {
            axis: 'jobExpertise',
            axisLabel: '직무 전문성',
            score: 78,
            type: 'improvement',
            feedback: '직무 관련 심화 학습이 필요합니다.',
          },
          {
            axis: 'cultureFit',
            axisLabel: '조직 적합성',
            score: 88,
            type: 'strength',
            feedback: '조직 문화에 잘 어울릴 것으로 보입니다.',
          },
          {
            axis: 'leadership',
            axisLabel: '리더십',
            score: 75,
            type: 'improvement',
            feedback: '리더십 경험을 더 쌓아보세요.',
          },
          {
            axis: 'creativity',
            axisLabel: '창의성',
            score: 83,
            type: 'strength',
            feedback: '창의적인 아이디어 제시가 인상적입니다.',
          },
          {
            axis: 'sincerity',
            axisLabel: '성실성',
            score: 90,
            type: 'strength',
            feedback: '성실하고 책임감 있는 태도가 돋보입니다.',
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      }),
    })
  })

  await page.goto('/interview?sessionId=test-session-1')
  await page.waitForSelector('text=면접이 완료되었습니다.')

  await page.click('button:has-text("리포트 생성하기")')

  await page.waitForURL(/\/report\?reportId=test-report-123/)

  await expect(page.locator('p.text-6xl')).toContainText('82')
  await expect(page.locator('text=종합 점수')).toBeVisible()
  await expect(page.locator('text=전반적으로 우수한 역량을 보여주었습니다.')).toBeVisible()
})

test('/report (reportId 없음) → /resume redirect', async ({ page }) => {
  await page.goto('/report')
  await page.waitForURL(/\/resume/)
  expect(page.url()).toContain('/resume')
})
