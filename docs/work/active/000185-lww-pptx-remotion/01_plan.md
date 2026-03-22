# [#185] chore: [lww] 발표용 기획서 + 발표 동영상 제작 (PPTX → Remotion + TTS) — 구현 계획

> 작성: 2026-03-21

---

## 완료 기준

- [ ] 발표용 PPTX 생성 (lww Teal #0D9488 브랜드 적용, 10~15슬라이드)
- [ ] 포함 내용: 서비스 개요·슬로건, 시장 규모, 경쟁사 포지셔닝, 차별점, 수익 모델, AARRR, 로드맵
- [ ] 슬라이드별 삽화 생성 (나노바나나프로 — Gemini 3 Pro Image via OpenRouter API)
- [ ] Remotion 프로젝트로 슬라이드 애니메이션 컴포넌트 제작
- [ ] TTS 나레이션 스크립트 생성 + 음성 합성 (OpenAI TTS 또는 ElevenLabs)
- [ ] 최종 발표 동영상 렌더링 (MP4)
- [ ] `docs/whitepaper/lww/.ai.md` 또는 README 최신화 (산출물 위치 기재)

---

## 구현 계획

> 디자이너 리뷰 → Planner → Architect/Critic REVISE → 수정 반영 (2026-03-22)

### Phase 1: 텍스트 공백 정규화 + CTA Teal 배경

**대상 파일**: `docs/whitepaper/lww/presentation/scripts/generate_pptx.py`

| 작업 | 대상 | 내용 |
|------|------|------|
| 1-1 | `normalize_text()` 추가 | whitespace만 처리. 연속공백→단일, 쉼표/마침표 앞 공백 제거, 숫자+단위 사이 공백 제거. **NFKC 제외** (①②③, URL, ✓✗ 보존) |
| 1-2 | `add_textbox()` 적용 | `run.text = normalize_text(text)` |
| 1-3 | `add_body_textbox()` 적용 | `run.text = normalize_text(line)` |
| 1-4 | 헤드라인 폰트 축소 | `add_content_slide()` 헤드라인 32pt → 28pt (2줄 넘침 방지) |
| 1-5 | CTA 라우팅 버그 수정 | `main()` 232행: `slide_id == 13` → `slide_id == 12` |
| 1-6 | CTA Teal 배경 + URL 강조 | `add_cta_slide()`: 배경 WHITE→TEAL, 텍스트 WHITE, URL을 TEAL_LIGHT 박스로 강조 |

**AC**:
- `normalize_text("3 분")` == `"3분"`, `normalize_text("면접 ,")` == `"면접,"`, `normalize_text("①")` == `"①"` (변형 없음)
- CTA 슬라이드(id=12)가 Teal 배경 + WHITE 헤드라인 + TEAL_LIGHT URL 박스로 렌더링

**검증**: `python scripts/generate_pptx.py --data content/slides-data.json --output slides/lww-pitch-deck.pptx` 후 slide-exports 업데이트해서 슬라이드 12 확인

---

### Phase 2: 슬라이드별 맞춤 시각화 이미지

**대상 파일**: `docs/whitepaper/lww/presentation/scripts/generate_images.py`

dispatcher 패턴: `generate_placeholder()` 내부에 slide_id별 분기 추가. 공통 상단/하단 Teal 바는 유지.

| slide_id | 시각화 내용 |
|----------|------------|
| 02 | 3개 통증 아이콘(💸 😩 🤝) + 레이블 카드 |
| 03 | 3축 키워드 박스(크레딧/SNS/AI), Teal 교차색, 세로 배치 |
| 04 | 피드백 카드 UI (3개 수평 바, 너비 차등) |
| 05 | TAM/SAM/SOM 3단 피라미드 (polygon, 너비 400→280→160) |
| 06 | 2×2 포지셔닝 매트릭스 + Fint TEAL 마커 우상단 |
| 07 | 3개 카드 수직 나열 (좌측 TEAL 강조 바) |
| 08 | 선순환 사이클 원 3개 (삼각 배치) + 연결선 |
| 09 | 3단 레이어 박스 (하단 넓고 상단 좁게, 색상 단계) |
| 10 | 수평 타임라인 + 3단계 원 마커 + 날짜 레이블 |
| 11 | 커리어 여정 4단계 수평 플로우 (취준생→합격→현직자→멘토) |

**폰트 폴백 체인**: NanumGothicExtraBold → NanumGothic → NotoSansCJK → load_default() (한글 깨짐 경고 출력)

**AC**:
- `--placeholder-only` 실행 시 slide-02~11 각각 고유한 시각화
- 이미지 크기 600×800px PNG
- slide-01, slide-12는 기존 기본 placeholder 유지

**검증**: `python scripts/generate_images.py ... --placeholder-only` 후 `ls images/` 12개 확인, 각 이미지 육안 검토

---

### Phase 3: PPTX 레이아웃 다양화

**대상 파일**: `docs/whitepaper/lww/presentation/scripts/generate_pptx.py`

> **충돌 방지**: Phase 3 도형은 `with_images=False`일 때만 활성화. `--with-images` 모드에서는 Phase 2 이미지가 우측을 점유하므로 도형 추가 생략.

| 작업 | 슬라이드 | 내용 |
|------|----------|------|
| 3-1 | 공통 | `add_highlighted_textbox()` 추가 — 키워드 run 분리, Teal 볼드 강조 |
| 3-2 | slide 5 | `_add_funnel_shapes()` — 3단 사각형 (너비 4.2/3.0/1.8인치, SOM은 TEAL 배경) |
| 3-3 | slide 6 | `_add_matrix_shapes()` — 십자선(얇은 사각형) + 4사분면 레이블 + Fint TEAL 마커 |
| 3-4 | slide 10 | `_add_timeline_shapes()` — 수평선 + 3개 원형 마커 + 날짜 레이블 |
| 3-5 | slide 11 | 배경 TEAL_LIGHT + 헤드라인 TEAL 색상 |

**AC**:
- `--with-images` 없이 실행 시 slide 5/6/10/11에 도형이 추가됨
- `--with-images` 실행 시 도형 추가 없이 이미지만 표시 (충돌 없음)
- slide 11 배경 TEAL_LIGHT + 헤드라인 TEAL

**검증**: 이미지 없는 PPTX + 이미지 있는 PPTX 각각 생성, slide-exports 업데이트 후 비교

---

### 최종 통합 검증

```bash
cd docs/whitepaper/lww/presentation

# Phase 1+3 (이미지 없음)
python scripts/generate_pptx.py --data content/slides-data.json --output slides/lww-pitch-deck.pptx

# Phase 2 이미지 재생성
python scripts/generate_images.py --data content/slides-data.json --output-dir images/ --placeholder-only

# Phase 1+2+3 (이미지 포함)
python scripts/generate_pptx.py --data content/slides-data.json --output slides/lww-pitch-deck.pptx --with-images

# PDF→PNG 내보내기
libreoffice --headless --convert-to pdf slides/lww-pitch-deck.pptx --outdir slide-exports/
pdftoppm -r 150 -png slide-exports/lww-pitch-deck.pdf slide-exports/slide
```

- [ ] 12슬라이드 PPTX 정상 생성 (에러 없음)
- [ ] 텍스트 공백 정규화 확인 ("3분", "면접," 등)
- [ ] CTA(slide 12) Teal 배경 + URL 강조 박스
- [ ] slide 02~11 각각 고유 시각화 이미지
- [ ] slide 5/6/10/11 이미지 없는 모드에서 도형 추가 확인
- [ ] `--with-images` / 기본 모드 모두 정상 동작
