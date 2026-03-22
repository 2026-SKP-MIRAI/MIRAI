# Engine Changelog

> MirAI 공유 엔진 변경 이력. PDF 파싱·LLM 연동·API 라우터 등 엔진 공통 변경사항을 기록한다.

---

## 2026년 3월 16일 주차 (Mar 16~22)

### ✨ 새 기능
- **이력서·자소서 피드백 엔진 구현** ([#90](../../issues/90)): `POST /api/resume/feedback` 엔드포인트 추가. 자소서 강점·약점 진단 및 맞춤 피드백을 LLM으로 생성합니다.
- **`/parse` 신규 엔드포인트 + `/questions` JSON 수신 전환** ([#118](../../issues/118)): PDF 파싱 기능을 엔진으로 통합하고 서비스별 이중 파싱을 제거했습니다.
- **이미지 PDF OCR 구현** ([#71](../../issues/71)): Dockerfile에 Tesseract 설치, 스캔 PDF에서 텍스트 추출이 가능해졌습니다.
- **`targetRole` 자동 추출** ([#113](../../issues/113)): `/analyze`·`/target-role` 신규 엔드포인트 추가, `/questions`에 targetRole 주입, `/feedback` optional 처리.
- **프롬프트 엔지니어링 고도화 v2** ([#53](../../issues/53)): HR·기술팀장·경영진 페르소나가 개선되어 면접 질문 품질이 향상되었습니다.
- **usage 메타데이터 추가** ([#96](../../issues/96)): 모든 엔진 응답에 token 사용량 정보가 포함되어 비용 추적이 가능해졌습니다.
- **embed API + trendComparison 뼈대** ([#97](../../issues/97)): LLM 옵저버빌리티 Pipeline 2-1 연동, inferredTargetRole 기반 트렌드 비교 분석 기반 구축.

### 🐛 버그 수정
- **interview 프롬프트 500 에러 수정** ([#188](../../issues/188)): Step 3 질문 분포 비율 지시문 제거로 간헐적 500 에러가 해결되었습니다.
- **practice feedback scoreDelta 서버 계산으로 교체** ([#102](../../issues/102)): 클라이언트가 아닌 서버에서 점수 변화를 계산하도록 변경해 무결성이 강화되었습니다.

---

## 2026년 3월 9일 주차 (Mar 9~15)

### ✨ 새 기능
- **8축 역량 평가 리포트 엔진 구현** ([#54](../../issues/54), [#70](../../issues/70)): `POST /api/report/generate` 엔드포인트 추가. 면접 세션 데이터를 기반으로 8가지 역량 축에 대한 평가 리포트를 LLM으로 생성합니다.
- **연습 모드 즉각 피드백 엔진 구현** ([#78](../../issues/78), [#83](../../issues/83)): `POST /api/practice/feedback` 엔드포인트 추가. 연습 답변 제출 시 실시간으로 피드백을 반환합니다.

### 🔧 개선
- **경로별 CHANGELOG.md 체계 도입**: 엔진·서비스별 독립 변경 이력 관리 체계가 마련되었습니다. `/update-changelog` 커맨드로 자동 업데이트할 수 있습니다.
- **`call_llm` max_tokens 기본값 상향** ([#59](../../issues/59), [#75](../../issues/75)): 1024 → 2048로 조정해 긴 응답 잘림 현상을 해결했습니다.

### 🛡️ 인프라 / 배포
- **Docker 컨테이너화** ([#66](../../issues/66)): Dockerfile 및 docker-compose 설정 추가. EC2 환경에서 컨테이너 기반 배포가 가능해졌습니다.
- **EC2/ALB 배포 대응** ([#64](../../issues/64)): EC2 인스턴스 대상 인프라 초기 설정 및 `ENGINE_BASE_URL` 환경변수 배포 문서화 완료.

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
