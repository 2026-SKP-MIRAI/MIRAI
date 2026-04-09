# [kwan] 프론트엔드 고도화 — 랜딩 + 인증 + 대시보드 + 시각화

## 사용자 관점 목표
kwan 서비스를 실제 사용 가능한 프로덕션 수준으로 끌어올린다. 랜딩 페이지로 서비스를 소개하고, 로그인을 통해 개인 면접 기록을 관리하며, 시각화된 리포트로 성장을 추적할 수 있다.

## 배경
현재 kwan은 인증 없이 4페이지 단방향 플로우만 존재한다. 디자인 시스템, 랜딩 페이지, 사용자 인증, 대시보드, 시각화/애니메이션을 추가하여 완성도를 높인다.

## 완료 기준
- [ ] globals.css에 MirAI 디자인 시스템 적용 (Pretendard, glass-card, gradient-text, btn-primary 등)
- [ ] 랜딩 페이지(`/`) 구현 — Hero, Features, Personas, Evaluation, CTA, Footer
- [ ] 기존 업로드 폼 `/upload`으로 이동 + 라우팅 정리
- [ ] Supabase Auth 연동 — 로그인/회원가입/콜백/미들웨어
- [ ] DB 마이그레이션 — Resume, InterviewSession, Report에 `userId` + `fileName` 추가
- [ ] 전체 API 라우트 인증 게이트 추가 (userId 기반 필터링)
- [ ] 대시보드(`/dashboard`) — 이력서 목록, 성장 추이 차트, 삭제 기능
- [ ] NavBar 컴포넌트 (로그아웃, 경로별 조건부 표시)
- [ ] diagnosis 페이지 시각화 업그레이드 (인터랙티브 axis-row)
- [ ] report 페이지 ScoreGauge + 애니메이션 적용
- [ ] 기존 테스트 통과 + 신규 테스트 추가
- [ ] `.ai.md` 최신화

## 구현 플랜
1. **기반**: 패키지 설치 (`@supabase/ssr`, `lucide-react`, `recharts`) + Prisma 마이그레이션 + globals.css 교체
2. **인증 인프라**: Supabase 클라이언트 분리 (browser/server) + 미들웨어 + 로그인/회원가입/콜백 페이지
3. **API 인증**: 기존 8개 라우트 인증 게이트 + 신규 3개 (dashboard, progress, resume DELETE)
4. **컴포넌트**: NavBar, ScoreGauge, 대시보드 타입
5. **페이지**: 랜딩 페이지(/) + 업로드(/upload) + 대시보드(/dashboard) + diagnosis·report 시각화 업그레이드
6. **마무리**: 테스트 + `.ai.md` 최신화

## 개발 체크리스트
- [ ] 테스트 코드 포함
- [ ] 해당 디렉토리 .ai.md 최신화
- [ ] 불변식 위반 없음

---

## 작업 내역

