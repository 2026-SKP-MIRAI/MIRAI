# feat: [siw] 비로그인 데모 면접 체험 — 아하 모먼트 → 가입 전환

## 사용자 관점 목표
가입 전에 MirAI의 핵심 가치(AI 면접 피드백 + 8축 역량 분석)를 직접 체험하고, 자연스럽게 회원가입으로 이어진다.

## 배경
첫 사용자의 아하 모먼트를 위해, 가입 없이도 면접 1문 체험 → 피드백 + 8축 분석까지 제공한다.
체험 후 "전체 면접 시작하기" CTA로 자연스러운 가입 전환을 유도한다.

### 플로우
```
[랜딩] → [/demo] 직무 선택
  → 샘플 질문 1개 출제
  → 답변 입력
  → AI 피드백 + 8축 분석 결과 즉시 표시
  → "전체 면접 시작하기" CTA → [회원가입]
```

### 핵심 설계 (확정)

| 항목 | 설명 |
|------|------|
| **인증** | 불필요 — `/demo`는 미들웨어 matcher 밖 |
| **엔진 호출** | 질문 생성 1회 + 답변 피드백 1회 + 8축 평가 1회 (기존 API 재사용) |
| **결과 저장** | 없음 — 1문 체험이므로 저장 불필요, 단순 체험 후 가입 유도 |
| **가입 전환** | 결과 화면 "전체 면접 시작하기" → `/signup` |
| **Rate limit** | IP 기반 하루 3회 (Prisma `DemoUsage` 테이블, SHA-256 해싱) |

## 완료 기준
- [x] 비로그인 사용자가 `/demo`에서 직무 선택 → 질문 1개 답변 → 피드백 + 8축 분석 결과 확인 가능
- [x] 결과 화면에서 "전체 면접 시작하기" → `/signup` CTA
- [x] IP 기반 rate limit 적용 (하루 3회)
- [x] 미들웨어 변경 없음 (기존 인증 플로우 영향 없음)
- [x] 랜딩 Hero 버튼: 비로그인 시 "데모로 체험하기(`/demo`)", 로그인 시 "대시보드 보기(`/dashboard`)"

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `services/siw/prisma/schema.prisma` | `DemoUsage` 모델 추가 (rate limit) |
| `services/siw/src/app/api/demo/question/route.ts` | 신규 — 질문 생성 + rate limit (maxDuration=30) |
| `services/siw/src/app/api/demo/feedback/route.ts` | 신규 — 피드백 프록시 (maxDuration=60) |
| `services/siw/src/app/api/demo/evaluate/route.ts` | 신규 — 8축 평가 프록시 (maxDuration=90) |
| `services/siw/src/app/(landing)/demo/page.tsx` | 신규 — 데모 체험 페이지 (6단계 상태 머신) |
| `services/siw/src/app/(landing)/page.tsx` | Hero 버튼 조건부 렌더링 수정 |
| `services/siw/src/app/(landing)/demo/.ai.md` | 신규 |
| `services/siw/src/app/api/demo/.ai.md` | 신규 |

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음 (외부 AI 호출은 엔진에서만, DB는 서비스에서만)

---

## 작업 내역

### 2026-03-25

**현황**: 5/5 완료 (구현 완료, 테스트 미포함)

**완료된 항목**:
- 비로그인 사용자가 `/demo`에서 직무 선택 → 질문 1개 답변 → 피드백 + 8축 분석 결과 확인 가능
- 결과 화면에서 "전체 면접 시작하기" → `/signup` CTA
- IP 기반 rate limit 적용 (하루 3회, Prisma DemoUsage 테이블)
- 미들웨어 변경 없음 (기존 인증 플로우 영향 없음)
- 랜딩 Hero 버튼 조건부 렌더링

**미완료 항목**:
- 테스트 코드 (이번 PR 이후 추가 예정)

**변경 파일**: 8개
- `prisma/schema.prisma` (수정)
- `api/demo/question/route.ts` (신규)
- `api/demo/feedback/route.ts` (신규)
- `api/demo/evaluate/route.ts` (신규)
- `(landing)/demo/page.tsx` (신규)
- `(landing)/page.tsx` (수정)
- `(landing)/demo/.ai.md` (신규)
- `api/demo/.ai.md` (신규)
