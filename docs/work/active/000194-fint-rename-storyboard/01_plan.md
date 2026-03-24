# [#194] Fint 서비스명 통일 + Phase 2 스토리보드 상세화 + 디자인 시안 — 구현 계획

> 작성: 2026-03-23

---

## 완료 기준

- [ ] services/lww/ → services/fint/ 디렉토리 이름 변경 + 모든 참조 업데이트
- [ ] docs/specs/lww/ → docs/specs/fint/ 이동
- [ ] design.md 컬러 시스템 Teal #0D9488로 전면 업데이트
- [ ] storyboard.md 서비스명 Fint 통일 + IA 5탭 구조 반영
- [ ] Phase 2 핵심 화면 상세화 (Aha Moment·스트릭·홈피드·페르소나마켓·쪽지·MBTI카드)
- [ ] Phase 2 나노바나나프로 디자인 시안 6개 이상 생성
- [ ] Playwright E2E 경로 업데이트 (디렉토리 변경 반영)
- [ ] 테스트 코드 포함
- [ ] services/fint/.ai.md 최신화
- [ ] 불변식 위반 없음

---

## 배경 및 컨텍스트

### 서비스명
- 코드베이스: `services/lww/` (Life With Work 초안)
- 확정 브랜드: **Fint** (Find Interview)
- 슬로건: "취업준비부터 직장생활까지, 재밌게"

### 브랜드 컬러
- 구버전(제거 대상): `#7C3AED` (보라)
- 확정(유지/통일): `#0D9488` (Teal)

### 관련 문서
- `docs/specs/lww/ia_flow.md` — 5탭 IA 전체 구조, Phase 2 Task 플로우
- `docs/specs/lww/storyboard.md` — 현재 Phase 1까지만 상세화, Phase 2 골격만 있음
- `docs/specs/lww/design.md` — 구버전 컬러 `#7C3AED` 잔존
- `docs/whitepaper/lww/proposal.md` — Fint 서비스 전체 기획, TAM/SAM/SOM
- `docs/whitepaper/lww/presentation/content/slides-data.json` — 피치덱 슬라이드

### Phase 2 핵심 기능 (ia_flow.md 기준)
1. **Aha Moment** — 결과 리포트에서 첫 점수 확인 (★ 핵심 감동 포인트)
2. **스트릭 메커니즘** — 연속 면접 횟수 추적, 보상 체계
3. **홈 피드** — SNS형 추천 피드, 인기 페르소나 추천, 크레딧 잔액
4. **페르소나 마켓** — 현직자 AI 페르소나 목록/상세/면접, 크레딧 경제
5. **쪽지** — 취준생 → 현직자, 크레딧 소비, 답장 알림
6. **직무 MBTI 카드** — 바이럴 콘텐츠, SNS 공유, 크레딧 소비

---

## 구현 계획

### Step 1: docs/specs 이동 (위험 낮음, 선행 작업)

**목적**: 코드 변경 전 문서 경로 정리

1. `docs/specs/lww/` → `docs/specs/fint/` git mv
2. `docs/specs/lww/.ai.md` 내 `lww` → `fint` 참조 업데이트
3. `services/lww/.ai.md`의 spec 참조 경로 `docs/specs/fint/`로 업데이트
4. `services/lww/src/app/` 내 주석/README에 spec 경로 참조 있으면 업데이트

**변경 파일**:
- `docs/specs/lww/` 전체 → `docs/specs/fint/`
- `docs/specs/fint/.ai.md`

---

### Step 2: design.md 컬러 통일

**목적**: 구버전 보라 `#7C3AED`를 Teal `#0D9488`로 전면 교체

1. `docs/specs/fint/design.md` 열기
2. `#7C3AED` 전체 검색 → `#0D9488`로 치환
3. 관련 색상 변수명/의미 설명도 Teal 기준으로 업데이트
4. 컬러 팔레트 섹션에 Teal 변형(lighter/darker) 추가:
   - Primary: `#0D9488`
   - Light: `#14B8A8`
   - Dark: `#0F766E`
   - Background tint: `#F0FDFA`

**변경 파일**: `docs/specs/fint/design.md`

---

### Step 3: storyboard.md Fint 서비스명 통일 + IA 5탭 반영

**목적**: 스토리보드 문서를 Fint 브랜드로 통일하고 ia_flow.md와 정합성 확보

1. 문서 헤더 `lww` → `Fint` 서비스명 통일
2. 5탭 IA 구조 섹션 추가 (홈/면접/마켓/커뮤니티/프로필)
3. 각 탭별 Phase 레이블 명시 (MVP/Phase1/Phase2)
4. ia_flow.md의 Mermaid 플로우 다이어그램 링크 참조 추가

