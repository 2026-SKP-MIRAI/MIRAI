# 이슈 #302 탐색 요약

**작성일**: 2026-03-27  
**탐색 범위**: 데모 모드 8축 → 기술팀장 평가 축 변경

---

## 1️⃣ 불일치 확인됨

| 항목 | 현재 | 기술팀장 | 상태 |
|------|------|---------|------|
| **Demo 표시 축** | communication, cultureFit, sincerity | jobExpertise, problemSolving, logicalThinking | ❌ 불일치 |
| **축의 성격** | HR/경영진 영역 | 기술 역량 중심 | 완전히 다름 |

---

## 2️⃣ 근본 원인 (2가지)

### 원인 1: 엔진이 페르소나 정보를 받지 않음
- **파일**: `engine/app/services/report_service.py`
- **문제**: `_apply_rubric()` 함수가 항상 8축 모두 계산
- **영향**: 페르소나별 축 필터링 불가능

### 원인 2: 서비스에서 persona 정보를 엔진에 전달하지 않음
- **파일**: `services/siw/src/app/api/demo/evaluate/route.ts`
- **문제**: 엔진 호출 시 `persona` 메타데이터 미포함
- **영향**: 엔진이 persona 정보를 알 수 없음

---

## 3️⃣ 변경 필요 파일 (6개)

### [높음] 필수 수정 (2개)
```
1. engine/app/services/report_service.py
   - persona 정보 수신 → 축 필터링 로직 추가
   
2. engine/app/prompts/report_evaluation_v2.md
   - 페르소나별 평가 기준 동적화
```

### [중간] 연결/렌더링 (2개)
```
3. services/siw/src/app/api/demo/evaluate/route.ts
   - persona 정보를 엔진에 전달
   
4. services/siw/src/components/ReportResult.tsx
   - 페르소나별 축 필터링 렌더링 (선택적)
```

### [낮음] 테스트 (2개)
```
5. services/siw/src/app/api/demo/__tests__/evaluate.test.ts
   - 8축 검증 → 3축 검증으로 수정
   
6. engine/tests/unit/services/test_report_service.py
   - 페르소나별 축 필터링 테스트 추가
```

---

## 4️⃣ 기술팀장 평가 축 (확정)

```json
{
  "tech_lead": [
    "jobExpertise",      // 직무 전문성
    "problemSolving",    // 문제해결
    "logicalThinking"    // 논리적 사고
  ]
}
```

**출처**: `engine/app/prompts/interview_followup_tech_lead_v3.md` (라인 7)

---

## 5️⃣ 권장 구현 전략

### ✅ 옵션 B: 엔진에서 필터링 (권장)

**이유**:
1. 설계 원칙: 페르소나별 평가 기준 = 엔진의 책임
2. 재사용성: 다른 서비스도 활용 가능
3. 유지보수: 페르소나 추가 시 엔진 한 곳만 수정

**구현 단계**:
```
Step 1: 엔진 수정 (report_service.py)
   ├─ ReportRequest 스키마에 personas 추가
   ├─ _apply_rubric() 함수 수정
   └─ _parse_report_v2() 함수 수정

Step 2: 프롬프트 수정 (report_evaluation_v2.md)
   ├─ {personas} 템플릿 변수 추가
   └─ 평가 기준 동적화

Step 3: 서비스 연결 (evaluate/route.ts)
   └─ 엔진 호출 시 personas 정보 전달

Step 4: 테스트 업데이트
   ├─ 테스트 케이스 3축으로 수정
   └─ 신규 테스트 추가
```

---

## 6️⃣ 데이터 흐름

### 현재 (불일치)
```
Demo /api/question
  ↓ personas: ["tech_lead"] ✓
engine /api/interview/start
  ↓
User answers
  ↓
Demo /api/evaluate
  ↓ personas 정보 없음 ✗
engine /api/report/generate
  ↓
8축 모두 계산 ✗
  ↓
ReportResponse (8축)
  ↓
Demo: 3축 필터링, ReportResult: 8축 표시
```

### 목표 (일관성)
```
Demo /api/evaluate
  ↓ personas: ["tech_lead"] ✓
engine /api/report/generate
  ↓
3축만 계산 (jobExpertise, problemSolving, logicalThinking)
  ↓
ReportResponse (3축)
  ↓
Demo & ReportResult: 3축 표시 ✓
```

---

## 7️⃣ 완전한 문서

- **탐색 결과**: `docs/work/active/000302-siw-demo-axis/02_exploration.md`
  - 7개 섹션, 각 파일의 코드 라인 번호 포함
  - 구현 체크리스트, 추천 전략 포함

---

## 📋 다음 단계

1. ✅ 탐색 완료 (이 문서)
2. 🔄 구현 계획 수립 (01_plan.md 업데이트)
3. 🔨 구현 시작 (옵션 B 기반)
4. 🧪 테스트 작성 및 검증
5. ✓ 완료 및 병합

