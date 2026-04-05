# Engine Changelog

> MirAI 공유 엔진 변경 이력. PDF 파싱·LLM 연동·API 라우터 등 엔진 공통 변경사항을 기록한다.

---

## 2026년 3월 23일 주차 (Mar 23~29)

### ✨ 새 기능
- **SSE 스트리밍** ([#215](../../issues/215)): 면접 답변을 실시간 스트리밍으로 제공합니다. siw 서비스에 적용되어 답변 생성 UX가 크게 개선되었습니다.
- **페르소나별 꼬리질문 System Prompt 분리 + 압박도 adaptive 조절** ([#200](../../issues/200)): HR·기술팀장·경영진 페르소나별 꼬리질문 생성 품질이 향상되었습니다.
- **꼬리질문 overlap 기반 품질 검증 + 자동 재생성** ([#199](../../issues/199)): 중복 꼬리질문을 자동 감지하고 재생성합니다.
- **합격 자소서 RAG `resume_context` 주입** ([#198](../../issues/198)): 면접 질문 생성 시 합격 자소서 유사도 검색 결과가 컨텍스트로 주입됩니다.
- **잡코리아 크롤링·pgvector·RAG Trends API 활성화** ([#163](../../issues/163)): 잡코리아 채용 데이터를 수집하고 pgvector로 저장, RAG 기반 트렌드 API가 활성화되었습니다.
- **규칙 기반 텍스트 분석 엔진 + `not_evaluated` 도입** ([#197](../../issues/197)): 평가 불가 답변을 별도 상태로 처리합니다.
- **LLM E2E 테스트 에이전트** ([#73](../../issues/73)): 자동 면접 시뮬레이션 및 점수 측정 파이프라인이 구현되었습니다.

### 🔧 개선
- **ECR + EC2 GitHub Actions 자동 배포** ([#244](../../issues/244)): 엔진 자동 배포 파이프라인 구축 완료.
- **기술팀장 페르소나 프롬프트 도메인 무관화** ([#297](../../issues/297)): `interview_tech_lead_v3`으로 특정 도메인에 종속되지 않도록 개선.
- **resume 라우터 비동기화 + OCR DPI 최적화** ([#288](../../issues/288)): 처리 성능이 향상되었습니다.
- **t3a.small 업그레이드 대응** ([#308](../../issues/308)): OCR 세마포어 상한 상향 및 DPI 하향으로 인스턴스 성능을 최대로 활용합니다.
- **CI 픽스처 버그 수정 + services CI test gate 추가** ([#263](../../issues/263)).

### 🐛 버그 수정
- **process_answer overlap 검증 연결** ([#232](../../issues/232)): `validate_followup_overlap` 적용으로 중복 꼬리질문 방지 로직이 답변 처리 흐름에 연결되었습니다.
- **`_check_followup` required_keys 완화** ([#210](../../issues/210)): followupQuestion fallback 처리 추가.

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
