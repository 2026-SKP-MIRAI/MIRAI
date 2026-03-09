# [#38] feat: seung 서비스 MVP 01 구현 — 자소서 업로드 → 질문 생성 end-to-end — 구현 계획

> 작성: 2026-03-09

---

## 완료 기준

- [ ] `services/seung/` 자율 설계로 프로젝트 구조 초기화 (DDD 기반 권장)
- [ ] Next.js API 라우트: `POST /api/resume/questions` → 엔진 HTTP 호출 → 응답 전달
- [ ] 업로드 UI: PDF 선택, "질문 생성" 버튼, 로딩 상태 (idle→uploading→processing→done/error)
- [ ] 결과 UI: 카테고리별 질문 리스트, "다시 하기" 버튼
- [ ] 에러 처리: 400/422/500 한국어 안내
- [ ] Vitest 단위 테스트 포함 (API 라우트 + UI 컴포넌트)
- [ ] `services/seung/.ai.md` 최신화 (구조·진행 상태 반영)
- [ ] 불변식 준수: `services/seung/`에 `import anthropic` / `import fitz` 없음

---

## 구현 계획

(작성 예정)
