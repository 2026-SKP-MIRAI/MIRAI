# chore: 인프라 스택 재정의 — 컴퓨트 AWS 유지, DB·스토리지·인증 Supabase로 전환

## 목적
호스팅(컴퓨트)은 AWS(EC2·ALB·Route53·WAF)로 유지하되, DB·스토리지·인증은 Supabase로 전환한다.
RDS·S3·Better Auth 세팅 비용을 줄여 Week 2 기능 개발에 집중한다.

## 배경
현재 `mirai_project_plan.md`·`dev_spec.md`는 RDS + S3 + Better Auth 기반으로 작성돼 있다.
4주 일정 내 유저 10명 피드백 목표를 달성하려면 인프라 세팅 시간을 단축할 필요가 있다.

**변경 내용:**
| 구분 | 기존 | 변경 |
|------|------|------|
| DB | AWS RDS (PostgreSQL) | Supabase PostgreSQL |
| 파일 저장 | AWS S3 | Supabase Storage |
| 인증 | Better Auth | Supabase Auth |
| 컴퓨트 | AWS EC2·ALB·Route53·WAF | **그대로 유지** |

## 완료 기준
- [x] `docs/whitepaper/mirai_project_plan.md` Week 1·2 인프라 항목에서 RDS·S3·Better Auth → Supabase DB·Storage·Auth로 교체 반영
- [x] `docs/specs/mirai/dev_spec.md` §2 기술 스택·§6 환경변수 업데이트
- [x] 각 서비스 `.ai.md` 변경사항 반영

## 구현 플랜
1. `mirai_project_plan.md` Week 1·2 인프라 섹션 수정
2. `docs/specs/mirai/dev_spec.md` 기술 스택·환경변수 섹션 수정
3. 영향받는 서비스 `.ai.md` 업데이트

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 변경 파일 및 이유

**`docs/whitepaper/mirai_project_plan.md`**
- Week 1 기술 스택에서 Better Auth → Supabase Auth 교체
- Week 2 Beta 구현 항목에서 S3 → Supabase Storage 교체
- services/lww/package.json 설명에서 Prisma 옆에 Supabase Auth 명시

**`docs/specs/mirai/dev_spec.md`**
- §2 기술 스택: Better Auth → Supabase Auth, AWS S3 → Supabase Storage, PostgreSQL → Supabase PostgreSQL
- §6 환경변수: BETTER_AUTH_SECRET·S3_BUCKET_NAME 제거, 아래 변수로 전면 교체:
  - `DATABASE_URL` (pooler, port 6543, `?pgbouncer=true`) — Prisma 런타임용
  - `DIRECT_URL` (direct, port 5432) — Prisma 마이그레이션용
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 클라이언트 노출 허용
  - `SUPABASE_SERVICE_ROLE_KEY` — 서버 전용 (NEXT_PUBLIC_ 금지)
  - `SUPABASE_STORAGE_BUCKET` — 버킷명 하드코딩 방지

**`services/{siw,kwan,seung,lww}/.ai.md`**
- 4개 서비스 모두에 **인증·DB·스토리지** 섹션 신규 추가:
  - Supabase Auth: `@supabase/ssr` createBrowserClient(클라이언트) / createServerClient+middleware.ts(서버)
  - DB: pooler URL(런타임) vs direct URL(마이그레이션) 구분, RLS 수동 활성화 주의사항
  - Storage: `SUPABASE_STORAGE_BUCKET` 환경변수 사용, 서버 경유 업로드(WAF 유지)
  - 보안: `SUPABASE_SERVICE_ROLE_KEY` 서버 전용 강조

**`scripts/check_invariants.py`**
- `AUTH_PATTERNS`에 Supabase Auth 관련 패턴 추가 (`@supabase/auth`, `supabase.auth`, `createClient` 등)
- 목적: Supabase 전환 후 엔진에 인증 코드가 유입되는 것을 CI에서 차단

### 기술적 결정 사항

1. **컴퓨트는 AWS 유지**: EC2·ALB·Route53·WAF는 그대로. DB·Auth·Storage만 Supabase로 교체.
2. **DIRECT_URL 분리**: Prisma 런타임은 pooler, 마이그레이션은 direct — 두 URL을 명시적으로 분리.
3. **NEXT_PUBLIC_ 규칙**: `SUPABASE_SERVICE_ROLE_KEY`는 절대 클라이언트 노출 금지.
4. **RLS 주의사항**: Prisma 마이그레이션으로 테이블 생성 시 RLS가 자동 활성화되지 않아 별도 SQL 마이그레이션 필수.
5. **6개 전문가 리뷰 반영**: 인프라·백엔드·프론트엔드·클라우드·인증·보안 관점에서 검토 후 누락사항 보완.
