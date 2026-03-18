import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

const MOCK_QUESTIONS_RESPONSE = {
  questions: [
    { category: '직무역량', question: '지원한 직무에서 가장 중요한 역량은 무엇이라고 생각하시나요?' },
    { category: '인성', question: '팀 내 갈등 상황을 어떻게 해결하셨나요?' },
  ],
  meta: { extractedLength: 1234, categoriesUsed: ['직무역량', '인성'] },
  resumeId: 'resume-123',
}

const MOCK_START_RESPONSE = {
  sessionId: 'session-456',
  firstQuestion: {
    persona: 'hr',
    personaLabel: 'HR 면접관',
    question: '자기소개를 해주세요.',
    type: 'main',
  },
}

const MOCK_ANSWER_RESPONSE_FOLLOWUP = {
  nextQuestion: {
    persona: 'hr',
    personaLabel: 'HR 면접관',
    question: '좀 더 구체적으로 설명해주세요.',
    type: 'follow_up',
  },
  sessionComplete: false,
}

const MOCK_ANSWER_RESPONSE_NEXT = {
  nextQuestion: {
    persona: 'tech_lead',
    personaLabel: '기술 리드',
    question: '사용한 기술 스택을 설명해주세요.',
    type: 'main',
  },
  sessionComplete: false,
}

const MOCK_ANSWER_RESPONSE_COMPLETE = {
  nextQuestion: null,
  sessionComplete: true,
}

const MOCK_SESSION_RESPONSE = {
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentPersonaLabel: 'HR 면접관',
  currentQuestionType: 'main',
  history: [],
  sessionComplete: false,
}

function createDummyPdf(): string {
  const filePath = path.join(os.tmpdir(), 'test-resume-interview.pdf')
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '%PDF-1.4 dummy content for testing')
  }
  return filePath
}

test.describe('면접 플로우', () => {
  test('업로드 → 면접 시작 → 질문 표시', async ({ page }) => {
    // Mock upload
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUESTIONS_RESPONSE),
      })
    )

    // Mock interview start
    await page.route('**/api/interview/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_START_RESPONSE),
      })
    )

    // Mock session GET
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION_RESPONSE),
      })
    )

    await page.goto('/')

    // Upload PDF
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    // Questions displayed
    await expect(page.getByText('예상 면접 질문')).toBeVisible()

    // Click interview start card → mode selection UI appears
    await page.getByRole('button', { name: /면접 시작하기/ }).click()
    await expect(page.getByText('면접 모드를 선택해주세요')).toBeVisible()

    // Select 실전 mode and confirm
    await page.getByRole('button', { name: '실전 모드' }).click()
    await page.getByRole('button', { name: '확인' }).click()

    // Should navigate to interview page with first question
    await expect(page.getByText('자기소개를 해주세요.')).toBeVisible()
    await expect(page.getByText('HR 면접관')).toBeVisible()
  })

  test('답변 제출 → 꼬리질문 표시', async ({ page }) => {
    // Mock session GET
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION_RESPONSE),
      })
    )

    // Mock answer
    await page.route('**/api/interview/answer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANSWER_RESPONSE_FOLLOWUP),
      })
    )

    await page.goto('/interview?sessionId=session-456')

    // First question displayed
    await expect(page.getByText('자기소개를 해주세요.')).toBeVisible()

    // Submit answer
    await page.getByPlaceholder('답변을 입력하세요...').fill('저는 개발자입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    // Follow-up question displayed
    await expect(page.getByText('좀 더 구체적으로 설명해주세요.')).toBeVisible()
    await expect(page.getByText('꼬리질문')).toBeVisible()
  })

  test('다른 페르소나 질문 전환', async ({ page }) => {
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION_RESPONSE),
      })
    )

    await page.route('**/api/interview/answer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANSWER_RESPONSE_NEXT),
      })
    )

    await page.goto('/interview?sessionId=session-456')

    await page.getByPlaceholder('답변을 입력하세요...').fill('답변입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    // Tech lead question appears
    await expect(page.getByText('사용한 기술 스택을 설명해주세요.')).toBeVisible()
    await expect(page.getByText('기술 리드')).toBeVisible()
  })

  test('면접 완료 시 완료 화면 표시', async ({ page }) => {
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION_RESPONSE),
      })
    )

    await page.route('**/api/interview/answer', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_ANSWER_RESPONSE_COMPLETE),
      })
    )

    await page.goto('/interview?sessionId=session-456')

    await page.getByPlaceholder('답변을 입력하세요...').fill('마지막 답변')
    await page.getByRole('button', { name: '답변 제출' }).click()

    await expect(page.getByText('면접이 완료되었습니다.')).toBeVisible()
    await expect(page.getByRole('button', { name: '다시 시작' })).toBeVisible()
  })

  test('sessionId 없으면 /resume로 리다이렉트', async ({ page }) => {
    await page.goto('/interview')

    // Should redirect to /resume
    await expect(page).toHaveURL(/\/resume/)
  })
})
