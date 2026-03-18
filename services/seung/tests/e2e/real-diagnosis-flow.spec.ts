import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * 실제 엔진 + 실제 Supabase를 사용하는 서류 강점·약점 진단 전체 플로우 E2E 테스트.
 * 실행 전 필수:
 *   - 엔진 서버: http://localhost:8000 실행 중
 *   - services/seung: .env.local에 DATABASE_URL, ENGINE_BASE_URL 설정
 *   - PDF fixture: engine/tests/fixtures/input/sample_resume.pdf
 */

const PDF_PATH = path.join(
  __dirname,
  '../../../../engine/tests/fixtures/input/sample_resume.pdf'
)

const LLM_TIMEOUT = 90_000

test('이슈 #127: 자소서 업로드 → 서류 진단받기 → 5개 항목 점수·강점·약점·개선 방향 확인', async ({ page }) => {
  test.setTimeout(300_000) // 실제 LLM 호출 2회 포함 — 최대 5분

  // 1. /resume 페이지 접속
  await page.goto('/')
  await expect(page.getByText('자소서 분석')).toBeVisible()

  // 2. 실제 PDF 업로드
  await page.getByLabel('PDF 파일').setInputFiles(PDF_PATH)
  await page.getByRole('button', { name: '질문 생성' }).click()

  // 3. 질문 생성 완료 대기 (LLM 호출)
  await expect(page.getByText('예상 면접 질문')).toBeVisible({ timeout: LLM_TIMEOUT })

  // 4. 다음 단계 선택 카드 확인 (resumeId 반환 후 렌더링)
  await expect(page.getByText('다음 단계를 선택하세요')).toBeVisible({ timeout: LLM_TIMEOUT })
  await expect(page.getByRole('button', { name: /면접 시작하기/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /서류 진단받기/ })).toBeVisible()

  // 5. "서류 진단받기" 카드 클릭 → 세부 UI 확장
  await page.getByRole('button', { name: /서류 진단받기/ }).click()
  await expect(page.getByPlaceholder('예: 백엔드 개발자')).toBeVisible()
  await expect(page.getByRole('button', { name: '진단하기' })).toBeDisabled()

  // 6. 지원 직무 입력 → 진단하기 버튼 활성화
  await page.getByPlaceholder('예: 백엔드 개발자').fill('백엔드 개발자')
  await expect(page.getByRole('button', { name: '진단하기' })).toBeEnabled()

  // 7. 진단하기 클릭 (엔진 LLM 호출)
  await page.getByRole('button', { name: '진단하기' }).click()

  // 8. /diagnosis 페이지로 이동 대기
  await expect(page).toHaveURL(/\/diagnosis\?resumeId=/, { timeout: LLM_TIMEOUT })
  await expect(page.getByText('MirAI — 서류 강점·약점 진단')).toBeVisible()

  // 9. 5개 항목 점수 확인
  await expect(page.getByText('항목별 점수')).toBeVisible()
  await expect(page.getByText('서술의 구체성', { exact: true })).toBeVisible()
  await expect(page.getByText('성과 수치 명확성', { exact: true })).toBeVisible()
  await expect(page.getByText('논리 구조', { exact: true })).toBeVisible()
  await expect(page.getByText('직무 적합성', { exact: true })).toBeVisible()
  await expect(page.getByText('차별성', { exact: true })).toBeVisible()

  // 10. 강점·약점·개선 방향 섹션 확인
  await expect(page.getByText('강점', { exact: true })).toBeVisible()
  await expect(page.getByText('약점', { exact: true })).toBeVisible()
  await expect(page.getByText('개선 방향', { exact: true })).toBeVisible()

  // 11. "홈으로" 버튼 클릭 → /resume 이동
  await page.getByRole('button', { name: '홈으로' }).click()
  await expect(page).toHaveURL(/\/resume/)
})
