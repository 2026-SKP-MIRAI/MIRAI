# fix: [siw] observability 대시보드 로그 확인 링크 S3 prefix 오류 수정

## 목적

observability 대시보드의 "로그 확인 →" 버튼이 올바른 S3 경로로 이동하도록 수정한다.

## 배경

`ObservabilityDashboard.tsx`의 로그 확인 링크가 \`prefix=logs/\${featureType}/\` (예: \`logs/interview-start/\`)를 사용하고 있으나, 실제 \`event-logger.ts\`는 \`llm-events/YYYY/MM/DD/\` 경로에 로그를 저장한다. 결과적으로 링크를 클릭하면 존재하지 않는 S3 prefix로 이동하게 된다.

- 실제 저장 경로: \`llm-events/YYYY/MM/DD/\` (\`S3_LOG_PREFIX\` 기본값)
- 링크 prefix: \`logs/\${featureType}/\` ← 잘못됨

## 완료 기준

- [x] \`ObservabilityDashboard.tsx\` 로그 확인 링크 href의 prefix를 \`llm-events/\`로 수정
- [x] 수정 후 링크가 S3 콘솔의 \`mirai-llm-logs-siw\` 버킷 → \`llm-events/\` prefix로 올바르게 이동

## 구현 플랜

1. \`services/siw/src/app/(app)/dashboard/observability/ObservabilityDashboard.tsx:374\`
   - \`prefix=logs/\${featureType}/\` → \`prefix=llm-events/\`

## 개발 체크리스트

- [x] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 2026-03-30

**현황**: 2/2 완료

**완료된 항목**:
- `ObservabilityDashboard.tsx` 로그 확인 링크 href의 prefix를 `llm-events/`로 수정
- 수정 후 링크가 S3 콘솔의 `mirai-llm-logs-siw` 버킷 → `llm-events/` prefix로 올바르게 이동

**미완료 항목**:
- (없음)

**변경 파일**: 2개

**구현 내용**:
- `ObservabilityDashboard.tsx:374` — `prefix=logs/${featureType}/` → `prefix=llm-events/` 수정. S3 URL을 모듈 레벨 상수 `S3_LLM_EVENTS_URL`로 추출해 `.map()` 내 중복 생성 제거.
- `.ai.md` — S3 로그 링크 prefix 설계 결정 사항 추가.