**변경 파일**: `docs/specs/fint/storyboard.md`

---

### Step 4: storyboard.md Phase 2 핵심 화면 상세화

**목적**: 개발 착수 수준의 와이어프레임 레벨 명세 작성

각 화면별 상세화 내용:

#### 4-1. Aha Moment (결과 리포트 — 첫 면접 완료)
- 트리거: 첫 번째 면접 완료 직후
- 화면 요소:
  - **감정 레이어 우선**: 카운트업 전 0.5초간 "첫 면접 완료!" 헤드라인 + Teal 풀스크린 플래시 (불안 완화 후 점수 공개)
  - 총점 대형 표시 (애니메이션 카운트업, 감정 레이어 후 등장)
  - 카테고리별 점수 바 (논리력/자기표현/직무적합도/의사소통)
  - 낮은 점수 항목: 수치 대신 **"성장 여지 있음"** 마이크로카피 레이블 (숫자보다 레이블이 감정에 직접 작용)
  - "잘 하셨어요!" 실행형 피드백 3줄
  - 크레딧 획득 애니메이션 (🪙 N개)
  - CTA 구조: **메인 1개** "결과 저장하기 (로그인)" + 텍스트 링크 "다시 도전" (격하) — "공유하기"는 MBTI 카드 언락 후 맥락 노출
- 디자인 원칙: 성취감 극대화, 점수 공개 전 감정 안정화, CTA 결정 피로 제거

#### 4-2. 스트릭 메커니즘
- 화면 위치: 홈 피드 상단 배너 / 프로필 탭 / **면접 결과 리포트 하단** (행동 직후 즉각 보상)
- 화면 요소:
  - 불꽃 아이콘 + 연속 일수 표시 (예: 🔥 3일 연속)
  - 주간 달력 도트 **3단계**: 라이트 완료(연한 Teal) / 풀 면접 완료(진한 Teal) / 스트릭 리셋(빈 원)
  - 스트릭 보상 임박 알림 ("내일도 하면 7일 달성!")
  - 스트릭 깨짐 복구 아이템 (크레딧 소비, Phase 2)
  - 결과 리포트 하단 미니 배지: "오늘 스트릭 +1 적립! 🔥"
- 규칙:
  - **라이트 모드**: 면접 1문항 이상 답변 → 스트릭 유지 (진입 마찰 최소화)
  - **풀 모드**: 면접 1회(5문항) 완료 → 진한 Teal 도트
  - 자정 기준 리셋

#### 4-3. 홈 피드
- 화면 요소:
  - 상단: 크레딧 잔액 + 스트릭 미니 배지
  - 추천 피드 카드 — **타입별 시각 구분 규칙** (아이콘 색 + 좌측 컬러 바 + 태그 칩):
    - 면접 후기: Teal 바 + "후기" 칩
    - 아차 포인트: Amber 바 + "아차" 칩
    - 커뮤니티 인기글: 회색 바 + "커뮤니티" 칩
  - 인기 페르소나 가로 스크롤 섹션 — **peek 처리**: 2.5개 카드가 살짝 잘려 보이게 + "더보기 →" 화살표 (발견 가능성 확보)
  - 빠른 면접 시작 플로팅 버튼
- 빈 상태 (첫 방문):
  - "첫 면접을 시작해보세요!" CTA 전면 배치
  - 소셜 증거 문구: "이번 주 N명이 첫 면접을 완료했어요" (시작 전 불안 완화)

#### 4-4. 페르소나 마켓
- 목록 화면:
  - 직군 필터 칩 (개발/마케팅/디자인/기획/영업/기타)
  - 페르소나 카드: 아바타 + 이름 + 회사 익명 (예: "N사 개발팀장") + 평점 + 리뷰 수
  - **목록 카드에 크레딧 예고 표기**: "후기 3개 (🪙 5크레딧)" — 진입 전 기대 비용 설정, 숨겨진 비용 방지
  - 정렬: 추천순/인기순/최신순
- 상세 화면:
  - 페르소나 소개 (직군·연차·면접 스타일)
  - 면접 후기 잠금 (크레딧 소비로 열람)
  - **"이 면접관으로 면접하기" sticky bottom CTA** (스크롤해도 항상 화면 하단 고정)
  - 현직자 크레딧 분배 **절대 수치 표기**: "면접 1회당 🪙 3크레딧이 이 현직자에게 지급" (참여 동기 강화)

