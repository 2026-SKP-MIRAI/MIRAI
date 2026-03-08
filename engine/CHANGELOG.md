# Engine Changelog

> MirAI 공유 엔진 변경 이력. PDF 파싱·LLM 연동·API 라우터 등 엔진 공통 변경사항을 기록한다.

---

## 2026년 3월 9일 주차 (Mar 9~)

### 🔧 개선
- **경로별 CHANGELOG.md 체계 도입**: 엔진·서비스별 독립 변경 이력 관리 체계가 마련되었습니다. `/update-changelog` 커맨드로 자동 업데이트할 수 있습니다.

---

## 2026년 3월 2일 주차 (Mar 2~8)

### ✨ 새 기능
- **PDF → 면접 질문 파이프라인 구현** ([#33](../../issues/33)): PDF 파싱 후 LLM으로 면접 질문을 생성하는 엔드포인트(`POST /generate`) 추가

### 🔧 개선
- **app/ 계층 도입** ([#23](../../issues/23)): `router / services / parsers / config`로 모듈 분리. 기존 모노리식 구조에서 계층형 아키텍처로 전환
- **LLM 공급자 전환**: Anthropic SDK → OpenRouter + Gemini 2.5 Flash. 설정은 `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` 환경변수로 관리
- **pydantic-settings 통합**: `config.py`에서 `Settings` 객체로 환경변수를 일괄 관리, `llm_service`가 `os.environ` 직접 참조 제거

### 🛡️ 보안 / 품질
- **pre-commit 가드 추가**: TypeScript LLM 직접 호출, 엔진 인증 로직 혼입, 금지 파일(`.pdf`, `.csv`) 커밋을 커밋 시점에 자동 차단
- **TDD 테스트 픽스처 준비** ([#28](../../issues/28)): 엔진 예외 계약 및 스펙 정비, 테스트 기반 개발 환경 구축
