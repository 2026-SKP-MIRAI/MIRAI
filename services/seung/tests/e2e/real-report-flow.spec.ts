import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 실제 엔진 + 실제 Supabase를 사용하는 리포트 전체 플로우 E2E 테스트.
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

const SAMPLE_ANSWERS = [
  '저는 팀 협업을 중시하며, 백엔드 API 설계를 주도하여 팀 생산성을 30% 향상시켰습니다. 구체적으로 REST API 표준을 수립하고 Swagger 문서화를 통해 프론트엔드팀과의 소통 비용을 줄였습니다.',
  'Redis 캐싱 도입과 N+1 쿼리 해결을 통해 API 응답 시간을 200ms에서 80ms로 줄였습니다. 데이터 기반으로 병목 지점을 파악하고 단계적으로 개선했습니다.',
  '문제가 발생하면 먼저 로그와 지표를 통해 근본 원인을 파악합니다. 이후 가설을 세우고 작은 단위로 검증하며 해결책을 적용합니다.',
  '새로운 기술을 습득할 때는 공식 문서와 사이드 프로젝트를 병행합니다. 최근에는 Next.js App Router와 Prisma를 직접 적용해보며 학습했습니다.',
  '팀원과의 명확한 커뮤니케이션을 위해 작업 진행 상황을 주기적으로 공유하고, 이슈가 생기면 빠르게 알립니다.',
  '리더십은 강요가 아니라 팀원의 강점을 파악하고 적재적소에 역할을 분배하는 것이라고 생각합니다. 이전 프로젝트에서 팀장을 맡아 이런 방식으로 운영했습니다.',
  '창의적인 아이디어를 제안할 때는 실현 가능성과 비용을 함께 제시합니다. 아이디어만 제안하는 것이 아니라 실행 계획까지 준비합니다.',
  '성실함이 저의 가장 큰 강점입니다. 마감 기한을 반드시 지키며, 어려운 상황에서도 최선을 다해 완수하는 것을 원칙으로 합니다.',
  '앞으로 풀스택 엔지니어로 성장하여 제품 전반을 이해하고 더 넓은 관점으로 기여하고 싶습니다.',
  '이 회사에서 다양한 도메인의 문제를 경험하고, 기술적으로도 인격적으로도 성장하고 싶습니다.',
  '저는 코드 품질을 중요시하여 코드 리뷰에 적극적으로 참여하고, 테스트 코드 작성을 습관화하고 있습니다.',
  '협업 도구 활용에 익숙하며, Jira와 Notion을 통해 팀 전체가 동일한 목표를 바라볼 수 있도록 문서화합니다.',
]

test('전체 플로우: 자소서 업로드 → 패널 면접 → 리포트 생성', async ({ page }) => {
  test.setTimeout(600_000) // 실제 LLM 호출 다수 포함 — 최대 10분

  // 1. /resume 접속 + PDF 업로드
  await page.goto('/')
  await expect(page.getByText('자소서 분석')).toBeVisible()

  await page.getByLabel('PDF 파일').setInputFiles(PDF_PATH)
  await page.getByRole('button', { name: '질문 생성' }).click()

  // 2. 질문 생성 완료 대기 (LLM 호출)
  await expect(page.getByText('예상 면접 질문')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 3. 면접 시작하기 카드 클릭 → 모드 선택 → 확인
  const startCard = page.getByRole('button', { name: /면접 시작하기/ })
  await expect(startCard).toBeVisible({ timeout: LLM_TIMEOUT })
  await startCard.click()
  await page.getByRole('button', { name: '실전 모드' }).click()
  await page.getByRole('button', { name: '확인' }).click()

  // 4. /interview 페이지 이동 대기
  await expect(page).toHaveURL(/\/interview\?sessionId=/, { timeout: LLM_TIMEOUT })
  await expect(page.getByText('MirAI — 패널 면접')).toBeVisible()

  // 5. 면접 완료될 때까지 답변 반복 제출
  const textarea = page.getByPlaceholder('답변을 입력하세요...')
  const submitBtn = page.getByRole('button', { name: '답변 제출' })

  for (const answer of SAMPLE_ANSWERS) {
    // textarea가 숨겨지면(sessionComplete) 루프 종료
    const isHidden = !(await textarea.isVisible())
    if (isHidden) break

    await expect(textarea).toBeEnabled({ timeout: LLM_TIMEOUT })
    await textarea.fill(answer)
    await submitBtn.click()

    // 다음 질문 수신(textarea 재활성화) 또는 면접 완료 대기
    await page.waitForFunction(
      () => {
        const ta = document.querySelector('textarea[placeholder="답변을 입력하세요..."]')
        const complete = document.body.textContent?.includes('면접이 완료되었습니다.')
        return complete || (ta !== null && !(ta as HTMLTextAreaElement).disabled)
      },
      { timeout: LLM_TIMEOUT }
    )
  }

  // 6. 면접 완료 메시지 확인
  await expect(page.locator('text=면접이 완료되었습니다.')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 7. 리포트 생성하기 클릭
  await page.getByRole('button', { name: '리포트 생성하기' }).click()
  await expect(page.getByRole('button', { name: /리포트 생성 중/ })).toBeVisible()

  // 8. /report 페이지 이동 대기 (엔진 LLM 호출 — 최대 120초)
  await expect(page).toHaveURL(/\/report\?reportId=/, { timeout: 120_000 })

  // 9. 리포트 내용 확인
  await expect(page.locator('text=종합 점수')).toBeVisible()
  await expect(page.locator('text=역량 축별 점수')).toBeVisible()
  await expect(page.locator('text=종합 요약')).toBeVisible()
  await expect(page.locator('text=축별 피드백')).toBeVisible()
  await expect(page.locator('p.text-6xl')).toBeVisible() // 총점 숫자

  // 10. 홈으로 버튼 확인
  await expect(page.getByRole('button', { name: '홈으로' })).toBeVisible()
})
