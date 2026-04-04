> 출처: services/siw/Dockerfile, .github/workflows/deploy-siw.yml, services/siw/infra/deploy.sh, services/siw/airflow/dags/llm_quality_dag.py, services/siw/airflow/dags/job_crawl_dag.py, docs/specs/mirai/dev_spec.md

# 04. 인프라 — 컨테이너·CI/CD·파이프라인

---

## 1. 인프라 아키텍처 개요

siw 서비스는 AWS 위에서 동작한다. Week 1에 최소 인프라로 출시하고, Week 2에 컨테이너화·CI/CD를 더했다.

### 인프라 구성 표

| 서비스명 | AWS 리소스 | 용도 | 도입 시점 |
|---------|-----------|------|---------|
| 컴퓨트 | EC2 + ALB | 서비스·엔진 호스팅, 트래픽 분산 | Week 1 |
| 도메인 | Route53 | 커스텀 도메인 연결 | Week 1 |
| 보안 | WAF + HTTPS (ACM) | 웹 방화벽, TLS 인증서 | Week 1 |
| 파일 저장 | Supabase Storage | PDF 자소서 업로드 저장 | Week 2 |
| CDN | CloudFront | 정적 에셋 배포 가속 | Week 2 |
| 컨테이너 레지스트리 | ECR (`mirai-siw`) | 이미지 빌드·버전 관리 | Week 2 |
| CI/CD | GitHub Actions | 자동 테스트·빌드·배포 파이프라인 | Week 2 |
| EC2 스케줄 자동화 | Lambda + EventBridge | Airflow EC2 비용 최적화 on/off | Week 3 |
| 데이터 파이프라인 | Airflow (EC2) | LLM 품질 집계·RAG 크롤링 | Week 3 |
| 스케일링 | ALB 오토 스케일링 | 트래픽 급증 대응 | Week 3 |

Week 1 최소 인프라: EC2 + ALB + Route53 + WAF + HTTPS. Supabase Storage·CloudFront·Docker는 Week 2 Beta 릴리스에 추가.

---

## 2. Docker 컨테이너화

siw 서비스는 멀티스테이지 빌드로 이미지를 최소화한다. `services/siw/Dockerfile` 기준 3단계 구성이다.

### 멀티스테이지 빌드 구조

**Stage 1 — deps (`node:20-alpine`)**
`package*.json`과 `prisma/` 스키마를 복사하고 `npm ci`로 의존성만 설치한다. 이 레이어는 `package-lock.json`이 바뀌지 않으면 캐시가 재사용된다.

**Stage 2 — builder (`node:20-alpine`)**
deps 레이어에서 `node_modules`를 가져와 전체 소스를 복사한다. `NEXT_PUBLIC_*` 환경변수는 빌드 타임에 번들에 인라인되므로 ARG로 주입한다. `npx prisma generate` → `npm run build` 순서로 실행해 schema 변경 시에도 최신 Prisma client가 보장된다.

**Stage 3 — runner (`node:20-alpine`, 프로덕션)**
standalone 빌드 결과물만 복사해 이미지 크기를 최소화한다. Prisma query engine이 `libssl`에 동적 링크되므로 `apk add openssl`이 필수다.

보안: non-root 사용자(`nextjs`, uid 1001)로 실행한다.

```
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
```

헬스체크: 컨테이너 시작 30초 후부터 30초 간격으로 `wget`으로 루트 엔드포인트를 확인한다. 3회 연속 실패 시 `unhealthy` 상태로 전환된다.

```
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null || exit 1
```

### entrypoint.sh

컨테이너 시작 시 `entrypoint.sh`가 3단계를 순서대로 실행한다.

```
1. env guard      — DATABASE_URL, DIRECT_URL 미설정 시 즉시 종료 (배포 실수 차단)
2. migrate deploy — node node_modules/prisma/build/index.js migrate deploy
3. 서버 시작      — exec node server.js
```

마이그레이션을 배포 시점에 자동 실행하므로 DB 스키마와 코드가 항상 동기화된다.

---

## 3. CI/CD 파이프라인

`.github/workflows/deploy-siw.yml`이 3개 job으로 구성된다. `main` 브랜치에 `services/siw/**` 경로 변경이 push되거나 수동 트리거(`workflow_dispatch`) 시 실행된다.

### 파이프라인 흐름

```
[push to main / workflow_dispatch]
        |
        v
[test-siw]                          ← Job 1
  - actions/setup-node@v4 (Node 22)
  - npm ci
  - npm run test (Vitest)
        |
        v (test 통과 시)
[build-and-push-siw]                ← Job 2
  - AWS 자격증명 설정
  - ECR 로그인
  - docker build (멀티스테이지, NEXT_PUBLIC_* ARG 주입)
  - ECR push (mirai-siw:latest + mirai-siw:{sha})
        |
        v (build 완료 또는 skip_build=true 시)
[deploy]                            ← Job 3
  - SSH into EC2 (appleboy/ssh-action)
  - ECR 로그인 (EC2 내부)
  - ~/.env.siw 존재 확인 (없으면 배포 중단)
  - 기존 컨테이너 정리 (docker stop siw && docker rm siw)
  - docker pull mirai-siw:latest
  - docker image prune -f (디스크 확보)
  - docker run -d --restart unless-stopped --env-file ~/.env.siw -p 3000:3000
```

