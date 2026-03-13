# MirAI

> **자소서를 올리면, AI가 나만의 면접관이 된다**
>
> MIRROR + AI — 맞춤형 AI 면접 코치. 누구에게나 공정한 면접 준비 기회를.

---

## 서비스 소개

MirAI는 취준생이 자기소개서 PDF를 업로드하는 것만으로 실전과 유사한 맞춤형 면접 질문을 즉시 받을 수 있는 AI 기반 면접 코칭 서비스입니다.

국내 기업의 92.1%가 면접으로 채용을 결정하지만, 구직자의 1년 평균 면접 경험은 고작 2회에 불과합니다. MirAI는 300~500만 원짜리 면접 컨설팅을 월 19,900원으로 대체합니다.

### 핵심 기능 로드맵

| 단계 | 기능 | 상태 |
|------|------|------|
| **MVP** | 자소서 기반 맞춤 예상 질문 생성 (카테고리별) | ✅ 구현 완료 |
| Phase 1 | 3인 패널 면접 + 실시간 꼬리질문 엔진 | 🔜 |
| Phase 2 | 8축 역량 평가 리포트 | 🔜 |
| Phase 3 | 연습 모드 + 서류 강점·약점 진단 | 🔜 |
| Phase 4 | AI 아바타 면접 (TTS/STT) | 🔜 |

---

## 레포 구조

공통 엔진 위에 개인 서비스가 올라가는 모노레포 구조입니다.

```
mirai/
├── engine/               # FastAPI (Python) — 전원 공동 설계
│   ├── app/
│   │   ├── parsers/      # PDF → 텍스트 추출 (PyMuPDF)
│   │   ├── services/     # LLM API 호출 (Claude via OpenRouter)
│   │   ├── prompts/      # 프롬프트 템플릿
│   │   └── routers/      # POST /api/resume/questions
│   └── tests/            # pytest (TDD)
│
├── services/             # Next.js 풀스택 (TypeScript) — 1인 1서비스
│   ├── lww/              # 이왕원
│   ├── kwan/             # 김관우
│   ├── seung/            # 이승현
│   └── siw/              # 성시우
│
└── docs/
    ├── whitepaper/       # 기획서·운영 계획
    ├── specs/            # 기능 명세 + AC
    └── work/             # 이슈별 작업 내역
```

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| **엔진** | Python 3.12+, FastAPI, PyMuPDF, OpenRouter (Claude), pytest |
| **서비스** | Next.js (App Router), TypeScript, Tailwind CSS v4, Vitest |
| **인프라** | AWS EC2 · ALB · Route53 · WAF · CloudFront · S3 |
| **CI/CD** | GitHub Actions, Docker, ECR |

---

## 아키텍처

```
[사용자]
    ↓
[Next.js 서비스] — Better Auth 인증
    ↓ HTTP REST (ENGINE_BASE_URL, 30s timeout)
[FastAPI 엔진] — PDF 파싱 → LLM 질문 생성 → JSON 응답
```

### 불변식 (위반 시 CI 차단)

```
1. 인증은 서비스(Next.js)에서만 — 엔진은 내부 호출만 수신
2. 외부 AI API 호출은 엔진에서만 — 서비스가 직접 LLM 호출 금지
3. 서비스 간 직접 통신 금지 — 공유 로직은 엔진으로
4. DB는 서비스가 소유 — 엔진은 stateless
5. 테스트 없는 PR 머지 금지
```

---

## 시작하기

### 엔진

```bash
cd engine
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 환경변수 설정
cp .env.example .env
# OPENROUTER_API_KEY, CLAUDE_MODEL 입력

# 실행 (로컬)
uvicorn app.main:app --reload

# 실행 (EC2 배포 — 외부 접근 허용)
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 테스트
pytest
```

### 서비스 (lww 예시)

```bash
cd services/lww
npm install

# 환경변수 설정
cp .env.local.example .env.local
# 로컬: ENGINE_BASE_URL=http://localhost:8000
# EC2 배포: ENGINE_BASE_URL=https://engine.mirainterview.com

# 실행
npm run dev

# 테스트
npm test
```

---

## 개발 워크플로우

```bash
# 이슈 시작
/si <이슈번호>

# 작업 완료 후 PR 생성
/fi <이슈번호>

# PR 머지 후 정리
/ci <이슈번호>
```

자세한 워크플로우는 [`docs/onboarding/`](docs/onboarding/) 참고.

---

## 팀

| 역할 | 이름 | 서비스 |
|------|------|--------|
| 멘토 | 이왕원 | `services/lww` |
| 멘티 | 김관우 | `services/kwan` |
| 멘티 | 이승현 | `services/seung` |
| 멘티 | 성시우 | `services/siw` |

**프로젝트 기간:** 2026년 3월 1일 ~ 3월 28일 (4주)
**목표:** 실제 유저 10명 이상이 서비스를 사용하고 피드백을 남긴다.
