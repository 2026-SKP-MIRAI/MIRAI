# fix: [seung] next build 실패 — Prisma.JsonObject 타입 오류 (resume/feedback/route.ts)

## 목적
`next build` 실패 원인인 `Prisma.JsonObject` 타입 오류를 제거하여 CI/배포 파이프라인이 정상 동작하도록 한다.

## 배경
이슈 #121 작업 중 `next build` 실패가 확인됐다. 실패 원인은 `@prisma/client` v6에서 `Prisma.JsonObject` TypeScript 타입이 제거된 것으로, `src/app/api/resume/feedback/route.ts` 89번 줄에서 해당 타입을 사용 중이어서 빌드가 타입 오류로 실패한다. #121 변경 파일과 무관한 pre-existing 오류이므로 별도 이슈로 분리한다.

```ts
// 현재 (오류)
data: { diagnosisResult: data as Prisma.JsonObject }

// 수정 후
data: { diagnosisResult: data as Record<string, unknown> }
```

81번 줄에서 이미 `typeof data !== 'object' || data === null || Array.isArray(data)` 검증을 통과한 상태이므로 `Record<string, unknown>` 캐스팅은 타입적으로도 정확하고, 런타임 동작은 완전히 동일하다. DB 스키마 변경 없음, API 계약 변경 없음.

## 완료 기준
- [x] `src/app/api/resume/feedback/route.ts`에서 `Prisma.JsonObject` → `Prisma.InputJsonValue`으로 교체 (v6 네이티브 타입)
- [x] `import { Prisma }` 유지 (`InputJsonValue` 사용으로 필요)
- [x] `next build` 성공 확인
- [x] 기존 Vitest 94개 회귀 없음

## 구현 플랜
1. `src/app/api/resume/feedback/route.ts` 89번 줄 타입 캐스팅 수정
2. `Prisma` import 잔여 사용처 없으면 제거
3. `next build` 로컬 실행하여 통과 확인
4. Vitest 전체 실행하여 회귀 없음 확인

## 개발 체크리스트
- [x] 해당 디렉토리 `.ai.md` 최신화

---

## 작업 내역

### `services/seung/src/app/api/resume/feedback/route.ts`

`@prisma/client` v6에서 `Prisma.JsonObject` 타입이 제거됨에 따라 빌드가 실패하던 89번 줄을 수정했다.
처음에는 이슈 명세대로 `Record<string, unknown>`으로 교체했으나, `prisma generate` 후 TypeScript가 Prisma `Json` 필드의 write 타입(`InputJsonValue`)과 불호환임을 감지했다. `Prisma.InputJsonValue`가 v6에서 공식 제공됨을 확인하고 최종적으로 이 타입으로 교체했다. `import { Prisma }` 는 `InputJsonValue` 사용으로 유지.

### `services/seung/src/app/api/resume/questions/route.ts`

빌드 중 추가로 발견된 암시적 `any` 타입 오류를 수정했다. `prisma.resume.create().catch((err)` → `catch((err: unknown)`으로 명시적 타입 부여.

### 검증

- `next build` 성공 (TypeScript 컴파일 + 17 페이지 정적 생성)
- Vitest 94개 전체 통과 (회귀 없음)

