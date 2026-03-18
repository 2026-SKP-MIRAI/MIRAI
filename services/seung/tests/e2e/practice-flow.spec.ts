import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

test.setTimeout(120_000)

// Mock 데이터
const MOCK_QUESTIONS_RESPONSE = {
  questions: [
    { category: '직무역량', question: '지원한 직무에서 가장 중요한 역량은 무엇인가요?' },
  ],
  meta: { extractedLength: 1000, categoriesUsed: ['직무역량'] },
  resumeId: 'resume-practice-1',
}

const MOCK_START_RESPONSE = {
  sessionId: 'session-practice-1',
  firstQuestion: {
    persona: 'hr',
    personaLabel: 'HR 면접관',
    question: '자기소개를 해주세요.',
    type: 'main',
  },
}

const MOCK_SESSION_RESPONSE = {
  currentQuestion: '자기소개를 해주세요.',
  currentPersona: 'hr',
  currentPersonaLabel: 'HR 면접관',
  currentQuestionType: 'main',
  history: [],
  sessionComplete: false,
  interviewMode: 'practice',
}

const MOCK_PRACTICE_FEEDBACK = {
  score: 72,
  feedback: {
    good: ['구체적인 경험을 제시했습니다.'],
    improve: ['결론을 먼저 말하면 효과적입니다.'],
  },
  keywords: ['리더십', '협업'],
  improvedAnswerGuide: '결론 → 이유 → 사례 순서로 답변해 보세요.',
  comparisonDelta: null,
}

const MOCK_PRACTICE_FEEDBACK_RETRY = {
  score: 84,
  feedback: {
    good: ['결론을 먼저 제시했습니다.'],
    improve: [],
  },
  keywords: ['리더십'],
  improvedAnswerGuide: '잘 작성됐습니다.',
  comparisonDelta: {
    scoreDelta: 12,
    improvements: ['결론을 먼저 제시했습니다.'],
  },
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

function createDummyPdf(): string {
  const filePath = path.join(os.tmpdir(), 'test-practice.pdf')
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '%PDF-1.4 dummy content')
  }
  return filePath
}

test.describe('연습 모드 플로우', () => {
  test('연습 모드 선택 → 면접 시작 → 첫 질문 표시', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_QUESTIONS_RESPONSE) })
    )
    await page.route('**/api/interview/start', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_START_RESPONSE) })
    )
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION_RESPONSE) })
    )

    await page.goto('/')

    // PDF 업로드
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    // 질문 목록 표시 확인
    await expect(page.getByText('예상 면접 질문')).toBeVisible()

    // 면접 시작 카드 클릭 → 모드 선택 UI 표시
    await page.getByRole('button', { name: /면접 시작하기/ }).click()
    await expect(page.getByText('면접 모드를 선택해주세요')).toBeVisible()

    // 연습 모드 선택 후 확인
    await page.getByRole('button', { name: /연습 모드/ }).click()
    await page.getByRole('button', { name: '확인' }).click()

    // 면접 페이지로 이동 + 첫 질문 표시
    await expect(page.getByText('자기소개를 해주세요.')).toBeVisible()
    await expect(page.getByText('HR 면접관')).toBeVisible()
  })

  test('답변 제출 → 피드백 블록 표시 (score, good, improve, keywords)', async ({ page }) => {
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION_RESPONSE) })
    )
    await page.route('**/api/practice/feedback', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRACTICE_FEEDBACK) })
    )

    await page.goto('/interview?sessionId=session-practice-1&interviewMode=practice')

    await expect(page.getByText('자기소개를 해주세요.')).toBeVisible()

    // 답변 제출
    await page.getByPlaceholder('답변을 입력하세요...').fill('저는 리더십을 발휘한 개발자입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    // 피드백 블록 표시
    await expect(page.getByText('72점')).toBeVisible()
    await expect(page.getByText('구체적인 경험을 제시했습니다.')).toBeVisible()
    await expect(page.getByText('결론을 먼저 말하면 효과적입니다.')).toBeVisible()
    await expect(page.getByText('#리더십')).toBeVisible()

    // 버튼 표시
    await expect(page.getByRole('button', { name: '다시 답변하기' })).toBeVisible()
    await expect(page.getByRole('button', { name: '다음 질문' })).toBeVisible()
  })

  test('"다시 답변하기" → 재답변 → comparisonDelta 표시', async ({ page }) => {
    let callCount = 0
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION_RESPONSE) })
    )
    await page.route('**/api/practice/feedback', async (route) => {
      callCount++
      if (callCount === 2) {
        const requestBody = JSON.parse(route.request().postData() ?? '{}')
        expect(requestBody.previousAnswer).toBeTruthy()
      }
      const response = callCount === 1 ? MOCK_PRACTICE_FEEDBACK : MOCK_PRACTICE_FEEDBACK_RETRY
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
    })

    await page.goto('/interview?sessionId=session-practice-1&interviewMode=practice')

    // 첫 답변
    await page.getByPlaceholder('답변을 입력하세요...').fill('첫 번째 답변입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    await expect(page.getByText('72점')).toBeVisible()
    await expect(page.getByRole('button', { name: '다시 답변하기' })).toBeVisible()

    // 다시 답변하기 클릭
    await page.getByRole('button', { name: '다시 답변하기' }).click()

    // 재답변 입력
    await page.getByPlaceholder('답변을 입력하세요...').fill('결론부터 말씀드리면, 저는 리더십이 강한 개발자입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    // comparisonDelta 표시
    await expect(page.getByText(/향상도.*\+12점/)).toBeVisible()
    await expect(page.getByText('결론을 먼저 제시했습니다.').first()).toBeVisible()
  })

  test('"다음 질문" → /api/interview/answer 호출 → 다음 질문 표시', async ({ page }) => {
    await page.route('**/api/interview/session*', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION_RESPONSE) })
    )
    await page.route('**/api/practice/feedback', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_PRACTICE_FEEDBACK) })
    )
    await page.route('**/api/interview/answer', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_ANSWER_RESPONSE_NEXT) })
    )

    await page.goto('/interview?sessionId=session-practice-1&interviewMode=practice')

    // 답변 제출
    await page.getByPlaceholder('답변을 입력하세요...').fill('저는 개발자입니다.')
    await page.getByRole('button', { name: '답변 제출' }).click()

    await expect(page.getByText('72점')).toBeVisible()

    // 다음 질문 클릭
    await page.getByRole('button', { name: '다음 질문' }).click()

    // 다음 질문 표시
    await expect(page.getByText('사용한 기술 스택을 설명해주세요.')).toBeVisible()
    await expect(page.getByText('기술 리드')).toBeVisible()
  })
})
