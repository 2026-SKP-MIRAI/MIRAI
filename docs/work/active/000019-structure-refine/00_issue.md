# chore: 프로젝트 구조 재정의 — INTERFACE.md→.ai.md 통합 및 TDD 테스트 구조 수립

## 목적
INTERFACE.md를 .ai.md 체계로 통합하고, TDD 테스트 디렉토리 구조를 확립하여 엔진팀/서비스팀이 독립 개발할 수 있는 기반을 만든다.

## 배경
- 프로젝트 규칙: "모든 디렉토리에 .ai.md 포함 — 목적·구조·역할 기술"
- `engine/docs/INTERFACE.md`가 별도 파일로 존재하여 .ai.md 체계와 중복/불일치 발생
- TDD 필수(불변식 4번)이나 테스트 디렉토리 구조·테스트 러너·fixture/mock 전략이 미정의
- 엔진-서비스 간 계약 테스트(contract test)가 없어 독립 개발 시 호환성 보장 불가

## 완료 기준
- [ ] INTERFACE.md 내용을 engine/.ai.md, engine/parsers/.ai.md, engine/services/.ai.md로 분산 통합
- [ ] engine/docs/INTERFACE.md 삭제 (또는 .ai.md로 리다이렉트)
- [ ] INTERFACE.md를 참조하는 모든 문서(20곳) 경로 업데이트
- [ ] vitest 설정 (vitest.config.ts, package.json scripts)
- [ ] engine/docs/TEST_STRATEGY.md 작성 (테스트 피라미드, fixture 전략, mock 전략)
- [ ] tests/contract/ 계약 테스트 구조 생성
- [ ] engine 모듈별 __tests__/ 디렉토리 구조 생성

## 구현 플랜

### 1. INTERFACE.md → .ai.md 통합
- engine/.ai.md: 불변식 + 전체 타입 정의 + import 경로
- engine/parsers/.ai.md: parseResumePDF 시그니처·에러·사용 예시
- engine/services/.ai.md: generateInterviewQuestions 시그니처·에러·사용 예시
- engine/docs/.ai.md: 역할 변경 (설계 문서 → 전략 문서 보관소)

### 2. 참조 경로 업데이트 (20곳)
- CLAUDE.md, AGENTS.md
- services/{siw,kwan,dong,seung}/.ai.md (4곳)
- .claude/commands/start-issue.md
- .claude/agents/{code-architecture-reviewer,plan-reviewer,documentation-architect}.md (3곳)
- .claude/agents/.ai.md
- engine/.ai.md, engine/docs/.ai.md, engine/parsers/.ai.md, engine/services/.ai.md

### 3. TDD 테스트 구조 수립
- vitest.config.ts + package.json scripts (test, test:watch, test:coverage, test:contract)
- engine/parsers/pdf_parser/__tests__/ (unit + integration)
- engine/services/llm_service/__tests__/ (unit + integration)
- engine/services/llm_service/__mocks__/anthropic.ts
- tests/contract/engine_parsers.contract.test.ts
- tests/contract/engine_services.contract.test.ts

### 4. TEST_STRATEGY.md 작성
- 테스트 피라미드 (unit 70 / integration 20 / contract 10)
- fixture 전략 (프로그래매틱 생성, .pdf 커밋 금지)
- Anthropic SDK mock 사용법
- 서비스팀 engine mock 패턴
- 통합 테스트 분기 (INTEGRATION=true)

### 작업 순서
1→2→3→4 순차 (참조 업데이트는 통합 직후)

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

