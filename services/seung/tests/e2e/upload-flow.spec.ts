import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import os from 'os'

const MOCK_SUCCESS_RESPONSE = {
  questions: [
    { category: '직무역량', question: '지원한 직무에서 가장 중요한 역량은 무엇이라고 생각하시나요?' },
    { category: '직무역량', question: '관련 프로젝트 경험을 구체적으로 설명해 주세요.' },
    { category: '인성', question: '팀 내 갈등 상황을 어떻게 해결하셨나요?' },
  ],
  meta: {
    extractedLength: 1234,
    categoriesUsed: ['직무역량', '인성'],
  },
}

/** 테스트용 더미 PDF 파일 경로를 반환한다 (tmpdir에 생성) */
function createDummyPdf(): string {
  const filePath = path.join(os.tmpdir(), 'test-resume.pdf')
  if (!fs.existsSync(filePath)) {
    // 최소한의 PDF 헤더를 가진 더미 파일
    fs.writeFileSync(filePath, '%PDF-1.4 dummy content for testing')
  }
  return filePath
}

test.describe('업로드 플로우', () => {
  test('성공: PDF 업로드 후 카테고리별 질문이 표시된다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUCCESS_RESPONSE),
      })
    )

    await page.goto('/')

    // 업로드 폼이 보여야 함
    await expect(page.getByText('자소서 분석')).toBeVisible()

    // 더미 PDF 업로드
    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)

    // 질문 생성 버튼 클릭
    await page.getByRole('button', { name: '질문 생성' }).click()

    // 결과 화면: 질문 개수, 카테고리 표시
    await expect(page.getByText('예상 면접 질문 (3개)')).toBeVisible()
    await expect(page.getByText('직무역량')).toBeVisible()
    await expect(page.getByText('인성')).toBeVisible()
    await expect(page.getByText('지원한 직무에서 가장 중요한 역량은 무엇이라고 생각하시나요?')).toBeVisible()
  })

  test('422 에러: 텍스트 없는 PDF 에러 메시지가 표시된다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'unprocessable' }),
      })
    )

    await page.goto('/')

    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await expect(
      page.getByRole('alert').filter({
        hasText: '텍스트를 읽을 수 없는 PDF입니다.',
      })
    ).toBeVisible()
  })

  test('500 에러: 서버 오류 메시지가 표시된다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'internal server error' }),
      })
    )

    await page.goto('/')

    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    await expect(
      page.getByRole('alert').filter({
        hasText: '서버 오류가 발생했습니다.',
      })
    ).toBeVisible()
  })

  test('다시 하기: 결과 화면에서 업로드 폼으로 돌아간다', async ({ page }) => {
    await page.route('**/api/resume/questions', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUCCESS_RESPONSE),
      })
    )

    await page.goto('/')

    const pdfPath = createDummyPdf()
    await page.getByLabel('PDF 파일').setInputFiles(pdfPath)
    await page.getByRole('button', { name: '질문 생성' }).click()

    // 결과 화면 확인 후
    await expect(page.getByText('예상 면접 질문 (3개)')).toBeVisible()

    // 다시 하기 클릭
    await page.getByRole('button', { name: '다시 하기' }).click()

    // 업로드 폼으로 복귀
    await expect(page.getByText('자소서 분석')).toBeVisible()
    await expect(page.getByRole('button', { name: '질문 생성' })).toBeVisible()
  })
})
