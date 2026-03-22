import { test, expect } from '@playwright/test'
import path from 'path'

const PDF_PATH = path.resolve(__dirname, '../tests/fixtures/input/test-resume.pdf')

// ──────────────────────────────────────────────────────────────
test.describe('kwan Phase 3 전체 플로우', () => {
  test('연습 모드 — PDF 업로드 → 자소서 진단 → 연습 면접 (피드백 + 재답변)', async ({ page }) => {
    test.setTimeout(1_200_000) // 20분 — LLM 질문당 ~70s, 최대 10문항

    // ── 1. 메인 페이지 진입 ──────────────────────────────────
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/kwan|MirAI|면접/i, { timeout: 10_000 })

    // ── 2. PDF 업로드 ─────────────────────────────────────────
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(PDF_PATH)
    await expect(page.getByText(/포트폴리오_003|반도체소프트웨어|\.pdf/i)).toBeVisible({ timeout: 5_000 })

    // ── 3. 질문 생성 → 지원 직무 확인 ────────────────────────
    await page.getByRole('button', { name: /질문 생성/i }).click()
    await expect(page.getByText(/지원 직무 확인/i)).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('input[type="text"]')).toHaveValue(/.+/, { timeout: 5_000 })
    await page.waitForTimeout(1_500)
    await page.getByRole('button', { name: /확정|자소서 진단 시작/i }).click()

    // ── 4. 자소서 5축 진단 ───────────────────────────────────
    await page.waitForURL(/\/diagnosis/, { timeout: 15_000 })
    await expect(page.getByText(/5축 진단|축별 점수/i).first()).toBeVisible({ timeout: 90_000 })
    await page.waitForTimeout(3_000)

    // ── 5. 연습 모드 선택 ─────────────────────────────────────
    await page.getByRole('button', { name: /면접 시작/i }).click()
    await page.waitForURL(/\/interview/, { timeout: 10_000 })
    await expect(page.getByText(/면접 모드 선택/i)).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: /연습 모드/i }).click()
    await expect(page.getByText(/HR 담당자|기술팀장|경영진/i).first()).toBeVisible({ timeout: 120_000 })

    // ── 6. 연습 면접 — 첫 번째 답변 + 재답변 ────────────────
    const textarea = page.getByRole('textbox')
    await textarea.fill('반도체 소프트웨어 분야에 지원한 이유는 화학과 SW를 융합해 임베디드 시스템을 개발하고 싶었기 때문입니다.')
    await page.getByRole('button', { name: /답변 제출/i }).click()

    // 피드백 패널 대기
    await expect(page.locator('[data-testid="practice-feedback"]')).toBeVisible({ timeout: 90_000 })
    await page.waitForTimeout(2_500)

    // 다시 답변하기 클릭
    await page.getByRole('button', { name: /다시 답변하기/i }).click()
    await expect(page.getByRole('textbox')).toBeVisible({ timeout: 3_000 })
    await page.waitForTimeout(1_000)

    // 개선된 답변 제출
    await page.getByRole('textbox').fill('반도체 소프트웨어 분야에 지원한 이유는 화학과 SW 복수전공을 통해 쌓은 임베디드 개발 역량을 실제 제품에 적용하고 싶었기 때문입니다. 특히 QD-LED 연구에서 CdSe 기반 디바이스를 실험하며 하드웨어-소프트웨어 연계의 중요성을 직접 체감했습니다.')
    await page.getByRole('button', { name: /답변 제출/i }).click()

    // 재답변 피드백 패널 (comparisonDelta 포함)
    await expect(page.locator('[data-testid="practice-feedback"]')).toBeVisible({ timeout: 90_000 })
    await page.waitForTimeout(2_500)
    await page.getByRole('button', { name: /다음 질문/i }).click()

    // ── 7. 남은 질문들 — 답변 제출 → 피드백 확인 → 다음 질문 ─
    for (let i = 0; i < 8; i++) {
      const isDone = await page.getByText(/면접이 완료되었습니다/i).isVisible().catch(() => false)
      if (isDone) break

      const ta = page.getByRole('textbox')
      if (!await ta.isVisible().catch(() => false)) break

      await ta.fill(
        `${i + 2}번 답변입니다. 구체적인 경험과 수치를 바탕으로 팀워크와 문제 해결 능력을 발휘했습니다. ` +
        `특히 Python과 C++을 활용한 임베디드 프로젝트에서 성과를 냈습니다.`
      )
      await page.getByRole('button', { name: /답변 제출/i }).click()

      // 피드백 패널 또는 완료 대기
      await Promise.race([
        page.locator('[data-testid="practice-feedback"]').waitFor({ state: 'visible', timeout: 90_000 }),
        page.getByText(/면접이 완료되었습니다/i).waitFor({ state: 'visible', timeout: 90_000 }),
      ])

      const feedbackVisible = await page.locator('[data-testid="practice-feedback"]').isVisible().catch(() => false)
      if (feedbackVisible) {
        await page.waitForTimeout(1_500)
        await page.getByRole('button', { name: /다음 질문/i }).click()
      }
    }

    // ── 8. 면접 완료 → 8축 리포트 ────────────────────────────
    await expect(page.getByText(/면접이 완료되었습니다/i)).toBeVisible({ timeout: 30_000 })

    const reportBtn = page.getByRole('button', { name: /리포트 생성/i })
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.click()
      await page.waitForURL(/\/report/, { timeout: 15_000 })
      await expect(page.getByText(/8축 역량 리포트|종합 점수/i).first()).toBeVisible({ timeout: 120_000 })
      for (const label of ['의사소통', '문제해결', '논리적 사고', '직무 전문성', '조직 적합성', '리더십', '창의성', '성실성']) {
        await expect(page.getByText(label).first()).toBeVisible({ timeout: 5_000 })
      }
      await page.waitForTimeout(3_000)
    }
  })

  test('PDF 업로드 → 질문 생성 → 자소서 진단 → 면접 → 리포트', async ({ page }) => {

    // ── 1. 메인 페이지 진입 ──────────────────────────────────
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/kwan|MirAI|면접/i, { timeout: 10_000 })

    // ── 2. PDF 업로드 ─────────────────────────────────────────
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles(PDF_PATH)
    await expect(page.getByText(/포트폴리오_003|반도체소프트웨어|\.pdf/i)).toBeVisible({ timeout: 5_000 })

    // ── 3. 질문 생성 → 지원 직무 확인 (LLM /analyze + /questions) ──
    await page.getByRole('button', { name: /질문 생성/i }).click()
    await expect(page.getByText(/지원 직무 확인/i)).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('input[type="text"]')).toHaveValue(/.+/, { timeout: 5_000 })
    await page.waitForTimeout(1_500)
    await page.getByRole('button', { name: /확정|자소서 진단 시작/i }).click()

    // ── 4. 자소서 5축 진단 (LLM /feedback) ───────────────────
    await page.waitForURL(/\/diagnosis/, { timeout: 15_000 })
    await expect(page.getByText(/5축 진단|축별 점수/i).first()).toBeVisible({ timeout: 90_000 })
    for (const label of ['구체성', '성과 명확성', '논리 구조', '직무 정합성', '차별성']) {
      await expect(page.getByText(label).first()).toBeVisible({ timeout: 5_000 })
    }
    await expect(page.getByText(/강점/i).first()).toBeVisible()
    await expect(page.getByText(/약점/i).first()).toBeVisible()
    await expect(page.getByText(/개선 제안/i).first()).toBeVisible()
    // 진단 결과 확인 — 3초 대기
    await page.waitForTimeout(3_000)

    // ── 5. 면접 시작 → 모드 선택 → 실전 모드 선택 (LLM /start) ─
    await page.getByRole('button', { name: /면접 시작/i }).click()
    await page.waitForURL(/\/interview/, { timeout: 10_000 })
    // 모드 선택 화면 확인 후 실전 모드 선택
    await expect(page.getByText(/면접 모드 선택/i)).toBeVisible({ timeout: 5_000 })
    await page.waitForTimeout(1_000)
    await page.getByRole('button', { name: /실전 모드/i }).click()
    // LLM /start 호출 후 첫 질문 표시
    await expect(page.getByText(/HR 담당자|기술팀장|경영진/i).first()).toBeVisible({ timeout: 120_000 })

    // ── 6. 면접 시뮬레이션 (LLM /answer) ─────────────────────
    for (let i = 0; i < 10; i++) {
      const isDone = await page.getByText(/면접이 완료되었습니다|리포트 생성/i).isVisible().catch(() => false)
      if (isDone) break

      const textarea = page.getByRole('textbox')
      if (!await textarea.isVisible().catch(() => false)) break

      await textarea.fill(
        `${i + 1}번 답변입니다. 반도체 소프트웨어 분야에서 쌓은 경험을 바탕으로 ` +
        `문제 해결 능력과 팀워크를 발휘해 성과를 만들어왔습니다.`
      )
      await page.getByRole('button', { name: /답변 제출|제출/i }).click()
      // LLM 다음 질문 생성 대기
      await expect(page.getByText(/HR 담당자|기술팀장|경영진|면접이 완료되었습니다/i).first())
        .toBeVisible({ timeout: 60_000 })
      await page.waitForTimeout(500)
    }

    // ── 7. 면접 완료 확인 ────────────────────────────────────
    await expect(page.getByText(/면접이 완료되었습니다|리포트 생성/i).first()).toBeVisible({ timeout: 30_000 })

    // ── 8. 8축 역량 리포트 (LLM /report/generate) ────────────
    const reportBtn = page.getByRole('button', { name: /리포트 생성/i })
    if (await reportBtn.isVisible().catch(() => false)) {
      await reportBtn.click()
      await page.waitForURL(/\/report/, { timeout: 15_000 })
      await expect(page.getByText(/8축 역량 리포트|종합 점수/i).first()).toBeVisible({ timeout: 120_000 })

      for (const label of ['의사소통', '문제해결', '논리적 사고', '직무 전문성', '조직 적합성', '리더십', '창의성', '성실성']) {
        await expect(page.getByText(label).first()).toBeVisible({ timeout: 5_000 })
      }
      await expect(page.getByText(/강점 영역|개선 영역/i).first()).toBeVisible({ timeout: 5_000 })
      // 8축 리포트 확인 — 3초 대기 후 종료
      await page.waitForTimeout(3_000)
    }
  })
})
