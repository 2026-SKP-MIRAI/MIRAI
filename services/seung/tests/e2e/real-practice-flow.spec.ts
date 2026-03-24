import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 실제 엔진 + 실제 Supabase를 사용하는 연습 모드 전체 플로우 E2E 테스트.
 * 실행 전 필수:
 *   - 엔진 서버: http://localhost:8000 실행 중
 *   - services/seung: .env.local에 DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY 설정
 *   - PDF fixture: engine/tests/fixtures/input/sample_resume.pdf
 */

const PDF_PATH = path.join(
  __dirname,
  '../../../../engine/tests/fixtures/input/sample_resume.pdf'
)

const LLM_TIMEOUT = 90_000

const FIRST_ANSWER =
  '저는 팀 협업을 중시하며, 백엔드 API 설계를 주도하여 팀 생산성을 30% 향상시켰습니다. 구체적으로 REST API 표준을 수립하고 Swagger 문서화를 통해 프론트엔드팀과의 소통 비용을 줄였습니다.'

const RETRY_ANSWER =
  '결론부터 말씀드리면, 저는 팀 협업과 문서화를 통해 팀 생산성을 30% 향상시킨 경험이 있습니다. 구체적으로 REST API 표준을 수립하고 Swagger 자동화 문서를 도입하여 프론트엔드팀과의 소통 비용을 크게 줄였습니다. 이 과정에서 리더십과 커뮤니케이션 능력을 발휘했습니다.'

const NEXT_ANSWER =
  'Redis 캐싱 도입과 N+1 쿼리 해결을 통해 API 응답 시간을 200ms에서 80ms로 줄였습니다. 데이터 기반으로 병목 지점을 파악하고 단계적으로 개선했습니다.'

test('연습 모드 전체 플로우: 자소서 업로드 → 연습 모드 선택 → 피드백 → 재답변 → 다음 질문', async ({ page }) => {
  test.setTimeout(600_000) // 실제 LLM 호출 다수 포함 — 최대 10분

  // 1. /resume 접속 + PDF 업로드
  await page.goto('/')
  await expect(page.getByText('자소서 분석')).toBeVisible()

  await page.getByLabel('PDF 파일').setInputFiles(PDF_PATH)
  await page.getByRole('button', { name: '질문 생성' }).click()

  // 2. 질문 생성 완료 대기 (LLM 호출)
  await expect(page.getByText('예상 면접 질문')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 3. "면접 시작" 클릭 → 모드 선택 UI 표시
  await page.getByRole('button', { name: /면접 시작/ }).click()
  await expect(page.getByText('면접 모드를 선택해주세요')).toBeVisible()

  // 4. 연습 모드 선택 → "확인" 클릭
  await page.getByRole('button', { name: /연습 모드/ }).click()
  await page.getByRole('button', { name: '확인' }).click()

  // 5. /interview 페이지 이동 대기 (interviewMode=practice 포함)
  await expect(page).toHaveURL(/\/interview\?sessionId=.*interviewMode=practice/, { timeout: LLM_TIMEOUT })
  await expect(page.getByText('MirAI — 패널 면접')).toBeVisible()

  // 6. 첫 질문 표시 확인
  const textarea = page.getByPlaceholder('답변을 입력하세요...')
  await expect(textarea).toBeVisible({ timeout: LLM_TIMEOUT })

  // 7. 첫 답변 제출
  await textarea.fill(FIRST_ANSWER)
  await page.getByRole('button', { name: '답변 제출' }).click()

  // 8. 피드백 블록 대기 (LLM 호출)
  await expect(page.locator('text=점수')).toBeVisible({ timeout: LLM_TIMEOUT })
  await expect(page.locator('text=잘한 점')).toBeVisible()
  await expect(page.locator('text=개선할 점')).toBeVisible()
  await expect(page.locator('text=개선 가이드')).toBeVisible()

  // 9. "다시 답변하기" 버튼 표시 확인 + 클릭
  await expect(page.getByRole('button', { name: '다시 답변하기' })).toBeVisible()
  await page.getByRole('button', { name: '다시 답변하기' }).click()

  // 10. 답변 입력창 재표시 확인
  await expect(textarea).toBeVisible()

  // 11. 재답변 제출
  await textarea.fill(RETRY_ANSWER)
  await page.getByRole('button', { name: '답변 제출' }).click()

  // 12. comparisonDelta (향상도) 표시 대기
  await expect(page.locator('text=향상도')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 13. "다음 질문" 클릭
  await expect(page.getByRole('button', { name: '다음 질문' })).toBeVisible()
  await page.getByRole('button', { name: '다음 질문' }).click()

  // 14. 다음 질문 수신 대기 (엔진 /api/interview/answer 호출)
  await expect(textarea).toBeVisible({ timeout: LLM_TIMEOUT })
  await expect(textarea).toBeEnabled({ timeout: LLM_TIMEOUT })

  // 15. 다음 질문에 실전 모드처럼 답변 후 흐름 정상 작동 확인
  await textarea.fill(NEXT_ANSWER)
  await page.getByRole('button', { name: '답변 제출' }).click()

  // 16. 피드백 블록 재표시 확인 (연습 모드 유지)
  await expect(page.locator('text=점수')).toBeVisible({ timeout: LLM_TIMEOUT })
  await expect(page.getByRole('button', { name: '다음 질문' })).toBeVisible()
})
