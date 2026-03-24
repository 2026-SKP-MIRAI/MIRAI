# lww 스토리보드 확장 계획 — Phase MVP → Phase 3

> 작성: 2026-03-21 (복원: 2026-03-22)
> 목적: 이슈 #187 디자인 시안 생성 범위 및 storyboard.md 확장 로드맵

---

## 화면 목록 (총 23개)

### Phase MVP (4개 화면) — 기존 구현 완료

| # | 화면명 | 라우트 | 시안 파일 |
|---|--------|--------|-----------|
| 01 | 온보딩 슬라이더 | `/` | `v2_01_onboarding.png` |
| 02 | 직군 선택 | `/onboarding` | `v2_02_job-select.png` |
| 03 | 채팅 면접 | `/interview/[id]` | `v2_03_chat-interview.png` |
| 04 | 결과 리포트 | `/report/[id]` | `v2_04_report.png` |

### Phase 1 (7개 화면) — 소셜 로그인 + 자소서 + 코인

| # | 화면명 | 라우트 | 시안 파일 |
|---|--------|--------|-----------|
| p1_01 | 로그인 (소셜+이메일) | `/login` | `p1_01_login.png` |
| p1_02 | 면접 히스토리 탭 | `/interview` | `p1_02_history.png` |
| p1_03 | 자소서 업로드 | `/resume` | `p1_03_resume.png` |
| p1_04 | 비로그인 완료 후 가입 유도 | (모달/배너) | `p1_04_save-cta.png` |
| p1_05 | 프로필 / 마이페이지 | `/profile` | `p1_05_profile.png` |
| p1_06 | 크레딧 현황 | `/credits` | `p1_06_credits.png` |
| p1_07 | 알림 설정 | `/settings` | `p1_07_settings.png` |

### Phase 2 (8개 화면) — 커뮤니티 + 페르소나 마켓

| # | 화면명 | 라우트 | 시안 파일 |
|---|--------|--------|-----------|
| p2_01 | 피드 (커뮤니티) | `/feed` | `p2_01_feed.png` |
| p2_02 | 게시물 상세 | `/feed/[id]` | `p2_02_post-detail.png` |
| p2_03 | 페르소나 마켓 목록 | `/market` | `p2_03_market.png` |
| p2_04 | 페르소나 상세 | `/market/[id]` | `p2_04_persona-detail.png` |
| p2_05 | 현직자 연결 요청 | (모달) | `p2_05_mentor-request.png` |
| p2_06 | 쪽지함 | `/messages` | `p2_06_messages.png` |
| p2_07 | 쪽지 대화 | `/messages/[id]` | `p2_07_message-thread.png` |
| p2_08 | 랭킹/리더보드 | `/ranking` | `p2_08_ranking.png` |

### Phase 3 (4개 화면) — 채용 매칭

| # | 화면명 | 라우트 | 시안 파일 |
|---|--------|--------|-----------|
| p3_01 | 채용 공고 목록 | `/jobs` | `p3_01_jobs.png` |
| p3_02 | 채용 공고 상세 | `/jobs/[id]` | `p3_02_job-detail.png` |
| p3_03 | 지원 현황 | `/applications` | `p3_03_applications.png` |
| p3_04 | 기업 프로필 | `/company/[id]` | `p3_04_company.png` |

---

## 디자인 원칙 (시안 생성 시 적용)

- **브랜드 컬러**: Teal `#0D9488` (Primary), `#CCFBF1` (Light), `#0F766E` (Dark)
- **폰트**: Pretendard (sans-serif)
- **스타일**: Flat clean minimal UI, no illustrations, pure interface design
- **모바일 기준**: 375×812px
- **배경**: 흰색 `#FFFFFF` 또는 연회색 `#F9FAFB`
- **프롬프트 주의**: px 수치·컬러 코드·기술 명세를 프롬프트에 직접 쓰지 않는다 (모델이 UI 텍스트로 렌더링함)

---

## 작업 내역

### 2026-03-21 — v1, v2 시안 생성

**v1 생성 (4개)**:
- `01_onboarding.png`, `02_job-select.png`, `03_chat-interview.png`, `04_report.png`
- 문제: "AI slop" 느낌, 일러스트 과다, 직군 태그 중복, 기술 명세(px, 컬러 코드)가 UI 텍스트로 렌더링됨

**디자이너 에이전트 분석**:
- 온보딩: 일러스트 제거, 텍스트 계층 구조 개선 필요
- 직군 선택: 칩 크기 균일화, 중복 태그 제거
- 채팅: 버블 간격·타이포 개선
- 리포트: 점수 시각화 강화

**v2 생성 (4개)**:
- `v2_01_onboarding.png`, `v2_02_job-select.png`, `v2_03_chat-interview.png`, `v2_04_report.png`
- 개선: "Flat clean minimal UI, no illustrations" 프롬프트 추가
- 미해결: px 수치 렌더링 이슈 (프롬프트 기술 명세 제거 필요)

**px 단위 반응형 확인**:
- flex/grid/w-full로 반응형 처리하므로 시안의 px 수치는 참고용으로만 사용

### 2026-03-22 — 워크트리 복원

- 워크트리 소멸로 미커밋 파일 유실
- 01_plan.md, 02_storyboard-plan.md, generate_image_or.py 재작성
- designs/ 폴더 재생성 필요
