# Fint 결제 명세 (Payment Spec)

> 상태: 초안 (placeholder) — PG사 미확정 (OI-2)
> 연결 화면: 화면 25 (크레딧 충전)
> 생성일: 2026-03-23

---

## PG 연동 플로우 (클라이언트)

1. 패키지 선택 (화면 25)
2. 결제 확인 모달 (`price`, `credits`, `packageName`)
3. PG SDK 호출 → PG 처리 중 Teal 전체 오버레이 스피너
4. PG 콜백 수신 (성공/실패)
5. 성공: 서버 영수증 검증 API 호출 → 크레딧 잔액 업데이트 → `returnTo` 복귀
6. 실패: 에러 모달 (에러 코드 분류별 메시지 + 재시도/취소 CTA)

---

## 서버-PG 통신 시퀀스 (placeholder — PG사 확정 후 상세화)

- 클라이언트가 PG SDK 결제 완료 후 서버에 `paymentId` 전달
- 서버가 PG사 API로 결제 검증 (`GET /payments/{paymentId}`)
- 검증 성공 시 크레딧 DB 업데이트 후 클라이언트 응답
- 중복 결제 방지: `paymentId` unique constraint + idempotency key
- **server-confirmed update 원칙**: optimistic update 사용 안 함. 서버 검증 응답 수신 후 크레딧 잔액 업데이트.

---

## Webhook 수신 (placeholder — PG사 확정 후 구현)

- 엔드포인트: `POST /webhooks/payment` (서버 수신용)
- 서명 검증: PG사 제공 HMAC/시크릿 키로 webhook 서명 확인
  - 토스페이먼츠: `Authorization` 헤더 검증
  - 포트원(아임포트): `imp_uid` 검증
- 처리: DB 크레딧 업데이트(idempotent) → 클라이언트 polling 응답 or SSE 푸시
- **returnTo 복귀 시 크레딧 동기화**: 결제 완료 후 서버 검증 응답 받은 뒤 복귀 화면 진입

---

## 패키지 정의 (placeholder)

| ID | 이름 | 가격 | 크레딧 | 배지 |
|----|------|------|--------|------|
| `pkg_s` | 스타터 | PRICE_PKG_S | CREDIT_PKG_S | - |
| `pkg_m` | 인기 | PRICE_PKG_M | CREDIT_PKG_M | 🔥 POPULAR |
| `pkg_l` | 추천 | PRICE_PKG_L | CREDIT_PKG_L | ✨ BEST VALUE |

실제 가격/크레딧 수치는 `services/fint/src/config/credits.ts`에서 관리.

---

## 오류 코드 분류 (placeholder — PG사 확정 후 매핑)

| 분류 | 예시 코드 | UI 메시지 | 행동 |
|------|-----------|-----------|------|
| 카드 한도 초과 | `PG_CARD_LIMIT` | "한도를 초과했어요" | 다른 카드 시도 |
| 잔액 부족 | `PG_INSUFFICIENT` | "잔액이 부족해요" | 다른 결제수단 시도 |
| 결제 취소 | `PG_CANCELLED` | (모달 닫기) | 화면 25 유지 |
| 서버 검증 실패 | `SERVER_VERIFY_FAIL` | "결제를 확인할 수 없어요" | 재시도 / 고객지원 링크 |
| 네트워크 오류 | `NETWORK_ERROR` | "연결이 끊겼어요" | 재시도 |

---

## 환불 정책 (placeholder — 법무 검토 필요)

- 디지털 재화(크레딧) 특성상 즉시 사용된 크레딧 환불 불가 원칙
- 미사용 크레딧 전액 환불: 구매 후 7일 이내, 고객지원 통해 수동 처리
- 전자상거래법 제17조 준수 문구를 결제 화면에 표시 필요

---

## PG사 후보 (OI-2 결정 전 placeholder)

- 토스페이먼츠
- 카카오페이
- 포트원 (구 아임포트)

PG사 확정 후 위 placeholder 섹션들을 실제 API 명세로 교체할 것.
