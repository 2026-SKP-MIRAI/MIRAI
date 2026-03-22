# chore: [lww] 발표용 기획서 + 발표 동영상 제작 (PPTX → Remotion + TTS)

## 목적
lww 서비스 기획서를 발표용 PPTX로 정리하고, Remotion + TTS로 영상 발표자료를 제작한다. 기존 proposal.md는 내용이 충실하지만 발표용으로 읽기 어려워 재구조화가 필요하다.

## 배경
현재 `docs/whitepaper/lww/proposal.md` 존재하지만 발표용으로는 난잡한 구조. AI로 핵심 메시지 중심의 발표 자료를 만들고, Remotion 애니메이션 + TTS 나레이션으로 영상까지 완성한다.

## 완료 기준
- [ ] 발표용 PPTX 생성 (lww Teal #0D9488 브랜드 적용, 10~15슬라이드)
- [ ] 포함 내용: 서비스 개요·슬로건, 시장 규모, 경쟁사 포지셔닝, 차별점, 수익 모델, AARRR, 로드맵
- [ ] 슬라이드별 삽화 생성 (나노바나나프로 — Gemini 3 Pro Image via OpenRouter API)
- [ ] Remotion 프로젝트로 슬라이드 애니메이션 컴포넌트 제작
- [ ] TTS 나레이션 스크립트 생성 + 음성 합성 (OpenAI TTS 또는 ElevenLabs)
- [ ] 최종 발표 동영상 렌더링 (MP4)

## 구현 플랜
### Phase A — PPTX
1. 기존 proposal.md 재구조화 — 핵심 메시지 추출, 슬라이드 구성안 작성
2. `pptx` 스킬로 PPTX 생성 (lww 브랜드 컬러 적용)
3. `docs/whitepaper/lww/` 저장 후 검토

### Phase A-1 — 삽화 생성
4. 슬라이드별 삽화 프롬프트 작성
5. 나노바나나프로 (Gemini 3 Pro Image via OpenRouter API)로 삽화 생성
6. PPTX에 삽화 삽입

### Phase B — Remotion + TTS 영상
7. Remotion 프로젝트 초기화 (`npx create-video@latest`)
8. 슬라이드별 React 컴포넌트 제작 (Remotion showcase 스타일 참고) + 나노바나나프로 삽화 활용
9. 슬라이드별 나레이션 스크립트 작성 → TTS 음성 합성
10. Remotion `<Audio>` + 자막 컴포넌트 연동
11. `npx remotion render`로 MP4 렌더링

## 참고
- Remotion showcase: https://www.remotion.dev/showcase
- 나노바나나프로: `openclaw-openclaw-nano-banana-pro` 스킬 (OpenRouter API 사용)
- lww 브랜드: Teal #0D9488, Pretendard 폰트
- 기존 proposal: `docs/whitepaper/lww/proposal.md`

## 개발 체크리스트
- [ ] `docs/whitepaper/lww/.ai.md` 또는 README 최신화 (산출물 위치 기재)

---

## 작업 내역


### 2026-03-21

**현황**: 0/6 완료

**완료된 항목**:
- (없음)

**미완료 항목**:
- [ ] 발표용 PPTX 생성 (lww Teal #0D9488 브랜드 적용, 10~15슬라이드)
- [ ] 포함 내용: 서비스 개요·슬로건, 시장 규모, 경쟁사 포지셔닝, 차별점, 수익 모델, AARRR, 로드맵
- [ ] 슬라이드별 삽화 생성 (나노바나나프로)
- [ ] Remotion 프로젝트로 슬라이드 애니메이션 컴포넌트 제작
- [ ] TTS 나레이션 스크립트 생성 + 음성 합성
- [ ] 최종 발표 동영상 렌더링 (MP4)

**변경 파일**: 0개
