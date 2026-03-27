# [#302] 데모 모드 전면 디벨롭 — 테스트 계획

> 작성: 2026-03-27

---

## 자동화 테스트

### evaluate.test.ts (기존 + 수정)

**파일**: `services/siw/src/app/api/demo/__tests__/evaluate.test.ts`

| 테스트 케이스 | 검증 항목 | 상태 |
|---|---|---|
| mock axisFeedbacks 8개 반환 | `data.axisFeedbacks.length === 8` | ✅ 통과 |
| 엔진 계약 준수 | 모든 8축(communication, leadership, problemSolving, logicalThinking, jobExpertise, cultureFit, creativity, sincerity) 포함 | ✅ 통과 |

**실행 방법**:
```bash
cd services/siw
node_modules/.bin/vitest run src/app/api/demo/__tests__/evaluate.test.ts
```

---

## 수동 검증 체크리스트

### 1. 동적 상위 3축 표시

- [ ] 데모 완료 후 피드백 카드에 3개 축만 표시
- [ ] 표시된 3개 축이 가장 높은 점수 순으로 정렬됨
- [ ] 강점/개선점 카드도 동일 3축 기준으로 필터링됨
- [ ] evaluation 없을 때 플레이스홀더(회색 빈 카드) 표시

### 2. AbortController (fetch 취소)

- [ ] 질문 로딩 중 뒤로가기 → 브라우저 콘솔에 에러 없음
- [ ] 답변 제출 로딩 중 뒤로가기 → 콘솔에 에러 없음
- [ ] 정상 완료 시 결과 표시 (취소 없는 경우)

### 3. 모바일 반응형 (DevTools 390px viewport)

- [ ] 결과 섹션: 1컬럼 스택 (점수 그리드 → 레이더 차트 순서)
- [ ] 점수 숫자 폰트: ~48px (모바일), ~80px (데스크탑 1280px)
- [ ] 레이더 차트 overflow 없음 (가로 스크롤 미발생)
- [ ] 레이더 오버레이 팝업 텍스트 잘리지 않음
- [ ] 탭 버튼(총평/개선점) 터치 영역 충분 (44px+)
- [ ] 직무 선택 버튼 칩 정상 표시
- [ ] CTA 버튼 세로 스택 (모바일), 가로 나열 (sm: 이상)

### 4. 데스크탑 레이아웃 회귀 없음 (1280px viewport)

- [ ] 결과 섹션: 2컬럼 (레이더 | 점수 그리드)
- [ ] 점수 숫자 80px 유지
- [ ] 레이더 최대 420px 유지
- [ ] 전체 패딩 p-8 유지

### 5. 회원가입 UI

- [ ] `/signup` 페이지 접속
- [ ] 이용약관 체크박스 옆 "*필수" 텍스트 없음
- [ ] 개인정보처리방침 체크박스 옆 "*필수" 텍스트 없음
- [ ] 체크 없이 가입 시도 → 필수 검증 에러 여전히 표시 (기능 유지)

### 6. 비개발 직군 질문 도메인 적합성

- [ ] "바리스타"로 데모 시작 → 소프트웨어 관련 질문 미생성
- [ ] "마케터"로 데모 시작 → 마케팅 도메인 질문 생성
- [ ] "프론트엔드 개발자"로 데모 시작 → 개발 관련 질문 생성 (회귀 없음)

---

## 회귀 테스트

```bash
# services/siw 전체 테스트
cd services/siw && node_modules/.bin/vitest run

# engine 테스트 (프롬프트 변경 영향 없음 — 텍스트 파일만 수정)
cd engine && python -m pytest
```

**예상 결과**: 전체 통과, 신규 실패 없음
