# feat: [siw] 랜딩페이지 페르소나 섹션 하단에 면접 모드(실전/연습) 소개 추가

## 사용자 관점 목표
랜딩페이지에서 MirAI가 실전 모드와 연습 모드 두 가지를 제공한다는 것을 가입 전에 알 수 있다.

## 배경
현재 랜딩페이지 페르소나 섹션(#personas)에 3인 면접관 소개만 있고, 면접 모드(실전/연습) 설명이 없다.
`interview/new/page.tsx`에 이미 모드 선택 UI가 있으므로, 동일한 디자인 톤으로 랜딩페이지에 소개 섹션을 추가한다.

### 참고 UI
- 실전 모드: "면접처럼 진행, 즉각 피드백 없음"
- 연습 모드: "즉각 AI 피드백, 재답변 가능"
- 디자인 기준: `services/siw/src/app/(app)/interview/new/page.tsx` 모드 선택 카드 (line 198~221)

## 완료 기준
- [x] 랜딩페이지 페르소나 섹션 하단에 실전 모드·연습 모드 소개 카드 2개 추가
- [x] `interview/new/page.tsx`의 모드 선택 디자인 톤과 일관성 유지
- [x] 기존 FadeInSection 애니메이션 적용

## 구현 플랜

**1단계:** `services/siw/src/app/(landing)/page.tsx`의 PERSONAS 섹션(#personas, line 330~373) 하단에 면접 모드 소개 카드 추가
- INTERVIEW_MODES 데이터 배열 추가 (실전/연습)
- 2열 그리드 카드 렌더링 (FadeInSection 래핑)

## 수정 파일 목록

| 파일 | 변경 내용 |
|------|---------|
| `services/siw/src/app/(landing)/page.tsx` | 페르소나 섹션 하단에 면접 모드 소개 추가 |

## 개발 체크리스트
- [x] 테스트 코드 포함
- [x] 해당 디렉토리 .ai.md 최신화
- [x] 불변식 위반 없음

---

## 작업 내역

### 2026-03-25

**현황**: 3/3 완료

**완료된 항목**:
- [x] 랜딩페이지 페르소나 섹션 하단에 실전 모드·연습 모드 소개 카드 2개 추가
- [x] `interview/new/page.tsx`의 모드 선택 디자인 톤과 일관성 유지
- [x] 기존 FadeInSection 애니메이션 적용

**미완료 항목**:
- (없음)

**변경 파일**: 3개

- `services/siw/src/app/(landing)/page.tsx` — `INTERVIEW_MODES` 상수 배열 추가(line 70~88), PERSONAS 섹션 하단에 FadeInSection으로 래핑된 모드 소개 카드 2열 그리드 삽입(line 391~415). `interview/new/page.tsx`와 동일한 indigo/violet 색상 체계·copy 사용. `cursor-pointer` 제거(비인터랙티브). `key={m.title}` 사용.
- `services/siw/tests/ui/landing-page.test.tsx` — 실전 모드·연습 모드 카드 렌더링 테스트 2개 추가(line 67~78). desc 텍스트 assert로 copy drift 방지.
- `services/siw/src/app/(landing)/.ai.md` — PERSONAS 섹션 설명, INTERVIEW_MODES 상수, 테스트 개수(6→8) 최신화.
