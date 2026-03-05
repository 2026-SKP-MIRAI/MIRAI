# [#19] 프로젝트 플랜 리뷰 — 전문가 에이전트 5명 종합

> 작성: 2026-03-05
> 대상 문서: `docs/whitepaper/mirai_project_plan.md`

---

## 투입 전문가

| 역할 | 리뷰 관점 |
|------|-----------|
| PM | 일정 현실성, 성공 기준, 빠진 항목 |
| 아키텍트 | Next.js+FastAPI 구조, 인증 공유, 배포 토폴로지 |
| 테스트 엔지니어 | TDD 실현성, 계약 테스트, E2E 타이밍 |
| 품질/인프라 | AWS 배포 현실성, 비용, 운영 전략 |
| 크리틱 | 모순, 약점, 비현실적 부분 |

---

## 공통 지적 (3명 이상 동의)

| # | 문제 | 지적한 전문가 |
|---|------|-------------|
| 1 | ~~**Week 1 범위 과적** — 기획+세팅+MVP+AWS배포 7일은 비현실적~~ | PM, 크리틱, 인프라, 아키텍트 |

-> 기각. 멘토가 인프라·세팅 선행하고 멘티는 기능에 집중하는 구조로 실행한다.
| 2 | ~~**DB 전략 없음** — Better Auth도 DB 필요, 서비스도 DB 필요한데 언급 없음~~ | 인프라, 아키텍트, 크리틱 |

-> 해결. PostgreSQL + Prisma 채택. 플랜 문서 기술 스택에 반영 완료.
| 3 | ~~**엔진-서비스 통신 방식 미정의** — HTTP REST? base URL? 타임아웃?~~ | 아키텍트, 크리틱, 테스트 |

-> 해결. HTTP REST 채택. `ENGINE_BASE_URL` 환경변수, 타임아웃 30초, 에러는 FastAPI→JSON→Next.js 변환. ADR 별도 작성 예정.
| 4 | ~~**인증 공유 메커니즘 없음** — Better Auth(Next.js)와 FastAPI 간 인증 검증 방법~~ | 아키텍트, 크리틱, 인프라 |

-> 해결. 서비스 게이트웨이 패턴 채택. Next.js가 인증 처리 후 FastAPI에 내부 HTTP 호출. 엔진은 인증 로직 없음. MVP는 localhost, Docker 환경은 `http://engine:8000`.
| 5 | ~~**Week 2 스트레스 테스트 과함** — 기능도 안 끝난 시점에 성능 측정 무의미~~ | 테스트, 인프라, PM |

-> 기각. Week 2에 Beta 완성 후 스트레스 테스트 진행한다.
| 6 | **PDF 파싱 언어 모순** — 기존 spec에 `pdf-parse`(Node.js)인데 엔진은 FastAPI(Python) | 아키텍트 |

-> 수용. spec의 `pdf-parse`(Node.js)를 Python 라이브러리(PyMuPDF/pdfplumber)로 변경. spec 문서 업데이트 필요.

---

## 즉시 조치 필요

| 조치 | 내용 |
|------|------|
| **DB 결정** | PostgreSQL(RDS) or SQLite — Week 1에 확정 필수 |
| **엔진 통신 ADR** | HTTP REST, `ENGINE_BASE_URL`, 타임아웃, 에러 전파 |
| **인증 아키텍처** | 서비스 게이트웨이 패턴 (Next.js가 인증, FastAPI는 내부 호출만 수신) |
| **PDF 파서 언어** | spec의 `pdf-parse`(Node.js) → Python 라이브러리(PyMuPDF/pdfplumber)로 변경 |
| **스트레스 테스트** | Week 2 → Week 3/4로 이동 |
| **성공 기준 구체화** | "피드백"의 정의, 측정 방법, 모집 채널 명시 |

---

## 플랜 문서 추가 권장 항목

| 항목 | 현재 | 권장 |
|------|------|------|
| 기술 스택 상세 | Week 1에 한 줄 | DB, 테스트 프레임워크(Vitest), ORM(Prisma) 포함 |
| Week 1 배포 기준 | "배포 URL 접속 가능" | "로컬 핵심 흐름 작동 + 배포 환경 구성"으로 완화 가능 |
| 엔진 API 계약 확정 시점 | 없음 | Week 1 중반(Day 3~4) |
| docker-compose | 없음 | umbrella 루트에 표준 템플릿 |
| 환경변수 관리 | 없음 | `.env` 전략 또는 AWS Secrets Manager |
| 비용 추정 | 없음 | 월 ~$105 (인프라 리뷰 기준) |

---

## 전문가별 상세 리뷰

### PM

**일정 현실성:**
- Week 1에 기획+세팅+MVP+배포는 직렬 의존이 있다 (배포→MVP→엔진 구현)
- 멘토가 Day 1~2에 AWS+레포를 선행 완료해야 멘티가 기능에 집중 가능
- 기획 확정 일자를 Day 2로 고정 필요

**성공 기준:**
- "10명 피드백"은 숫자는 적절하나 정의 불충분
- 피드백 = 서비스 접속 + 자소서 업로드 + 결과 수신 + 폼 제출
- 서비스별 최소 2명 이상 권장, NPS 1문항 + 유용 기능 1문항 + 자유 의견

