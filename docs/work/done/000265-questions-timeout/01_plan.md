# [#265] chore: 이력서 질문 생성 타임아웃 체인 버그 수정 — 구현 계획

> 작성: 2026-03-26

---

## 배경

이력서 질문 생성 엔드포인트의 타임아웃 체인이 잘못 설정되어 있었다:
- 엔진 LLM 타임아웃: 30s
- 서비스 fetch AbortSignal.timeout: 30s (엔진과 동일)
- Next.js maxDuration: 35s

엔진 타임아웃과 fetch abort timeout이 동일하므로, 어느 쪽이 먼저 발동하든 서비스 레벨에서 에러를 파싱하지 못하고 망가진 응답을 받거나 직접 abort된다.

올바른 체인: `engine(30s) < fetch(55s) < maxDuration(60s)`

## 완료 기준

- [x] Next.js `maxDuration` 35 → 60으로 증가
- [x] parse/questions fetch `AbortSignal.timeout` 30000 → 55000ms로 증가
- [x] 타임아웃 체인 보장: engine(30s) < service fetch(55s) < maxDuration(60s)

---

## 구현 계획

### 변경 대상

| 파일 | 변경 내용 |
|------|-----------|
| `services/siw/src/app/api/resume/questions/route.ts` | maxDuration 35→60, AbortSignal.timeout 30000→55000 (parse·questions 양쪽) |

### 구현 상세

**route.ts:**
```typescript
export const maxDuration = 60; // 35에서 변경

// parse fetch
signal: AbortSignal.timeout(55000), // 30000에서 변경

// questions fetch
signal: AbortSignal.timeout(55000), // 30000에서 변경
```

엔진 `llm_service.py`는 다른 서비스에서도 공유하므로 변경하지 않는다. 엔진 타임아웃(30s)이 fetch abort(55s)보다 먼저 발동하여 에러 응답을 반환하므로 서비스 레벨에서 정상 에러 처리 가능.

### 타임아웃 계층 역할
1. **engine(30s)**: LLM이 30s 안에 응답 없으면 에러 반환
2. **fetch abort(55s)**: 엔진이 정상 에러를 반환하면 30s에 수신. 엔진이 멈추면 55s에 abort
3. **maxDuration(60s)**: Next.js Vercel 함수 최대 실행 시간 안전망
