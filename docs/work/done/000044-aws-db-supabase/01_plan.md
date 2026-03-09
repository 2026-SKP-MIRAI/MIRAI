# [#44] chore: 인프라 스택 재정의 — 컴퓨트 AWS 유지, DB·스토리지·인증 Supabase로 전환 — 구현 계획

> 작성: 2026-03-09

---

## 완료 기준

- [ ] `docs/whitepaper/mirai_project_plan.md` Week 1·2 인프라 항목에서 RDS·S3·Better Auth → Supabase DB·Storage·Auth로 교체 반영
- [ ] `docs/specs/mirai/dev_spec.md` §2 기술 스택·§6 환경변수 업데이트
- [ ] 각 서비스 `.ai.md` 변경사항 반영

---

## 구현 계획

### Step 1 — `docs/whitepaper/mirai_project_plan.md` 수정

**변경 위치 1: §2 통신 구조 다이어그램 (line 79)**
```
# Before
[유저] → [Next.js (Better Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]

# After
[유저] → [Next.js (Supabase Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]
```

**변경 위치 2: Week 1 기획+세팅 섹션 (line 131)**
```
# Before
기술 스택 확정: Next.js 풀스택 (서비스) + FastAPI (엔진) + Better Auth + PostgreSQL + Prisma

# After
기술 스택 확정: Next.js 풀스택 (서비스) + FastAPI (엔진) + Supabase Auth + Supabase PostgreSQL + Prisma
```

**변경 위치 3: Week 2 서비스 섹션 (line 151-154)**
```
# Before
- 회원가입/인증 (Better Auth)
- S3 파일 업로드 연동
- CloudFront CDN 적용

# After
- 회원가입/인증 (Supabase Auth)
- Supabase Storage 파일 업로드 연동
- CloudFront CDN 적용 (정적 에셋용, Supabase Storage가 파일 저장 담당)
```

**변경 위치 4: Week 2 인프라+CI/CD 섹션**
- S3 언급이 있다면 Supabase Storage로 교체
- CloudFront는 정적 에셋 CDN 역할로 유지 명시

---

### Step 2 — `docs/specs/mirai/dev_spec.md` 수정

**§2 서비스 기술 스택 테이블 (line 37-47)**

| 항목 | Before | After |
|------|--------|-------|
| 인증 | Better Auth | Supabase Auth |
| ORM/DB | Prisma + PostgreSQL | Prisma + Supabase PostgreSQL |

**§2 인프라 테이블 (line 50-60)**

| 항목 | Before | After |
|------|--------|-------|
| 파일 저장 | S3 — PDF 자소서 업로드 저장, Week 2 | Supabase Storage — PDF 자소서 업로드 저장, Week 2 |

S3 관련 행을 Supabase Storage로 교체. EC2·ALB·Route53·WAF·CloudFront·Docker·ECR는 그대로 유지.

**§2 통신 다이어그램 (line 67)**
```
# Before
[유저] → [Next.js 서비스 (Better Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]

# After
[유저] → [Next.js 서비스 (Supabase Auth 인증)] → HTTP REST → [FastAPI 엔진 (내부 전용)]
```

**§6 환경변수 (line 434-456)**
```
# Before (서비스)
DATABASE_URL         PostgreSQL 연결 문자열 (Prisma)
BETTER_AUTH_SECRET   Better Auth 세션 서명 키

# AWS (Week 2 추가)
AWS_REGION           S3·ECR 리전
AWS_ACCESS_KEY_ID    IAM 접근 키
AWS_SECRET_ACCESS_KEY IAM 시크릿 키
S3_BUCKET_NAME       PDF 업로드 버킷명
CLOUDFRONT_URL       CDN 퍼블릭 URL

# After (서비스)
DATABASE_URL              Supabase PostgreSQL pooler 연결 문자열 (Prisma 런타임용, port 6543, ?pgbouncer=true&sslmode=require)
DIRECT_URL                Supabase PostgreSQL direct 연결 문자열 (prisma migrate 전용, port 5432, ?sslmode=require)
NEXT_PUBLIC_SUPABASE_URL  Supabase 프로젝트 URL (클라이언트 번들 포함용)
NEXT_PUBLIC_SUPABASE_ANON_KEY  Supabase 익명 키 (클라이언트 번들 포함용, RLS 정책 설정 필수 전제)
SUPABASE_URL              Supabase 프로젝트 URL (서버 사이드용)
SUPABASE_ANON_KEY         Supabase 익명 키 (서버 사이드용)
SUPABASE_SERVICE_ROLE_KEY Supabase 서비스 롤 키 (서버 전용, NEXT_PUBLIC_ 금지, RLS 우회 키)
SUPABASE_STORAGE_BUCKET   Supabase Storage 버킷명 (하드코딩 방지)

# AWS (Week 2 추가) — 컴퓨트·CDN 전용
AWS_REGION           ECR 리전
AWS_ACCESS_KEY_ID    IAM 접근 키 (ECR 전용, S3 권한 제거)
AWS_SECRET_ACCESS_KEY IAM 시크릿 키 (ECR 전용)
CLOUDFRONT_URL       정적 에셋 CDN 퍼블릭 URL
```

