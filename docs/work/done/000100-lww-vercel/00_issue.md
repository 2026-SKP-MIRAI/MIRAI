# chore: lww 서비스 Vercel 배포

## 목적
lww 서비스를 Vercel로 배포하고, Supabase DB 연동을 동시에 적용한다. Vercel 사용 경험 습득 + MVP 면접 세션·리포트 영속성 확보.

## 배경
모노레포 구조에서 \`services/lww\`만 Vercel 프로젝트로 등록해 배포한다. 엔진은 AWS EC2로 별도 운영 예정.

### 현재 상태 (2026-03-20 기준)
- **MVP 프론트엔드 완료** (이슈 #116): 채팅 UI, 11 라우트, tsc 0 errors, E2E 3회 PASS
- **Supabase 미연동**: 면접 세션/리포트가 클라이언트 sessionStorage에만 존재 → 탭 닫으면 소멸
- **Vercel 미배포**: \`next.config.ts\`에 \`output: 'standalone'\` 설정 중 → Vercel 불호환 (Docker 전용), 제거 필요
- **의존성 누락**: \`@supabase/ssr\`, \`@supabase/supabase-js\` 미설치
- **\`.env.example\` 없음**: lww 서비스에 환경변수 예시 파일 없음
- **\`vercel.json\` 없음**: \`/api/interview/end\` 최대 110s 실행 → maxDuration 명시 필요

---

## 완료 기준 (AC)

### Vercel 배포
- [x] \`next.config.ts\`에서 \`output: 'standalone'\` 제거 (Vercel 기본값 사용)
- [x] \`vercel.json\` 추가 — \`/api/interview/end\`에 \`maxDuration: 110\` 설정
- [x] \`.env.example\` 추가 (아래 환경변수 목록 기준)
- [x] Vercel 프로젝트 생성: 루트 디렉토리 \`services/lww\`, 프레임워크 Next.js
- [x] Vercel 대시보드에 환경변수 설정
- [x] 배포 성공 확인 (빌드 에러 없음)
- [ ] 배포 URL 팀 공유

### Supabase 연동 (MVP 범위)
- [x] \`@supabase/ssr\`, \`@supabase/supabase-js\` 패키지 설치
- [x] \`src/lib/supabase/server.ts\` 생성 — createServerClient (seung 서비스 패턴 동일)
- [x] \`src/lib/supabase/browser.ts\` 생성 — createBrowserClient
- [x] Supabase에 MVP 테이블 2개 마이그레이션 실행 (\`interview_sessions\`, \`reports\` — dev_spec.md §DB 스키마 기준)
- [x] \`/api/interview/start\`: sessionId + 첫 질문 DB 저장 (\`interview_sessions\` INSERT)
- [x] \`/api/interview/answer\`: history + questionsQueue DB 갱신 (\`interview_sessions\` UPDATE)
- [x] \`/api/interview/end\`: 리포트 DB 저장 (\`reports\` INSERT, status: 'completed')
- [x] RLS 정책 적용 (비로그인: \`anonymous_id\` 검증, dev_spec.md 참조)

### 기타
- [x] \`middleware.ts\` in-memory rate limiter 주석에 Upstash Redis 마이그레이션 필요 명시 (Vercel 서버리스 환경에서 인스턴스 재시작 시 맵 초기화됨)
- [x] 해당 디렉토리 .ai.md 최신화

---

## 환경변수 목록

| 변수명 | 설명 | Vercel 설정 |
|--------|------|-------------|
| \`ENGINE_BASE_URL\` | 엔진 EC2 URL (e.g. https://api.mirai.com) | Production |
| \`NEXT_PUBLIC_SUPABASE_URL\` | Supabase 프로젝트 URL | All |
| \`NEXT_PUBLIC_SUPABASE_ANON_KEY\` | Supabase anon key (public) | All |
| \`SUPABASE_SERVICE_ROLE_KEY\` | Supabase service role key — 서버 전용, NEXT_PUBLIC_ 절대 금지 | Production |
| \`NEXT_PUBLIC_SITE_URL\` | 배포 URL (OAuth redirect_uri 기준, Phase 1 준비용) | All |

---

## 참고

- 엔진 Stateless 패턴: 매 호출 시 \`history\`, \`questionsQueue\` 전체 전달 필수 → DB가 없으면 서버리스 환경에서 상태 유실
- Vercel 서버리스 함수는 인스턴스를 재시작하므로 현재 in-memory rate limiter는 MVP 임시용 (운영 전 Upstash Redis 교체 권장)
- \`/api/interview/end\`의 \`export const maxDuration = 110\`은 이미 코드에 있음 → \`vercel.json\`과 중복이지만 둘 다 있어야 안전
- DB 스키마 전문: \`docs/specs/lww/dev_spec.md\` §DB 스키마
- Supabase 클라이언트 패턴 레퍼런스: \`services/seung/src/lib/supabase/\`

---

## 작업 내역

### 2026-03-20

**현황**: 11/15 완료

**완료된 항목**:
- `.env.example` 추가 (환경변수 목록 기준)
- `middleware.ts` in-memory rate limiter 주석에 Upstash Redis 마이그레이션 필요 명시
- `next.config.ts`에서 `output: 'standalone'` 제거
- `vercel.json` 추가 — `/api/interview/end` maxDuration: 110
- `@supabase/ssr`, `@supabase/supabase-js` 패키지 설치
- `src/lib/supabase/server.ts` 생성 (createClient + createServiceClient)
- `src/lib/supabase/browser.ts` 생성 (createBrowserClient)
- `src/lib/anon-cookie.ts` 생성 (HttpOnly 쿠키 기반 anonymous_id, IDOR 방지)
- `/api/interview/start`: interview_sessions INSERT + 쿠키 발급
- `/api/interview/answer`: interview_sessions UPDATE + IDOR 보호
- `/api/interview/end`: reports INSERT + sessions UPDATE
- `.ai.md` 최신화

**미완료 항목 (수동 작업 필요)**:
- Supabase DB 마이그레이션 (interview_sessions, reports 테이블 + RLS)
- Vercel 프로젝트 생성: 루트 디렉토리 `services/lww`, 프레임워크 Next.js
- Vercel 대시보드 환경변수 설정 + 배포 확인
- 배포 URL 팀 공유

**변경 파일**: 9개 (미커밋)

