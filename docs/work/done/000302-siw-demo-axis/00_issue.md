# feat: [siw] 데모 모드 전면 디벨롭

## 목적

데모 모드의 평가 리포트·UX·질문 품질을 전반적으로 개선한다.
- 페르소나-평가축 불일치 수정 (기술팀장 → 상위 3축 동적 표시)
- 모바일 반응형 미구현으로 인한 레이아웃 깨짐 수정
- 회원가입 불필요한 "*필수" 텍스트 제거
- tech_lead 페르소나 질문이 비개발 직군에도 소프트웨어 질문을 던지는 버그 수정

## 배경

- 데모 모드 `personas: ["tech_lead"]` 하드코딩
- 기존 8축 고정 표시 → 페르소나와 무관한 cultureFit·sincerity·leadership 포함
- `demo/page.tsx` 반응형 breakpoint 2개뿐 → 모바일에서 결과 섹션 깨짐
- `interview_tech_lead_v3.md` few-shot 예시가 소프트웨어 편향 → 바리스타 등 비개발 직군에 개발 질문 생성

## 완료 기준

- [x] 데모 모드 리포트에서 상위 3개 점수 축만 동적으로 표시
- [x] AbortController로 페이지 이탈 시 in-flight fetch 취소
- [x] evaluate.test.ts mock axisFeedbacks 8개로 확장 (엔진 계약 준수)
- [x] demo/.ai.md 최신화
- [x] 모바일(390px~) 화면에서 결과 섹션 정상 표시 (1컬럼 스택, 점수 우선)
- [x] 레이더 차트 overflow 없음, 점수 폰트 모바일 대응
- [x] 회원가입 "*필수" 텍스트 제거 (기능 유지)
- [x] tech_lead 페르소나 질문이 직무 도메인에 맞게 생성 (비개발 직군 포함)

---

## 작업 내역

### 2026-03-27

**현황**: 8/8 완료

**완료된 항목**:
- `demo/page.tsx`: DEMO_AXES 고정 → `topAxes` useMemo (상위 3축 동적 계산)
- `demo/page.tsx`: AbortController + useEffect cleanup (unmount 시 fetch 취소)
- `demo/page.tsx`: 모바일 반응형 — grid-cols-1 md:grid-cols-2, 점수 폰트 반응형, 레이더 overflow 방지, order-last
- `evaluate.test.ts`: mock axisFeedbacks 3→8개, toHaveLength(8)
- `demo/.ai.md`: tech_lead 페르소나 + topAxes 동적 축 정보 추가
- `(auth)/signup/page.tsx`: 이용약관·개인정보 체크박스 "*필수" span 제거
- `engine/app/prompts/interview_tech_lead_v3.md`: few-shot 예시 도메인 중립화

**변경 파일**: 5개
- `services/siw/src/app/(landing)/demo/page.tsx`
- `services/siw/src/app/(landing)/demo/.ai.md`
- `services/siw/src/app/api/demo/__tests__/evaluate.test.ts`
- `services/siw/src/app/(auth)/signup/page.tsx`
- `engine/app/prompts/interview_tech_lead_v3.md`