### 주요 설계 결정

- **test → build → deploy 순서 강제**: test job이 실패하면 build·deploy job이 실행되지 않는다. 테스트 없는 PR은 머지 금지(불변식 #5)와 동일한 원칙이 CI에도 적용된다.
- **skip_build 옵션**: `workflow_dispatch`에서 `skip_build=true`로 지정하면 빌드를 건너뛰고 EC2 컨테이너만 재시작한다. 환경변수 변경 등 코드 변경 없는 재배포에 사용한다.
- **env 파일 가드**: EC2에 `~/.env.siw`가 없으면 배포 스크립트가 즉시 종료한다. 환경변수 누락으로 컨테이너가 잘못 시작되는 상황을 원천 차단한다.
- **이미지 이중 태그**: `latest`와 `{sha}` 두 태그를 동시에 push해 롤백 시 특정 커밋의 이미지를 정확히 식별할 수 있다.

---

## 4. EC2 스케줄 자동화

Airflow는 24시간 상시 운영이 필요하지 않다. 매일 새벽 LLM 이벤트 집계 DAG(UTC 15:00)와 주간 채용공고 크롤링 DAG(UTC 일 03:00)만 실행된다. Airflow가 올라가는 EC2를 사용하지 않는 시간에 꺼두면 비용을 절감할 수 있다.

### 비용 최적화 근거

DAG 실행 시간이 하루 1시간 내외에 불과하다. Airflow EC2를 상시 구동하면 약 23시간을 낭비한다. Lambda + EventBridge cron으로 EC2를 자동 on/off해 이 비용을 제거했다.

### 구성

`services/siw/infra/deploy.sh`가 AWS CLI로 멱등 배포한다.

```
[EventBridge cron: UTC 14:45 (KST 23:45)]
    → Lambda ec2-start → EC2 StartInstances
    → Airflow EC2 시작

[DAG 실행: UTC 15:00 — llm_quality_dag]
    → S3 이벤트 추출 → 집계 → DB 적재 → 에러율 알림

[EventBridge cron: UTC 16:00 (KST 01:00)]
    → Lambda ec2-stop → EC2 StopInstances
    → Airflow EC2 종료
```

두 Lambda 함수(`ec2-start`, `ec2-stop`)는 Python 3.12 런타임으로 boto3를 사용한다. `EC2_INSTANCE_ID` 환경변수로 대상 인스턴스를 지정한다.

deploy.sh는 Lambda 존재 여부를 확인 후 `create-function` 또는 `update-function-code`를 선택 실행해 멱등성을 보장한다. EventBridge 규칙과 Lambda 호출 권한도 동일하게 멱등 처리된다.

---

## 5. 데이터 파이프라인

두 개의 Airflow DAG가 siw 서비스의 데이터 품질을 지원한다.

### llm_quality_dag — LLM 품질 집계

`services/siw/airflow/dags/llm_quality_dag.py`

스케줄: 매일 UTC 15:00 (KST 00:00)

```
extract_events
    → S3에서 당일 LLM 이벤트 JSONL 수집
aggregate_metrics
    → feature_type별 call_count, avg_latency_ms, error_rate, total_tokens, estimated_cost_usd 집계
load_to_db
    → analytics.llm_events_daily 테이블 upsert (ON CONFLICT date, feature_type)
alert_on_high_error_rate
    → error_rate > 10% 시 경고 로그
```

siw 서비스의 `event-logger.ts`가 API 호출 시점마다 JSONL 형태로 S3에 적재한다. 이 DAG는 그 원시 로그를 일별로 집계해 운영 대시보드(`/dashboard/observability`)에 공급한다.

### job_crawl_dag — 채용공고 크롤링 + RAG

`services/siw/airflow/dags/job_crawl_dag.py`

스케줄: 매주 일요일 UTC 03:00 (KST 12:00)

```
crawl_list
    → 워크넷(고용24) 채용공고 목록 수집 → S3 list.jsonl 저장
crawl_details
    → wantedAuthNo별 상세 조회 (직무내용 + 우대사항 포함) → S3 details.jsonl 저장
embed_postings
    → 엔진 /api/embed 배치 호출 (baai/bge-m3, 100건 단위) → S3 embedded.jsonl 저장
upsert_vectors
    → job_posting_embeddings 테이블에 pgvector INSERT ON CONFLICT upsert
log_summary
    → upsert 건수 요약 로그
```

이 DAG가 수집한 채용공고 벡터는 이력서 업로드 시 유사 채용공고를 검색(RAG)해 이력서 피드백의 `job_context`로 활용된다. `ENABLE_RAG` 환경변수로 활성화 여부를 제어한다.
