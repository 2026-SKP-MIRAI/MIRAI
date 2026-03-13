import { test, expect } from '@playwright/test'
import path from 'path'

test.describe('패널 면접 e2e 플로우', () => {
  test('PDF 업로드 → 질문 생성 → 면접 시작 → 완료', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // 1. PDF 업로드
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(path.join(__dirname, '../tests/fixtures/input/sample.pdf'))

    await page.getByRole('button', { name: /질문 생성/i }).click()

    // 2. 질문 목록 확인
    await expect(page.getByText('면접 시작')).toBeVisible({ timeout: 30_000 })

    // 3. 면접 시작
    await page.getByRole('button', { name: /면접 시작/i }).click()

    // 4. 첫 질문 확인 (페르소나 레이블 포함)
    const question = page.getByTestId('current-question')
    await expect(question).toBeVisible({ timeout: 30_000 })
    const personaLabel = await question.locator('span').innerText()
    expect(['HR 담당자', '기술팀장', '경영진']).toContain(personaLabel)

    // 5~6. 여러 번 답변 제출 (최대 10턴)
    let complete = false
    for (let i = 0; i < 10; i++) {
      const textarea = page.getByRole('textbox', { name: /답변 입력/i })
      const isVisible = await textarea.isVisible().catch(() => false)
      if (!isVisible) {
        complete = true
        break
      }
      await textarea.fill(`테스트 답변 ${i + 1}번입니다.`)
      await page.getByRole('button', { name: /답변 제출/i }).click()
      await page.waitForTimeout(500)

      const doneText = await page.getByText(/면접이 완료되었습니다/i).isVisible().catch(() => false)
      if (doneText) {
        complete = true
        break
      }
    }

    // 7. 완료 화면 확인
    await expect(page.getByText(/면접이 완료되었습니다/i)).toBeVisible({ timeout: 60_000 })
  })
})
