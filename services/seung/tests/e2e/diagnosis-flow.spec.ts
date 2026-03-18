import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

const MOCK_QUESTIONS_RESPONSE = {
  questions: [
    { category: '직무역량', question: '지원한 직무에서 가장 중요한 역량은 무엇이라고 생각하시나요?' },
  ],
  meta: { extractedLength: 1234, categoriesUsed: ['직무역량'] },
  resumeId: 'resume-diag-123',
}

const MOCK_DIAGNOSIS_RESULT = {
  scores: {
    specificity: 72,
    achievementClarity: 65,
    logicStructure: 80,
    roleAlignment: 88,
    differentiation: 60,
  },
  strengths: ['논리 구조가 명확함', '직무 적합성 높음'],
  weaknesses: ['수치 근거 부족', '차별성 낮음'],
  suggestions: [
    { section: '성장 경험', issue: '수치 없음', suggestion: '구체적 수치 추가 권장' },
  ],
}

function createDummyPdf(): string {
  const filePath = path.join(os.tmpdir(), 'test-resume.pdf')
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, '%PDF-1.4 dummy content for testing')
  }
  return filePath
}

test.describe('서류 진단 플로우', () => {
  test('업로드 완료 후 다음 단계 선택 카드가 표시된다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUESTIONS_RESPONSE),
      })
    )

    await page.goto('/')
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await expect(page.getByText('다음 단계를 선택하세요')).toBeVisible()
    await expect(page.getByRole('button', { name: /면접 시작하기/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /서류 진단받기/ })).toBeVisible()
  })

  test('"서류 진단받기" 클릭 시 진단 세부 UI가 펼쳐진다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUESTIONS_RESPONSE),
      })
    )

    await page.goto('/')
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await page.getByRole('button', { name: /서류 진단받기/ }).click()
    await expect(page.getByPlaceholder('예: 백엔드 개발자')).toBeVisible()
    await expect(page.getByRole('button', { name: '진단하기' })).toBeVisible()
  })

  test('targetRole 미입력 시 진단하기 버튼이 비활성화된다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUESTIONS_RESPONSE),
      })
    )

    await page.goto('/')
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await page.getByRole('button', { name: /서류 진단받기/ }).click()
    await expect(page.getByRole('button', { name: '진단하기' })).toBeDisabled()
  })

  test('진단하기 클릭 시 /diagnosis 페이지로 이동한다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUESTIONS_RESPONSE),
      })
    )
    await page.route('**/api/resume/feedback', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DIAGNOSIS_RESULT),
      })
    )
    await page.route('**/api/resume/diagnosis**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DIAGNOSIS_RESULT),
      })
    )

    await page.goto('/')
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await page.getByRole('button', { name: /서류 진단받기/ }).click()
    await page.getByPlaceholder('예: 백엔드 개발자').fill('백엔드 개발자')
    await page.getByRole('button', { name: '진단하기' }).click()

    await expect(page).toHaveURL(/\/diagnosis\?resumeId=/)
  })

  test('/diagnosis 페이지에서 5개 점수·강점·약점·개선 방향이 표시된다', async ({ page }) => {
    await page.route('**/api/resume/diagnosis**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DIAGNOSIS_RESULT),
      })
    )

    await page.goto('/diagnosis?resumeId=resume-diag-123')

    await expect(page.getByText('MirAI — 서류 강점·약점 진단')).toBeVisible()
    await expect(page.getByText('항목별 점수')).toBeVisible()
    await expect(page.getByText('서술의 구체성', { exact: true })).toBeVisible()
    await expect(page.getByText('성과 수치 명확성', { exact: true })).toBeVisible()
    await expect(page.getByText('논리 구조', { exact: true })).toBeVisible()
    await expect(page.getByText('직무 적합성', { exact: true })).toBeVisible()
    await expect(page.getByText('차별성', { exact: true })).toBeVisible()
    await expect(page.getByText('강점', { exact: true })).toBeVisible()
    await expect(page.getByText('논리 구조가 명확함')).toBeVisible()
    await expect(page.getByText('약점', { exact: true })).toBeVisible()
    await expect(page.getByText('수치 근거 부족')).toBeVisible()
    await expect(page.getByText('개선 방향', { exact: true })).toBeVisible()
    await expect(page.getByText('구체적 수치 추가 권장')).toBeVisible()
  })

  test('/diagnosis에서 "홈으로" 버튼 클릭 시 /resume로 이동한다', async ({ page }) => {
    await page.route('**/api/resume/diagnosis**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DIAGNOSIS_RESULT),
      })
    )

    await page.goto('/diagnosis?resumeId=resume-diag-123')
    await expect(page.getByText('MirAI — 서류 강점·약점 진단')).toBeVisible()
    await page.getByRole('button', { name: '홈으로' }).click()

    await expect(page).toHaveURL(/\/resume/)
  })

  test('resumeId 없이 /diagnosis 진입 시 /resume로 redirect된다', async ({ page }) => {
    await page.goto('/diagnosis')
    await expect(page).toHaveURL(/\/resume/)
  })

  test('/diagnosis에서 404 응답 시 /resume로 redirect된다', async ({ page }) => {
    await page.route('**/api/resume/diagnosis**', (route) =>
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: '진단 결과가 없습니다.' }),
      })
    )

    await page.goto('/diagnosis?resumeId=no-result')
    await expect(page).toHaveURL(/\/resume/)
  })
})