> - `S3_BUCKET_NAME` 제거, `BETTER_AUTH_SECRET` 제거
> - `SUPABASE_JWT_SECRET` 불필요: `@supabase/ssr` SDK가 JWT 검증을 내부 처리함. 엔진-서비스 내부 호출 인증은 네트워크 격리로 처리.
> - `NEXT_PUBLIC_` 변수는 브라우저 번들에 포함됨 — `SUPABASE_SERVICE_ROLE_KEY`에 절대 사용 금지
> - `DIRECT_URL`은 `prisma migrate` 전용, 런타임에는 pooler URL 사용
> - Prisma schema.prisma에 `directUrl = env("DIRECT_URL")` 설정 필요

---

### Step 3 — 서비스 `.ai.md` 업데이트

서비스별 `.ai.md` 현황: 현재 특정 인증/DB 기술을 명시하지 않음 (고수준 역할 기술만 있음).
→ `services/.ai.md` (루트) 및 각 서비스 `.ai.md`에 기술 스택 참조 주석 추가.

**`services/siw/.ai.md`, `services/kwan/.ai.md`, `services/seung/.ai.md`, `services/lww/.ai.md`**

"작업 전 확인" 섹션에 Supabase 관련 참조 추가:
```markdown
## 인증·DB·스토리지
- **인증**: Supabase Auth (Better Auth 미사용)
  - 클라이언트: `@supabase/ssr` createBrowserClient + NEXT_PUBLIC_SUPABASE_URL/ANON_KEY
  - 서버: createServerClient + middleware.ts (getUser() 로 세션 갱신 필수)
- **DB**: Supabase PostgreSQL
  - 런타임: DATABASE_URL (pooler, port 6543, ?pgbouncer=true)
  - 마이그레이션: DIRECT_URL (direct, port 5432)
  - Prisma로 테이블 생성 시 RLS 자동 활성화 안됨 — 별도 SQL 마이그레이션 필수
- **파일 저장**: Supabase Storage (AWS S3 미사용)
  - 버킷명: SUPABASE_STORAGE_BUCKET 환경변수 사용 (하드코딩 금지)
  - 서버 경유 업로드 (SUPABASE_SERVICE_ROLE_KEY) 또는 클라이언트 직접 업로드 (ANON_KEY + RLS)
- **보안**: SUPABASE_SERVICE_ROLE_KEY는 서버 전용 — NEXT_PUBLIC_ 접두사 절대 금지
- 환경변수 상세: `docs/specs/mirai/dev_spec.md` §6
```

---

### Step 4 — `scripts/check_invariants.py` 업데이트

현재 `AUTH_PATTERNS`에 `better-auth`, `better_auth`만 있음 → Supabase Auth 전환 후 엔진 내 인증 코드 유입을 계속 감지하도록 패턴 추가.

```python
# Before
AUTH_PATTERNS = ["better-auth", "better_auth", ...]

# After (추가)
AUTH_PATTERNS = ["better-auth", "better_auth", ...,
                 "@supabase/auth", "supabase_auth", "supabase.auth",
                 "createClient.*supabase"]  # 엔진에서 Supabase 클라이언트 직접 생성 감지
```

