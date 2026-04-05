# feat: [lww] Phase 1 — 크레딧 시스템 기초 (획득 전용)

## 사용자 관점 목표

취준생이 면접을 완료할 때마다 크레딧을 획득해 "쌓이는 보상"을 느끼고, 이후 Phase 1 후반 크레딧 소비처(합격 예언 오브 등)에 자연스럽게 연결된다.

## 배경

프로포절 Phase 1 핵심 기능 중 하나. 현재는 면접 완료 후 아무런 보상 피드백이 없어 재방문 동기가 부족하다. 크레딧 획득 전용 시스템을 먼저 구축하고, Phase 1 후반에 크레딧 소비처(결제 포함)를 붙인다.
크레딧은 게임머니로 현금화 없음 — 1크레딧 ≈ 5,000원 내부 단가 [가설, 실측 후 재조정].

## 완료 기준

- [x] 면접 완료(리포트 생성) 시 크레딧 자동 지급 (세션당 1회, 중복 지급 방지)
- [x] `credit_transactions` 테이블에 지급 내역 기록 (session_id unique 제약)
- [x] `profiles.credit_balance` 필드에 잔액 갱신
- [x] UI에서 현재 크레딧 잔액 표시 (TopBar 또는 인터뷰 탭 상단)
- [x] 비로그인 유저는 크레딧 지급 없음 (로그인 상태에서만 적립)

## 구현 플랜

1. DB 마이그레이션 — `credit_transactions` 테이블 생성 + `profiles.credit_balance` 필드 추가, RLS 설정
2. `/api/interview/end` 라우트 — 리포트 생성 성공 후 서버 사이드에서 크레딧 지급 트리거 (service_role client 사용)
3. 중복 방지 — `credit_transactions.session_id` unique constraint, 이미 적립된 세션이면 skip
4. 잔액 표시 UI 컴포넌트 — Supabase `profiles` 구독 또는 API 조회로 실시간 반영
5. 획득량 상수 관리 — `CREDIT_REWARD_PER_SESSION=10` (환경변수 또는 상수, 추후 조정 가능)

## 의존성

- 소셜 로그인 #179 ✅ 완료 (merged)
- Phase 1 후반 크레딧 소비처 (합격 예언 오브 등) 및 크레딧 구매(결제)는 별도 이슈

## 개발 체크리스트

- [x] 테스트 코드 포함
- [x] `services/fint/.ai.md` 최신화 (서비스명 lww→fint 변경 반영)
- [x] 불변식 위반 없음 (DB는 서비스가 소유)

---

## 작업 내역

### 2026-03-25

**현황**: 0/5 완료

**완료된 항목**:
- (없음)

**미완료 항목**:
- 면접 완료(리포트 생성) 시 크레딧 자동 지급 (세션당 1회, 중복 지급 방지)
- `credit_transactions` 테이블에 지급 내역 기록 (session_id unique 제약)
- `profiles.credit_balance` 필드에 잔액 갱신
- UI에서 현재 크레딧 잔액 표시 (TopBar 또는 인터뷰 탭 상단)
- 비로그인 유저는 크레딧 지급 없음 (로그인 상태에서만 적립)

**변경 파일**: 0개 (계획 수립 완료, 구현 시작 전)

### 2026-03-28

**현황**: 5/5 완료

**완료된 항목**:
- 면접 완료(리포트 생성) 시 크레딧 자동 지급 (세션당 1회, 중복 지급 방지)
- `credit_transactions` 테이블에 지급 내역 기록 (session_id unique 제약)
- `profiles.credit_balance` 필드에 잔액 갱신
- UI에서 현재 크레딧 잔액 표시 (인터뷰 탭 header)
- 비로그인 유저는 크레딧 지급 없음 (로그인 상태에서만 적립)

**미완료 항목**:
- (없음)

**변경 파일**: 8개 (migration, credit.ts, route.ts, coins/balance API, CreditBadge.tsx, interview/page.tsx, 테스트 파일 2개)

### 2026-04-05

**현황**: 5/5 완료, PR 준비

**완료된 항목**:
- 면접 완료(리포트 생성) 시 크레딧 자동 지급 (세션당 1회, 중복 방지)
- `coin_transactions` 테이블에 지급 내역 기록 (`uq_coin_tx_event` unique index)
- `profiles.coins` 잔액 갱신 (award_coin RPC 원자적 처리)
- UI에서 현재 크레딧 잔액 표시 (인터뷰 탭 header, CreditBadge)
- 비로그인 유저는 크레딧 지급 없음

**구현 결정사항**:
- `award_coin` RPC — SECURITY DEFINER, FOR UPDATE 잠금으로 TOCTOU 방지
- `awardInterviewCoin` — fire-and-forget (응답 지연 없음), 실패 시 warn 로깅
- `getUserCoins` 헬퍼 — `lib/credit.ts`에 코인 도메인 집중, `balance/route.ts` + `interview/page.tsx` 공유
- InterviewPage 쿼리 병렬화 — `Promise.all([sessionsQuery, getUserCoins])`

**변경 파일**: 9개 (migration SQL, credit.ts, end/route.ts, coins/balance/route.ts, CreditBadge.tsx, interview/page.tsx, 테스트 파일 2개, .ai.md)
