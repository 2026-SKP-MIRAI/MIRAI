import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 실제 엔진 서버를 호출하는 E2E 테스트.
 * 실행 전 필수: 엔진 서버가 http://localhost:8000 에서 실행 중이어야 함.
 * 테스트 PDF: tests/e2e/fixtures/sample-resume.pdf 에 자소서 PDF를 넣어두어야 함.
 */
const PDF_PATH = path.join(__dirname, '../../../../engine/tests/fixtures/input/sample_resume.pdf')

test('실제 자소서 업로드 → 질문 생성', async ({ page }) => {
  await page.goto('/')

  // 업로드 폼 확인
  await expect(page.getByText('자소서 분석')).toBeVisible()

  // 실제 PDF 업로드
  await page.getByLabel('PDF 파일').setInputFiles(PDF_PATH)

  // 질문 생성 버튼 클릭
  await page.getByRole('button', { name: '질문 생성' }).click()

  // LLM 호출 시간 고려 — 최대 60초 대기
  await expect(page.getByText('예상 면접 질문')).toBeVisible({ timeout: 60000 })

  // 질문이 1개 이상 표시되는지 확인
  const questions = page.locator('li')
  await expect(questions.first()).toBeVisible({ timeout: 60000 })
})