#### 4-5. 쪽지
- 발송 화면:
  - **입력 템플릿 3종 제안** (작성창 진입 시 노출, 선택 가능):
    - "경력 질문형": "안녕하세요! [직군] 현직자로서 ..."
    - "합격 비결형": "취업 준비 중인데 면접에서 ..."
    - "면접 팁 요청형": "면접 때 가장 중요하게 보시는 점이 ..."
  - 최대 300자 텍스트 입력
  - 크레딧 차감: **팝업 제거 → 발송 버튼 인라인 표시** "보내기 (🪙 N크레딧 차감)" + Swipe to Send (마찰 최소화 + 실수 방지)
  - 답장 기대일 안내 ("보통 2-3일 내 답장")
- 쪽지함:
  - 보낸/받은 탭 분리
  - 미읽음 뱃지
  - 3일 무응답 → 자동 알림 ("다른 현직자에게도 물어보세요!")
- 크레딧 경제:
  - 발송: N크레딧 차감
  - 현직자 답장 시: 크레딧 획득
  - **현직자 7일 내 답장 보너스**: 추가 🪙 지급 (답장률 유지 인센티브)

#### 4-6. 직무 MBTI 카드 (바이럴)
- 트리거 (단일화):
  - **기본**: 면접 3회 완료 → 무료 언락
  - **얼리 액세스**: 크레딧 소비 → 즉시 언락 (명확히 분리)
- 카드 내용:
  - **유형 타이틀 네이밍 규칙**: 4-6자 임팩트 타이틀 + 부제 (예: "냉철한 논리파 / 팩트 기반 명확형 면접러")
  - 강점/약점 2줄 요약
  - SNS 공유 최적화 이미지 (1:1 비율, Teal 배경)
- 공유:
  - 카카오스토리/인스타/링크 복사
  - **카드 하단 랜딩 링크 삽입**: "fint.app" 짧은 URL + QR (바이럴 유입 고리)
  - **인스타 스토리 딥링크**: 공유 시 Fint 계정 자동 태그 (@fint_interview)
  - 클릭 후 랜딩: 유형 소개 + "내 유형 알아보기" CTA → 앱 설치/온보딩 진입

**변경 파일**: `docs/specs/fint/storyboard.md`

---

### Step 5: Phase 2 디자인 시안 생성 (나노바나나프로 6개 이상)

**목적**: 개발 착수용 레퍼런스 이미지 생성

생성 대상 (순서, 전체 필수 7개):
1. `p2_01_aha-moment.png` — Aha Moment 결과 리포트 (감정 레이어 + 점수 카운트업 + 크레딧 획득)
2. `p2_02_home-feed-streak.png` — 홈 피드 전체 레이아웃 + 스트릭 위젯 통합 뷰 (스트릭은 홈 피드 내 컴포넌트이므로 통합)
3. `p2_03_persona-market-list.png` — 페르소나 마켓 목록 (직군 필터 + 크레딧 예고 카드)
4. `p2_04_persona-market-detail.png` — 페르소나 상세 + sticky 면접 시작 CTA
5. `p2_05_message.png` — 쪽지 작성 (템플릿 제안 + Swipe to Send) + 쪽지함
6. `p2_06_mbti-card.png` — 직무 MBTI 공유 카드 (바이럴 이미지 + 랜딩 링크)
7. `p2_07_streak-detail.png` — 스트릭 상세 뷰 (주간 달력 3단계 도트 + 프로필 탭 내)

**저장 위치**: `docs/specs/fint/designs/`
**스타일 가이드**: Teal #0D9488, Pretendard 폰트, 375px 모바일
- 1-6번(`p2_01`~`p2_04`, `p2_06`, `p2_07`): Fint 브랜드 독자 스타일 (카카오톡 레퍼런스 적용 안 함)
- `p2_05_message.png` (쪽지 화면)만 카카오톡 채팅 UI 레퍼런스 참고

**변경 파일**: `docs/specs/fint/designs/p2_*.png` (신규 생성)

---

### Step 6: services/lww/ → services/fint/ 코드 리네이밍

**목적**: 코드베이스 서비스 디렉토리 이름을 브랜드와 일치

**주의**: 가장 위험한 단계 — 모든 참조를 함께 업데이트해야 빌드 깨짐 방지

