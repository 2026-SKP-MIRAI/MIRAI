# feat: [lww] Phase 1 — 리포트 카드 SNS 공유 (OG 이미지 + 카카오톡 공유)

## 사용자 관점 목표
면접 결과를 친구에게 자랑하거나 카카오톡으로 공유할 때, 점수·직군이 담긴 예쁜 카드 이미지가 미리보기로 뜨며 lww 바이럴이 자연스럽게 퍼진다.

## 배경
프로포절 AARRR Referral 핵심 — "결과 리포트 카드 SNS 공유 → 바이럴 루프". 현재 리포트 URL을 공유해도 기본 OG 태그만 뜨고 점수 정보가 없어 공유 유인이 없다.

## 완료 기준
- [x] 리포트 URL 공유 시 카카오톡·SNS 미리보기에 점수·직군이 포함된 OG 카드 이미지 표시
- [x] 리포트 화면에 카카오톡 공유 버튼 + 링크 복사 버튼 추가
- [x] 공유 링크로 비로그인 유저도 리포트 조회 가능 (읽기 전용, RLS 설정)
- [x] OG 카드에 Fint 브랜딩 (Teal #0D9488) 적용

## 구현 플랜
1. `/api/og/report` 라우트 — `@vercel/og` (Edge Runtime)로 리포트 카드 이미지 동적 생성. 쿼리파람: `sessionId` → DB에서 점수·직군 조회 → 카드 렌더링
2. `/report/[sessionId]` 페이지 — `generateMetadata`로 OG 메타태그 추가 (`og:image` → `/api/og/report?sessionId=...`, `og:title` = "내 면접 점수는 {totalScore}점!")
3. 공유 버튼 UI — 카카오톡 JavaScript SDK 연동 (커스텀 피드 공유) + 클립보드 링크 복사
4. Supabase RLS — `reports` 테이블 읽기 정책: 본인 또는 `is_public=true`인 경우 허용

## 참고
- `@vercel/og` Edge Runtime — Vercel 무료 플랜 지원
- 카카오톡 공유 SDK: kakao.Share.sendDefault (JavaScript SDK v2)
- 현재 리포트 화면: `services/lww/src/app/(interview)/report/[sessionId]/page.tsx`

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] `services/fint/.ai.md` 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-25

**현황**: 0/4 완료

**완료된 항목**:
- (없음)

**미완료 항목**:
- 리포트 URL 공유 시 카카오톡·SNS 미리보기에 점수·직군이 포함된 OG 카드 이미지 표시
- 리포트 화면에 카카오톡 공유 버튼 + 링크 복사 버튼 추가
- 공유 링크로 비로그인 유저도 리포트 조회 가능 (읽기 전용, RLS 설정)
- OG 카드에 Fint 브랜딩 (Teal #0D9488) 적용

**변경 파일**: 0개 (구현 계획 작성 완료 — Ralplan 5-pass 합의, 구현 미시작)

### 2026-03-28

**현황**: 4/4 완료

**완료된 항목**:
- [x] 리포트 URL 공유 시 카카오톡·SNS 미리보기에 점수·직군이 포함된 OG 카드 이미지 표시
- [x] 리포트 화면에 카카오톡 공유 버튼 + 링크 복사 버튼 추가
- [x] 공유 링크로 비로그인 유저도 리포트 조회 가능 (읽기 전용, RLS 설정)
- [x] OG 카드에 Fint 브랜딩 (Teal #0D9488) 적용

**미완료 항목**:
- (없음)

**변경 파일**: 8개 (api/og/report/route.tsx, ShareButtons.tsx, ReportContent.tsx, report/page.tsx, supabase migration, .ai.md, types/, tests/)

### 2026-04-05

**현황**: 4/4 완료

**완료된 항목**:
- [x] 리포트 URL 공유 시 카카오톡·SNS 미리보기에 점수·직군이 포함된 OG 카드 이미지 표시
- [x] 리포트 화면에 카카오톡 공유 버튼 + 링크 복사 버튼 추가
- [x] 공유 링크로 비로그인 유저도 리포트 조회 가능 (읽기 전용, RLS 설정)
- [x] OG 카드에 Fint 브랜딩 (Teal #0D9488) 적용

**미완료 항목**:
- (없음)

**변경 파일**: 14개 (수정 6개 + 신규 8개, 미커밋 상태)

