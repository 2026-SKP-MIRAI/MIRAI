# [#231] feat: [siw] 면접 기록 섹션 스크롤 추가 — 구현 계획

> 작성: 2026-03-25

---

## 완료 기준

### A. 이력서 상세 페이지 (`resumes/[id]/page.tsx`)
- [ ] 면접 기록 리스트 컨테이너에 `max-h` + `overflow-y-auto` 적용하여 일정 높이 초과 시 내부 스크롤
- [ ] `max-h` 값은 8축 역량 평가 섹션의 콘텐츠 영역 높이와 시각적으로 동일하게 설정
- [ ] 스크롤바 스타일 적용 (`scrollbar-thin`, 브랜드 컬러 또는 gray 계열)
- [ ] 활성 뱃지: `bg-emerald-100 text-emerald-800` → `border border-emerald-500 text-emerald-600 bg-transparent`
- [ ] 삭제 버튼: `bg-red-50 hover:bg-red-100 text-red-600` → `border border-red-400 text-red-500 hover:bg-red-50 bg-transparent`
- [ ] "성장 추이" 섹션 (`-7점 향상` 뱃지 포함) 삭제

### B. 대시보드 페이지 (`dashboard/page.tsx`)

#### B-1. 최근 면접 기록 섹션
- [ ] 5개 제한 제거 → 전체 면접 기록 출력
- [ ] 영역 초과 시 내부 스크롤로 볼 수 있도록 `max-h` + `overflow-y-auto` 적용
- [ ] 면접 이름 표시 변경: `"N번째 면접"` → 면접에 사용된 자소서 이름으로 출력

#### B-2. 이력서 카드 정보 표시 수정
- [ ] 이력서 카드 하단 (`자소서_004_개발자.pdf` 영역): 파일명 대신 이력서 분석 후 추출된 **직무명** 출력
- [ ] 이력서 카드 날짜 영역 (`3월 25일`): 날짜 대신 **이력서 이름** 출력
- [ ] 이력서 카드 설명 영역 (`엑스솔콥코리아 / 모빌리티 & 금융 SI / 2025 …`): 회사·직무 텍스트 대신 **면접 본 날짜** 출력

### C. 랜딩페이지 8축 이름 엔진 기준 정렬
- [ ] 랜딩페이지 8축 이름을 엔진 기준의 한글명으로 변경
- [ ] 각 축의 퍼센트 가중치 표시 제거
- [ ] `RadarChartInteractive.tsx`의 AXES 데이터 수정
- [ ] `page.tsx`의 EVALUATION_AXES 데이터 수정

---

## 구현 계획

> Planner → Architect → Critic 합의 완료 (2026-03-25)
> 접근 방식: Option A (직접 인라인 수정), B-2는 growth/page.tsx 대상으로 확정

### Step 1: 이력서 상세 페이지 — 성장 요약 삭제 + 활성 뱃지
**File:** `services/siw/src/app/(app)/resumes/[id]/page.tsx`

- **1a. "성장 요약" 섹션 삭제 (lines 292-333)**
  - "성장 요약" `<motion.div>` 블록 전체 삭제
  - AC의 "성장 추이 삭제"에 해당 (점수 비교 뱃지 +N점/-N점 포함)
- **1b. 활성 뱃지 스타일 변경 (line 133)**
  - `bg-emerald-100 text-emerald-800` → `border border-emerald-500 text-emerald-600 bg-transparent`

### Step 2: 이력서 목록 페이지 뱃지/버튼 스타일 변경
**File:** `services/siw/src/app/(app)/resumes/page.tsx`

- **2a. 활성 뱃지 (line 96)**
  - `bg-emerald-100 text-emerald-800` → `border border-emerald-500 text-emerald-600 bg-transparent`
- **2b. 삭제 버튼 (line 122)**
  - `bg-red-50 hover:bg-red-100 text-red-600` → `border border-red-400 text-red-500 hover:bg-red-50 bg-transparent`

### Step 3: 대시보드 면접 기록 개선 (B-1)
**File:** `services/siw/src/app/(app)/dashboard/page.tsx`

- **3a. 5개 제한 제거 + 스크롤 (line 148)**
  - `sessions.slice(0, 5)` → `sessions`
  - 컨테이너에 `max-h-[320px] overflow-y-auto` 추가
  - globals.css 기존 webkit scrollbar 스타일 자동 적용
- **3b. 면접 이름 변경 (line 158)**
  - `{i + 1}번째 면접` → `{s.resumeLabel || "이력서"}`

### Step 3.5: growth 페이지 면접 기록 카드 정보 변경 (B-2)
**File:** `services/siw/src/app/(app)/growth/page.tsx` (lines 288-305)

현재 면접 기록 버튼 구조:
- 날짜 (`formatDate(s.createdAt)`) — "3월 25일"
- 설명 (`s.resumeLabel`) — "엑스솔콥코리아 / 모빌리티 & 금융 SI / 2025 …"

AC 요구사항:
- **3.5a. 날짜 → 이력서 이름**: `formatDate(s.createdAt)` → `s.resumeLabel` (이력서 이름 출력)
- **3.5b. 설명 → 면접 본 날짜**: `s.resumeLabel` → `formatDate(s.createdAt)` (면접 날짜 출력)
  - 즉, 날짜와 이력서 이름의 위치를 **스왑**
- **3.5c. 파일명 → 직무명**: `resume.inferredTargetRole` 필드 활용 필요
  - GrowthSession 타입에 직무명 필드가 없으므로, API 응답에 포함되는지 확인 또는 resumeLabel에서 추출 가능한지 확인
  - `resumes/[id]/page.tsx:143`에서 `resume.inferredTargetRole`로 "희망 직무" 표시 중
  - GrowthSession에 `inferredTargetRole` 추가하거나, resumeLabel의 첫 번째 슬래시 앞 텍스트(회사명)를 직무명으로 대체하는 방안 검토

> **참고**: resumeLabel 형식이 `"회사명 / 직무명 / 채용시기\n학교..."` 구조이므로, 직무명은 두 번째 슬래시 구간에서 추출 가능할 수 있음

### Step 4: 랜딩페이지 8축 이름 엔진 기준 정렬
**Files:**
- `services/siw/src/components/landing/RadarChartInteractive.tsx` (lines 5-14, 58)
- `services/siw/src/app/(landing)/page.tsx` (lines 72-81)

- **4a. AXES 수정** — name을 엔진 기준으로 변경, weight 제거, desc 새로 작성:
  - 의사소통 / 문제해결 / 논리적 사고 / 직무 전문성 / 조직 적합성 / 리더십 / 창의성 / 성실성
- **4b. AxisRow weight 렌더링 삭제** (line 58)
- **4c. EVALUATION_AXES 동일 수정**

### Dependencies
```
Step 1   ─┐
Step 2   ─┤─ 모두 독립적, 병렬 실행 가능
Step 3   ─┤
Step 3.5 ─┤
Step 4   ─┘
```

### Edge Cases
1. weight 참조 제거 시 TS 컴파일 에러 확인
2. resumeLabel 빈 값 fallback 처리
3. 반응형 max-h 값 모바일 적절성 확인
4. landing page.tsx의 weight 렌더링(lines 399-401)도 함께 제거

### Follow-ups
- 8축 공유 상수 추출 이슈 생성
