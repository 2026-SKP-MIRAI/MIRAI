# [siw] 서비스 pre-existing 테스트 버그 수정

## 목적

#263 PR에서 siw test job 추가 후 드러난 pre-existing 테스트 버그를 수정한다.

## 배경

\`deploy-siw.yml\`에 \`test-siw\` job이 추가되면서 기존에 숨어있던 테스트 실패가 CI에서 드러남. 구현체 변경(필드명, UI 텍스트)에 테스트가 동기화되지 않은 상태이며, mock 오염 패턴도 존재함.

## 실패 테스트 목록

| 파일 | 실패 원인 | 수정 방향 |
|------|-----------|-----------|
| \`tests/api/growth-sessions-route.test.ts\` | \`resumeLabel\` → 실제 응답은 \`resumeFileName\` | assertion을 \`resumeFileName\`으로 변경 |
| \`src/app/api/resumes/[id]/__tests__/route.test.ts\` | 첫 번째 test의 \`mockReturnValue\`가 이후 test에도 지속 (vi.clearAllMocks()로 제거 안 됨) | \`mockReturnValueOnce\` 사용 또는 beforeEach에서 \`vi.resetAllMocks()\` |
| \`tests/ui/upload-form.test.tsx\` | UI 텍스트 불일치, placeholder 불일치, mock queue 오염 | 실제 컴포넌트 텍스트에 맞게 assertion 수정, \`mockFetch.mockReset()\` 추가 |
| \`tests/ui/growth-page.test.tsx\` | mock data의 \`resumeLabel\` → 컴포넌트는 \`resumeFileName\` 사용 | mock data 필드명 수정 |
| \`tests/ui/landing-page.test.tsx\` | getByText 대상 텍스트가 컴포넌트에 없거나 중복 | 실제 컴포넌트 텍스트 확인 후 수정 |

## 완료 기준

- [x] \`cd services/siw && npm run test\` 전체 통과 (51 files, 303 tests)
- [x] 5개 테스트 파일 수정: \`growth-sessions-route.test.ts\`, \`route.test.ts\`, \`upload-form.test.tsx\`, \`growth-page.test.tsx\`, \`landing-page.test.tsx\`
- [ ] \`deploy-siw.yml\` CI test-siw job 통과 확인 (PR 머지 후 확인)

## 구현 플랜

1. 각 실패 테스트 파일별로 실제 구현체(\`route.ts\`, 컴포넌트)를 읽어 현재 API/텍스트 확인
2. assertion을 현재 구현에 맞게 수정
3. mock 오염 패턴은 \`vi.resetAllMocks()\` (beforeEach) 또는 \`mockReturnValueOnce\`로 교체
4. \`npm run test\` 로컬 통과 확인 후 PR

## 개발 체크리스트

- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-27

**현황**: 2/3 완료 (CI 확인만 남음)

**완료된 항목**:
- [x] `cd services/siw && npm run test` 전체 통과 — 51 files, 303 tests
- [x] 5개 + 3개 테스트 파일 수정 완료

**미완료 항목**:
- [ ] `deploy-siw.yml` CI test-siw job 통과 확인 (PR 머지 후)

**변경 파일**: 8개 (구현 코드 0개, 테스트 파일만)

**이슈 스코프 5개 파일:**
- `tests/api/growth-sessions-route.test.ts`: mock `resumeText`→`resume: { fileName, inferredTargetRole }`, assertion `resumeLabel`→`resumeFileName`, truncation assertion 제거
- `src/app/api/resumes/[id]/__tests__/route.test.ts`: `beforeEach`에 `createServerClient` 인증 mock 복원 추가 (`vi.clearAllMocks()`로 초기화되던 문제 해결)
- `tests/ui/upload-form.test.tsx`: `"지원 직무가 확인됐어요"`→`"지원 직무 확인"`, `"지원 직무를 입력하세요"`→`"직무 미지정"`
- `tests/ui/growth-page.test.tsx`: mock `resumeLabel`→`resumeFileName`
- `tests/ui/landing-page.test.tsx`: `import React from "react"` 추가, `getAllByText()[0].toBeInTheDocument()` 패턴으로 수정

**추가 수정 3개 파일 (전체 CI 통과를 위해):**
- `tests/setup.ts`: `process.env.ENGINE_BASE_URL = "http://localhost:3001"` 전역 설정 추가 (`vi.unstubAllEnvs()` 영향 없음)
- `src/app/api/resumes/__tests__/route.test.ts`: `vi.mock`에 `getEngineBaseUrl` 추가, 이중 `vi.stubEnv` 제거
- `tests/api/resumes-route.test.ts`: `vi.doMock` `embedding-client`에 `getEngineBaseUrl` 추가

**기술적 결정:**
- `resumeLabel` vs `resumeFileName` 방향 선택: 구현체(`types.ts`, `route.ts`, UI)가 `resumeFileName`을 사용 중이므로 테스트를 구현에 동기화. `resumeLabel` truncation은 별도 UX 이슈로 분리.