**빠진 항목:**
- 주간 회고 일정
- 엔진 API 계약 확정 시점
- 개발 환경 LLM API 비용 상한 (예: $50/월)
- submodule 업데이트 워크플로우

---

### 아키텍트

**구조 장점:**
- 불변식이 물리적 경계(별도 서버)로 자연스럽게 강제됨
- 1인 1서비스 철학에 Next.js 풀스택이 적합

**핵심 누락:**
1. 엔진-서비스 통신 프로토콜 (HTTP REST, base URL, 타임아웃) — **즉시 결정**
2. PDF 파싱 언어 모순 (spec은 Node.js `pdf-parse`, 엔진은 Python) — **즉시 해소**
3. DB 선택 (Better Auth에 DB 필요) — Week 1 내
4. ALB 라우팅 전략 (서브도메인 vs 경로) — Week 1 내
5. Dockerfile 표준 + docker-compose — Week 1 내
6. 엔진 인증 (내부 호출 신뢰 방식) — Week 2 전
7. API 버전 관리 — Week 2 전

**인증 공유 권장 패턴:**
```
[사용자] → [Next.js (Better Auth 인증)] → [FastAPI 엔진 (내부 호출만)]
```
- FastAPI는 외부 직접 접근 차단 (ALB internal / private subnet)
- 필요 시 `X-Service-Token` 헤더로 내부 인증

**배포 토폴로지 권장:**
```
Route53 → ALB (WAF)
  ├── siw.mirai.*   → EC2 (Next.js :3001)
  ├── kwan.mirai.*  → EC2 (Next.js :3002)
  ├── lww.mirai.*   → EC2 (Next.js :3003)
  ├── seung.mirai.* → EC2 (Next.js :3004)
  └── api.mirai.*   → EC2 (FastAPI :8000)
```

---

### 테스트 엔지니어

**불변식 4번 "테스트 없는 PR 머지 금지" 구멍:**
- `check_invariants.py`는 불변식 1·2(LLM/PDF 경계)만 검사
- 불변식 4(테스트 존재 여부)는 실제로 검사하지 않음 → 보완 필요

**FastAPI 테스트 전략:**
- `parsers/`: PDF 파서 단위 테스트 (픽스처 PDF)
- `services/`: LLM mock 필수 (`pytest-mock`), 실제 API 호출 CI에서 차단
- `pytest -m "not integration"` 규칙 필요

**Next.js 테스트 전략 (미정의 — 확정 필요):**
- 단위/컴포넌트: Vitest + React Testing Library
- Better Auth 인증 흐름: 미들웨어 레벨 모킹 전략 필요

**계약 테스트:**
- Pact는 과함
- 엔진 응답 스키마 검증 테스트 1개 + Pydantic 모델 고정으로 충분

**E2E/스트레스:**
- E2E: Playwright로 핵심 흐름 1개만 자동화 → Week 2 가능
- 스트레스: Week 3/4로 이동 권장

---

### 품질/인프라

**비용 추정 (서울 리전, 월 기준):**

| 항목 | 월 비용 (USD) |
|------|---------------|
| EC2 t3.large | ~$67 |
| ALB | ~$18~25 |
| Route53 | ~$1~2 |
| WAF | ~$10 |
| CloudFront | ~$1~5 |
| S3 + ECR | ~$2 |
| **합계** | **~$105~115** |

4주 실제 비용: **$35~45**

**운영 구조 권장:**
```
EC2 (t3.large, 8GB RAM)
├── nginx (리버스 프록시)
├── FastAPI :8000
├── Next.js :3001~3004
└── Docker Compose로 전체 관리
```
t3.medium(4GB)은 Next.js 4개 동시 빌드 시 OOM 위험 → t3.large 이상 권장

**빠진 인프라 항목:**
- 환경변수 관리 (API 키, DB 비밀번호)
- 로그 수집 (CloudWatch Logs)
- DB 전략 (RDS? SQLite?)
- 백업/스냅샷
- 알람/모니터링
- 롤백 전략
- LLM API 비용 한도
- CORS 정책 (Next.js → FastAPI)

---

### 크리틱

**[REJECT] 판정 — 구조적 모순 다수**

1. **불변식 명명 혼란**: "engine/services/"와 umbrella의 "services/"가 혼동됨
2. **엔진 공동 개발 병목**: 4명이 동시 수정 → merge conflict 일상화, 리뷰 병목
3. **Week 1 물리적 불가능**: AWS 초보 멘티 기준 ALB+Route53+WAF+HTTPS만 2~3일
4. **Week 2 과적**: CI/CD + Docker + E2E + 스트레스 + 전체 기능 = 1주 불가
5. **DDD를 멘티에게 요구**: 경험 많은 개발자도 어려운데 4주에 DDD+TDD 동시 요구
6. **멘티 할당표 없음**: "누가 무엇을 언제까지"가 없으면 계획이 아니라 희망사항
7. **Week 1 배포 → Week 2 Docker 전환 비용**: 배포 방식이 바뀌는데 전환 비용 미반영

**핵심 개선 요구:**
1. Week 1 범위 절반으로 축소
2. 엔진 API 변경 관리 프로세스 명시
3. 인증 아키텍처 Week 1에 확정
4. 성공 기준에 품질 지표 추가
5. 멘티별 Week 1 할당표 작성
