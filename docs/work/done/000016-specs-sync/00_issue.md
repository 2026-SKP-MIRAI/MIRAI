# chore: 화이트페이퍼 기준 specs 문서 동기화

## 목적
화이트페이퍼(MirAI_proposal.md v2) 최신 내용과 MirAI_dev_spec.md 간 불일치를 해소한다.

## 배경
MirAI_proposal.md가 v2로 업데이트되었으나 MirAI_dev_spec.md가 아직 동기화되지 않았다. 특히 UX 설계, 8축 역량 축 정의, 기능 우선순위 등에서 차이가 발생한다.

## 완료 기준
- [x] MirAI_dev_spec.md를 최신 MirAI_proposal.md와 대조해 불일치 항목 업데이트
- [x] UX 흐름(실전/연습 모드 구분, 화면별 사용자 경험) dev spec에 반영
- [x] docs/specs/.ai.md 최신화

## 구현 플랜

### 발견된 불일치 항목

**1. 8축 역량 축 이름 불일치**
- proposal(v2 §5-2 기능07): 의사소통 / 문제해결 / 논리적 사고 / 직무 전문성 / 조직 적합성 / 리더십 / 창의성 / 성실성
- dev spec(기능07): 직무 전문성 / 경험의 구체성 / 논리적 사고 / 커뮤니케이션 / 조직 적합성 / 성장 가능성 / 비즈니스 임팩트 / 압박 대응력
- → proposal 기준으로 통일 필요

**2. UX 설계가 dev spec에 없음**
- proposal 5장에 상세 UX 존재: 전체 사용자 여정, 화면별 UX, 실전/연습 모드 구분
- dev spec에는 API 명세만 있고 UX 흐름·모드 구분 없음
- → dev spec에 UX 섹션 추가 또는 별도 spec 문서 작성

**3. 기능 우선순위 체계 불일치**
- proposal: MVP → Phase 1(03·04) → Phase 2(07) → Phase 3(05·02) → Phase 4(06)
- dev spec: Week 1(01) → Week 2(02·03·04) → Week 3(05·06·07)
- → proposal의 Phase 구조를 dev spec 로드맵에 반영

### 작업 순서
1. 8축 역량 축 이름을 proposal 기준으로 수정
2. 기능 우선순위/로드맵을 Phase 구조로 업데이트
3. UX 흐름(실전/연습 모드, 화면별 경험) 섹션 추가
4. docs/specs/.ai.md 최신화

## 개발 체크리스트
- [ ] 해당 디렉토리 .ai.md 최신화

---

## 작업 내역

### 구조 개편
- `docs/specs/MirAI_dev_spec.md` → `docs/specs/mirai/dev_spec.md` (git mv)
- `docs/specs/MVP_dev_spec.md` → `docs/specs/mvp/dev_spec.md` (git mv)
- `docs/specs/mirai/.ai.md`, `docs/specs/mvp/.ai.md` 신규 작성 (역할 분리 명시)
- `docs/specs/.ai.md` 업데이트 (새 폴더 구조 반영)

### mirai/dev_spec.md 업데이트
- **기능 우선순위**: Week 체계 → Phase 체계 (MVP / Phase 1~4)
- **기술 스택 전면 재작성**: 엔진 + 서비스 분리, 아키텍처 불변식 5개
- **개발 원칙 섹션 추가**: TDD(엔진), DDD+TDD(서비스)
- **8축 역량 이름 수정**: proposal v2 기준 (의사소통/문제해결/논리적 사고/직무 전문성/조직 적합성/리더십/창의성/성실성)
- **기능03** interviewMode `"real" | "practice"` 파라미터 추가
- **기능04** 꼬리질문 JSON 형식 수정 (유효한 JSON)
- **기능05** 유효하지 않은 JS-style 코드 정리
- **기능07** 진입 조건 추가, growthCurve null 처리
- **환경 변수**: ENGINE_BASE_URL, DATABASE_URL 추가

### mirai/ux_flow.md 신규 작성
- 전체 사용자 여정 4단계 흐름도
- 기능 간 데이터 흐름 (resumeId 전달 경로)
- 모드 구분 규칙 테이블 (실전/연습)
- 화면별 구성 (기능01~07), Phase별 UX 범위
- Open Questions 11개 (팀 결정 필요 미결 사항)

### mvp/dev_spec.md 업데이트
- 통신 다이어그램에서 Better Auth 제거 (MVP는 인증 없음)
- 개발 원칙 섹션 추가 (TDD + 5개 불변식)
- `engine/app/prompts/` 경로 명시, TDD-first 개발 단계
- Beta 확장 경로 테이블 (Phase 1~4)
- 의존성에서 Better Auth/Prisma 제거 (Phase 3 진입 시 추가)