> 불변식 1번("인증은 서비스에서만") 검증이 Supabase에 대해서도 동작해야 함.

---

## 작업 순서

1. `mirai_project_plan.md` — 4곳 텍스트 수정
2. `dev_spec.md` — §2 테이블 3곳 + §6 환경변수 섹션 수정 (DIRECT_URL·NEXT_PUBLIC_ 변수 포함)
3. 서비스 `.ai.md` 4개 — 인증·DB·스토리지 섹션 추가
4. `scripts/check_invariants.py` — AUTH_PATTERNS에 Supabase 패턴 추가
5. `docs/work/active/000044-aws-db-supabase/00_issue.md` — 작업 내역 기록

## 아키텍처 결정사항 (구현 전 확정 필요)

| 항목 | 결정 | 근거 |
|------|------|------|
| Supabase 프로젝트 구성 | **단일 프로젝트 공유** (MVP) | 4주·10명 목표. 서비스별 DB 스키마(PostgreSQL schema)로 격리. 스케일 시 분리. |
| Supabase 플랜 | **Pro ($25/월)** 필수 | Free 티어는 7일 비활성 시 자동 pause — 프로덕션 불가. |
| Supabase 리전 | **ap-northeast-1 (Tokyo)** | Seoul 리전 미지원. EC2 서울 ↔ Tokyo RTT ~30-40ms. N+1 쿼리 제거 필수. |
| Prisma + RLS 전략 | **Prisma = primary authorization** | Prisma가 SERVICE_ROLE 연결 사용(RLS 우회) → 서비스 코드에서 인가 로직 구현. RLS는 클라이언트 직접 접근 방어용으로만 사용. |
| 엔진-서비스 내부 통신 인증 | **네트워크 격리 (ALB/SG)** | 엔진은 인증 로직 없음 불변식 유지. JWT 전달 없음. |
| CloudFront + Supabase Storage | **정적 에셋 전용** | Supabase Storage 파일은 CloudFront 경유 없이 Supabase URL 직접 서빙. |
| 파일 업로드 경로 | **서버 경유** (Week 2 구현 시) | Next.js API Route → Supabase Storage SDK. WAF 보호 유지. |

## 주의사항

- CloudFront는 **유지** (정적 에셋 CDN). Supabase Storage가 파일 저장만 대체.
- Docker/ECR/GitHub Actions CI/CD는 영향 없음 — 컴퓨트 레이어이므로.
- 아키텍처 불변식 "DB는 서비스가 소유"는 그대로 유효 (Supabase도 서비스가 소유하는 외부 DB).
- `dev_spec.md`의 `1차 출시 주석` (line 62): "S3·CloudFront·Docker는 Week 2" → "Supabase Storage·CloudFront·Docker는 Week 2"로 수정.
- **엔진은 Supabase에 직접 접근하지 않음** — 서비스가 PDF 바이너리를 HTTP body로 엔진에 전달.

## 보안 체크리스트 (구현 시)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` — `NEXT_PUBLIC_` 접두사 없음 확인 (빌드 타임 검증)
- [ ] 모든 테이블 RLS 활성화 — Prisma 마이그레이션과 별도 SQL로 적용
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 노출 전 RLS 정책 설정 완료 확인
- [ ] PDF 업로드: 매직 바이트(`%PDF-`) 검증 추가 + 파일 읽기 후 크기 재검증
- [ ] IAM 정책 축소 — S3 권한 제거, ECR 전용 최소 권한 적용
- [ ] `DATABASE_URL`에 `?sslmode=require` 포함 확인
- [ ] Supabase 프로젝트 CORS 허용 도메인에 4개 서비스 도메인 등록
- [ ] 서비스별 DB 스키마 격리 전략 SQL 작성

## 별도 이슈로 분리할 항목 (이번 이슈 범위 외)

- 실제 코드 변경: Supabase Auth SDK 연동, Storage 업로드 코드 (`@supabase/ssr` 패키지 추가)
- 데이터 마이그레이션: RDS → Supabase PostgreSQL (pg_dump/restore)
- 백업 파이프라인: `pg_dump` → S3 cron 구성
- IAM 최소 권한 정책 실제 업데이트
- Redis 캐시 레이어 (레이턴시 보완, 필요 시)
