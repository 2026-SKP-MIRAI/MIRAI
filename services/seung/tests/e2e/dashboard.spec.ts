import { test, expect } from '@playwright/test'

const MOCK_DASHBOARD_WITH_DATA = {
  resumes: [
    {
      id: 'resume-1',
      createdAt: '2026-01-15T00:00:00.000Z',
      fileName: 'backend_resume.pdf',
      sessionCount: 2,
      reports: [{ id: 'report-1' }],
      hasDiagnosis: true,
      inProgressSessionId: null,
    },
    {
      id: 'resume-2',
      createdAt: '2026-01-10T00:00:00.000Z',
      fileName: 'frontend_resume.pdf',
      sessionCount: 1,
      reports: [],
      hasDiagnosis: false,
      inProgressSessionId: null,
    },
  ],
}

const MOCK_DASHBOARD_EMPTY = {
  resumes: [],
}

test.describe.configure({ mode: 'serial' })

test.describe('대시보드', () => {
  // 미들웨어 E2E 우회 쿠키 주입 (non-production 또는 E2E_AUTH_BYPASS=1 서버 환경에서만 동작)
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: '__e2e_bypass', value: '1', domain: 'localhost', path: '/' },
    ])
  })

  test('자소서 카드 렌더링: 날짜, 세션 수, 링크 버튼 표시', async ({ page }) => {
    await page.route('**/api/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD_WITH_DATA),
      })
    )

    await page.goto('/dashboard')

    // 헤더
    await expect(page.getByText('내 면접 기록')).toBeVisible()

    // 첫 번째 카드: 리포트 + 진단 링크 있음
    await expect(page.getByText('면접 2회')).toBeVisible()
    await expect(page.getByRole('button', { name: '역량 리포트' })).toBeVisible()
    await expect(page.getByRole('button', { name: '서류 진단' })).toBeVisible()

    // 두 번째 카드: 리포트 없음
    await expect(page.getByText('면접 1회')).toBeVisible()
  })

  test('빈 상태: 자소서 없을 때 안내 문구 + 새 면접 시작 버튼', async ({ page }) => {
    await page.route('**/api/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD_EMPTY),
      })
    )

    await page.goto('/dashboard')

    await expect(page.getByText('아직 자소서가 없습니다')).toBeVisible()
    await expect(page.getByRole('button', { name: '자소서 업로드하기 →' })).toBeVisible()
  })

  test('"자소서 업로드하기 →" 버튼 클릭 → /resume로 이동', async ({ page }) => {
    await page.route('**/api/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD_EMPTY),
      })
    )

    await page.goto('/dashboard')
    await page.getByRole('button', { name: '자소서 업로드하기 →' }).click()

    await expect(page).toHaveURL(/\/resume/)
  })

  test('헤더 "+ 자소서 업로드" 버튼 클릭 → /resume로 이동', async ({ page }) => {
    await page.route('**/api/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD_WITH_DATA),
      })
    )

    await page.goto('/dashboard')

    await page.getByRole('button', { name: '+ 자소서 업로드' }).click()

    await expect(page).toHaveURL(/\/resume/)
  })

  test('"다시 면접하기" 클릭 → /resume?resumeId=... 이동', async ({ page }) => {
    await page.route('**/api/dashboard', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_DASHBOARD_WITH_DATA),
      })
    )

    await page.goto('/dashboard')

    await page.getByRole('button', { name: '다시 면접하기' }).first().click()

    await expect(page).toHaveURL(/\/resume\?resumeId=resume-1/)
  })
})
