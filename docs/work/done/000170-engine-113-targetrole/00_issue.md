# [seung] 엔진 #113 연동 — targetRole 자동 감지 및 직무 맞춤 질문 생성

## 사용자 관점 목표
PDF 업로드만 하면 직무가 자동 감지되어, 별도 입력 없이 내 직무에 맞는 면접 질문을 받을 수 있다.

## 배경
작업 범위: services/seung (Next.js)

엔진 #113에서 /api/resume/analyze(PDF → {resumeText, extractedLength, targetRole} 자동 감지)가 추가됐지만, seung은 여전히 /api/resume/parse(텍스트 추출만) + targetRole 없이 /api/resume/questions를 호출 중. 결과적으로 직무 무관 질문이 생성됨.

## 완료 기준
- [x] engine-client.ts: callEngineAnalyze 추가 (timeout 40s), callEngineQuestions에 targetRole?: string 파라미터 추가, 미사용 callEngineParse 제거
- [x] questions/route.ts: callEngineParse → callEngineAnalyze 교체, targetRole 추출, "미지정" 또는 필드 누락 시 questions 호출에서 생략, 정상 값이면 callEngineQuestions에 전달
- [x] questions.test.ts: mockCallEngineParse → mockCallEngineAnalyze 전환, targetRole 케이스 추가 (정상 역할 전달 / "미지정" 시 omit)

## 구현 플랜
1. engine-client.ts — callEngineAnalyze 추가, callEngineQuestions 시그니처 업데이트, callEngineParse 제거
2. questions/route.ts — analyze 호출로 교체 + targetRole 흐름 추가
3. questions.test.ts — parse mock → analyze mock 전환 + targetRole 케이스 추가

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음


---

## 작업 내역

- `services/seung/src/lib/engine-client.ts`: `callEngineParse` 삭제, `callEngineAnalyze` 추가 (POST `/api/resume/analyze`, timeout 40s), `callEngineQuestions`에 `targetRole?: string` 파라미터 추가 (spread 패턴으로 undefined 키 제거)
- `services/seung/src/app/api/resume/questions/route.ts`: `callEngineAnalyze` 호출로 교체, `targetRole` 추출 로직 추가 (`"미지정"` / 누락 → `undefined`), `callEngineQuestions(resumeText, targetRole)` 전달, `maxDuration 70 → 80`
- `services/seung/tests/api/questions.test.ts`: `mockCallEngineParse` → `mockCallEngineAnalyze` 전환, 기본 mock에 `targetRole` 추가, 신규 3개 테스트 추가 (targetRole 정상값 전달 / "미지정" 생략 / 필드 누락 생략)
- `services/seung/.ai.md`: `engine-client.ts` 설명 최신화, Phase 5 항목 추가
- Vitest: 14파일 125개 전체 통과 (questions.test.ts 16→19개, 신규 3개 포함)