변경 목록:
1. `services/lww/` → `services/fint/` (git mv)
2. `services/fint/package.json`: `"name": "lww"` → `"name": "fint"`
3. `services/fint/next.config.ts` (또는 `.mjs`): 프로젝트명 참조
4. `services/fint/Dockerfile`: WORKDIR, COPY 경로
5. `.github/workflows/` 내 `lww` 참조 → `fint`
6. 루트 `package.json` workspaces 항목 업데이트 (있는 경우)
7. `engine/.ai.md` 내 서비스 참조 (있는 경우)
8. `AGENTS.md` 내 `services/lww` 참조 → `services/fint`
9. `docs/work/active/000194-fint-rename-storyboard/` 내 경로 참조

**변경 파일**: 위 목록 전체

---

### Step 7: services/fint/.ai.md 최신화

**목적**: 리네이밍 및 Phase 2 계획 반영

1. 서비스명 `lww` → `Fint` 전면 교체
2. 관련 스펙 경로 `docs/specs/lww/` → `docs/specs/fint/`
3. Phase 2 핵심 기능 목록 추가
4. 브랜드 컬러 Teal #0D9488 확정 명시 (이미 있음, 확인만)

**변경 파일**: `services/fint/.ai.md`

---

### Step 8: Playwright E2E 경로 업데이트

**목적**: 리네이밍 후 E2E 테스트 경로 정합성 확보

1. `services/fint/playwright.config.ts`: 경로 참조 확인 (포트 3002 유지)
2. `services/fint/tests/e2e/` 내 import 경로 확인
3. CI/CD workflow의 `cd services/lww` → `cd services/fint` 업데이트
4. E2E 테스트 실행 확인 (smoke test)

**변경 파일**:
- `.github/workflows/` 관련 파일
- `services/fint/tests/e2e/` (경로 참조만, 로직 변경 없음)

---

## 실행 순서 (의존성)

```
Step 1 (docs 이동)
  → Step 2 (design.md 컬러)
  → Step 3+4 (storyboard 업데이트)
  → Step 5 (디자인 시안 생성)  ← Step 3+4 완료 후
Step 6 (코드 리네이밍)           ← Step 1 완료 후 독립 실행 가능
  → Step 7 (.ai.md)
  → Step 8 (E2E)
```

Step 1–5 (문서/디자인)와 Step 6–8 (코드)는 병렬 진행 가능.

---

## 위험 요소 및 대응

| 위험 | 가능성 | 대응 |
|------|--------|------|
| git mv 후 빌드 깨짐 | 중 | Step 6 후 즉시 `npm run build` 검증 |
| CI workflow 경로 누락 | 중 | grep으로 `lww` 전수 검색 후 업데이트 |
| 스토리보드 너무 추상적 | 낮음 | ia_flow.md Task 플로우를 직접 참조 |
| 디자인 시안 품질 낮음 | 낮음 | 나노바나나프로 상세 프롬프트 + Teal 팔레트 명시 |

---

## storyboard.md 작성 시 반영 필수 사항

Step 3+4에서 storyboard.md를 작성할 때 아래 명세를 반드시 포함한다:

1. **Aha Moment**: "결과 저장하기" CTA 탭 후 비로그인 처리 플로우 — bottom sheet 방식으로 로그인 옵션 제공 (별도 페이지 이동 없음), 로그인 전 결과 데이터는 sessionStorage 유지
2. **Aha Moment**: 카테고리 점수 바 **내림차순 정렬** 원칙 — 높은 항목 → 낮은 항목 순 (성취감 극대화)
3. **스트릭**: 스트릭 깨짐 복구 모달 최소 명세 — 크레딧 차감액 표시 + 복구/취소 버튼
4. **홈 피드**: FAB(면접 시작) 위치 규칙 — 우하단 고정, 하단 탭 바 기준 +16px 상단, 쪽지 뱃지와 겹침 방지
5. **홈 피드**: 페르소나 가로 스크롤 카드 너비 — 160px (375px 기준), peek 노출량 20px
6. **페르소나 상세**: 크레딧 부족 시 sticky CTA 상태 변화 — "🪙 부족 — 충전하기"로 대체 (비활성화 금지)
7. **쪽지**: Swipe to Send 명세 — 우→좌 방향, 70% 이상 스와이프 시 발송 확정, 미만은 원위치 복귀
8. **쪽지**: 입력 템플릿 선택 후 텍스트 입력창에 자동 삽입 + **직접 편집 가능** (readonly 아님)

---

## 검증 방법

1. `grep -r "services/lww" .` → 0건 (리네이밍 완료)
2. `grep -r "#7C3AED" docs/specs/fint/` → 0건 (컬러 통일)
3. `cd services/fint && npm run build` → 0 errors
4. `cd services/fint && npx playwright test` → 3/3 PASS
5. `ls docs/specs/fint/designs/p2_*.png | wc -l` → 7 이상
