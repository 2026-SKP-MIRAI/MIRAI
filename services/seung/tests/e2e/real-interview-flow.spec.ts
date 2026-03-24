import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 실제 엔진 + 실제 Supabase를 사용하는 이슈 #57 end-to-end 테스트.
 * 실행 전 필수:
 *   - 엔진 서버: http://localhost:8000 실행 중
 *   - services/seung: .env.local에 DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
 *   - PDF fixture: engine/tests/fixtures/input/sample_resume.pdf
 */

const PDF_PATH = path.join(
  __dirname,
  '../../../../engine/tests/fixtures/input/sample_resume.pdf'
)

const LLM_TIMEOUT = 60_000

test('이슈 #57: 자소서 업로드 → 패널 면접 → 꼬리질문 전체 플로우', async ({ page }) => {
  test.setTimeout(300_000) // 실제 LLM 호출 4회 포함 — 최대 5분
  // 1. /resume 페이지 접속
  await page.goto('/')
  await expect(page.getByText('자소서 분석')).toBeVisible()

  // 2. 실제 PDF 업로드
  await page.getByLabel('PDF 파일').setInputFiles(PDF_PATH)
  await page.getByRole('button', { name: '질문 생성' }).click()

  // 3. 질문 생성 완료 대기 (LLM 호출)
  await expect(page.getByText('예상 면접 질문')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 4. "면접 시작하기" 카드 클릭 → 모드 선택 → 확인
  const startCard = page.getByRole('button', { name: /면접 시작하기/ })
  await expect(startCard).toBeVisible({ timeout: LLM_TIMEOUT })
  await startCard.click()
  await page.getByRole('button', { name: '실전 모드' }).click()
  await page.getByRole('button', { name: '확인' }).click()

  // 5. /interview 페이지 이동 + 첫 질문 버블 대기 (엔진 호출)
  await expect(page).toHaveURL(/\/interview\?sessionId=/, { timeout: LLM_TIMEOUT })
  await expect(page.getByText('MirAI — 패널 면접')).toBeVisible()

  // 첫 질문 버블 (페르소나 라벨 + 질문 텍스트)
  const firstPersonaLabel = page.locator('.rounded-xl').first()
  await expect(firstPersonaLabel).toBeVisible({ timeout: LLM_TIMEOUT })

  // 6. 첫 번째 답변 제출
  const textarea = page.getByPlaceholder('답변을 입력하세요...')
  await expect(textarea).toBeVisible()
  await textarea.fill(
    '저는 팀 협업을 중시하며, 지난 프로젝트에서 백엔드 API 설계를 주도하여 팀 생산성을 30% 향상시켰습니다. 구체적으로는 REST API 표준을 수립하고 Swagger 문서화를 통해 프론트엔드팀과의 소통 비용을 줄였습니다.'
  )
  await page.getByRole('button', { name: '답변 제출' }).click()

  // 7. 꼬리질문 또는 다음 페르소나 질문 수신 대기 (API 완료 = textarea 재활성화)
  await expect(textarea).toBeEnabled({ timeout: LLM_TIMEOUT })

  // 8. 두 번째 답변 제출
  await textarea.fill(
    '네, 구체적으로 설명드리겠습니다. API 응답 시간을 평균 200ms에서 80ms로 줄이기 위해 Redis 캐싱을 도입하고, N+1 쿼리 문제를 해결했습니다.'
  )
  await page.getByRole('button', { name: '답변 제출' }).click()

  // 9. 세 번째 질문 수신 대기 (API 완료 = textarea 재활성화)
  await expect(textarea).toBeEnabled({ timeout: LLM_TIMEOUT })
})
