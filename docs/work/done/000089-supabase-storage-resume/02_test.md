# [#89] 테스트 결과

> 최종 실행: 2026-03-16
> 환경: vitest 24 test files, 114 tests

---

## 결과 요약

| 구분 | 결과 |
|---|---|
| Test Files | 24 passed |
| Tests | 114 passed |
| TypeScript | 0 errors (pre-existing `prisma/config` 1개 제외) |
| Duration | ~4–6s |

---

## 테스트 파일 목록

### API 테스트

| 파일 | 케이스 | 상태 |
|---|---|---|
| `tests/api/resumes-route.test.ts` | POST 200/400/401, GET 200/401, GET[id] 200/401/404 (8케이스) | ✅ |
| `tests/api/resume-questions-route.test.ts` | 기존 라우트 동작 | ✅ |

### Unit 테스트

| 파일 | 케이스 | 상태 |
|---|---|---|
| `tests/unit/interview-service.test.ts` | answer 성공/실패/재시도 포함 | ✅ |

### UI 테스트

| 파일 | 케이스 | 상태 |
|---|---|---|
| `tests/ui/resumes-detail-page.test.tsx` | 이력서 상세 렌더링, 8축 역량 빈 상태 메시지 | ✅ |

---

## 주요 수정 사항 (테스트 통과를 위해)

### `tests/ui/resumes-detail-page.test.tsx`

1. **`lucide-react` mock 추가**: `Download`, `TrendingUp`, `TrendingDown`, `Lightbulb`
   - 신규 `/resumes/[id]` 페이지에서 사용하는 아이콘들이 mock에 누락되어 있었음

2. **fetch mock URL 분기 처리**:
   - `/sessions` → `[]` 반환
   - `/feedback` → `null` 반환
   - 기본 → resume 데이터 반환
   - 기존: 단일 응답으로 모든 URL에 동일한 resume 객체 반환 → feedback에서 `scores.specificity` crash

3. **테스트 설명 수정**:
   - "8축 역량 평가 준비 중 표시" → "8축 역량 평가 — 면접 없으면 빈 상태 메시지 표시"
   - 기대 텍스트: `"준비 중"` → `"이 이력서로 면접을 완료하면 역량 평가가 표시됩니다."`

---

## 검증 범위 (수동 확인 필요)

| 항목 | 방법 | 비고 |
|---|---|---|
| 면접 리포트 첫 생성 후 DB 저장 | 면접 완료 → 결과 보기 → Network 탭에서 `reportJson` 저장 확인 | 엔진 기동 필요 |
| 재조회 시 캐시 반환 | 결과 보기 2회 → 2번째는 엔진 호출 없이 즉시 응답 | 로그 확인 |
| `/resumes/[id]` 성장 요약 | 이력서 상세 → 해당 이력서로 완료된 면접 목록 표시 | 실 데이터 필요 |
| `/growth` 축별 피드백 | 성장 추이 → 없어진 "AI 개선 추천" 섹션 미표시 확인 | |
| 사이드바 접기 버튼 | 데스크탑에서 사이드바 접기 버튼 잘리지 않음 | |
| signed URL 다운로드 | `/resumes/[id]` → 내 이력서 버튼 → PDF 다운로드 | Supabase Storage 필요 |
