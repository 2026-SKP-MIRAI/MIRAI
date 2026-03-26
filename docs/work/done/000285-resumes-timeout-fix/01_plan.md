# [#285] fix: [siw] /api/resumes questions fetch 타임아웃 버그 수정 — 구현 계획

> 작성: 2026-03-26

---

## 완료 기준

- [ ] resumes/route.ts questions fetch AbortSignal.timeout 30000 → 55000
- [ ] resumes/route.ts feedback fetch AbortSignal.timeout 35000 → 55000
- [ ] 타임아웃 체인 보장: engine(30s) < service fetch(55s) < ALB(300s)

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/api/resumes/route.ts` | questions fetch AbortSignal.timeout 30000→55000, feedback fetch 35000→55000 |
| `services/siw/src/app/api/resumes/.ai.md` | 신규 생성 — 디렉토리 목적·구조·타임아웃 체인 기술 |

### 타임아웃 계층 역할
1. **engine(30s)**: LLM이 30s 안에 응답 없으면 에러 반환
2. **fetch abort(55s)**: 엔진이 정상 에러를 반환하면 30s에 수신. 엔진이 멈추면 55s에 abort
3. **ALB(300s)**: AWS ALB idle timeout 안전망
