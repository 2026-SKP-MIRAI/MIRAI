#!/usr/bin/env python3
"""
슬라이드 삽화 생성 스크립트
- 나노바나나프로 (OpenRouter API) 우선
- 실패 시 Pillow로 Placeholder PNG 생성
Usage: python generate_images.py --data ../content/slides-data.json --output-dir ../images/ [--placeholder-only]
"""
import argparse
import json
import os
from pathlib import Path


# AI 이미지 생성 대상 슬라이드 및 프롬프트
AI_IMAGE_SLIDES = {2, 3, 4, 8, 11}

AI_PROMPTS = {
    2: (
        "Flat minimalist illustration. Three vertical cards side by side on white background. "
        "Card 1: coin with X mark, label '돈없음', subtitle '컨설팅 30만원'. "
        "Card 2: sleepy face with books, label '지루함', subtitle '암기·자가분석'. "
        "Card 3: lonely person silhouette, label '외로움', subtitle '11.5개월 혼자'. "
        "Teal (#0D9488) accent color, clean lines, portrait 1:1 ratio."
    ),
    3: (
        "Flat minimalist illustration. Mobile phone screen showing a chat interface for AI mock interview. "
        "Teal (#0D9488) UI cards with Korean text placeholders. Three keyword badges: "
        "'크레딧', 'SNS', 'AI'. Clean white background, isometric perspective, playful modern style."
    ),
    4: (
        "Flat minimalist illustration. Smartphone displaying an interview score report card. "
        "Three horizontal progress bars labeled '논리성 85', '표현력 72', '직무 적합 91'. "
        "Teal (#0D9488) filled bars, green checkmark at top, white card background, "
        "light confetti decoration. Clean minimal design."
    ),
    8: (
        "Flat minimalist illustration. Circular flywheel diagram on white background. "
        "Three teal (#0D9488) circles arranged in triangle: 'AI 페르소나', '콘텐츠 성장', '사용자 증가'. "
        "Curved arrows connecting them clockwise showing virtuous cycle. "
        "Center label '선순환'. Clean geometric style."
    ),
    11: (
        "Flat minimalist illustration. Horizontal career journey timeline on white background. "
        "Four character figures connected by upward arrow path: "
        "'취준생' (student with backpack) → '합격' (celebration) → '현직자' (office worker) → '멘토' (teaching). "
        "Teal (#0D9488) gradient accents, warm minimal line art style."
    ),
}

# 공통 상수
IMG_W, IMG_H = 600, 800
TEAL_C = (13, 148, 136)
TEAL_LIGHT_C = (240, 253, 250)
TEAL_DARK_C = (5, 100, 90)
WHITE_C = (255, 255, 255)
DARK_C = (26, 26, 26)
GREY_C = (107, 114, 128)


def _get_fonts():
    from PIL import ImageFont
    bold_paths = [
        "/usr/share/fonts/truetype/nanum/NanumGothicExtraBold.ttf",
        "/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf",
    ]
    reg_paths = [
        "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    ]
    def load(path_list, size):
        for p in path_list:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default(size=size)
    return {
        "xl": load(bold_paths, 52),
        "lg": load(bold_paths, 36),
        "md": load(bold_paths, 26),
        "sm": load(reg_paths, 20),
        "xs": load(reg_paths, 15),
    }

_FONTS_CACHE = None

def _fonts():
    global _FONTS_CACHE
    if _FONTS_CACHE is None:
        _FONTS_CACHE = _get_fonts()
    return _FONTS_CACHE


def _draw_common(draw, title_text=""):
    """공통 상단/하단 Teal 바"""
    draw.rectangle([0, 0, IMG_W, 55], fill=TEAL_C)
    draw.rectangle([0, IMG_H - 45, IMG_W, IMG_H], fill=TEAL_C)


def _slide_02(draw, fonts):
    """문제: 3개 통증 카드 (이모지 대신 도형 아이콘)"""
    cards = [
        ("①", "돈없음", "컨설팅 30만원"),
        ("②", "지루함", "암기·자가분석"),
        ("③", "외로움", "11.5개월 혼자"),
    ]
    for i, (num, title, sub) in enumerate(cards):
        x = 30 + i * 185
        y = 180
        # 카드 배경
        draw.rounded_rectangle([x, y, x + 165, y + 220], radius=12,
                                fill=TEAL_LIGHT_C, outline=TEAL_C, width=2)
        # 번호 원형 아이콘
        cx, cy = x + 82, y + 55
        r = 30
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=TEAL_C)
        draw.text((cx, cy), num, fill=WHITE_C, anchor="mm", font=fonts["md"])
        # 제목
        draw.text((x + 82, y + 130), title, fill=DARK_C, anchor="mm", font=fonts["md"])
        # 설명
        draw.text((x + 82, y + 168), sub, fill=GREY_C, anchor="mm", font=fonts["xs"])


def _slide_03(draw, fonts):
    """솔루션: 3축 키워드 박스"""
    items = [
        ("크레딧", "부담 없는 AI 면접", TEAL_C, WHITE_C),
        ("SNS",    "취준생·현직자 소통", TEAL_LIGHT_C, DARK_C),
        ("AI",     "페르소나·코칭 자동화", TEAL_C, WHITE_C),
    ]
    for i, (kw, desc, bg, fg) in enumerate(items):
        y = 130 + i * 185
        draw.rounded_rectangle([50, y, IMG_W - 50, y + 155], radius=14,
                                fill=bg, outline=TEAL_DARK_C, width=2)
        draw.text((IMG_W // 2, y + 45), kw, fill=fg, anchor="mm", font=fonts["lg"])
        draw.text((IMG_W // 2, y + 105), desc, fill=fg if bg == TEAL_C else GREY_C,
                  anchor="mm", font=fonts["sm"])


def _slide_04(draw, fonts):
    """Aha Moment: 피드백 카드 UI"""
    draw.rounded_rectangle([40, 110, IMG_W - 40, IMG_H - 80], radius=16,
                            fill=WHITE_C, outline=TEAL_C, width=3)
    draw.text((IMG_W // 2, 155), "AI 면접 결과 리포트", fill=TEAL_C,
              anchor="mm", font=fonts["md"])
    # 구분선
    draw.rectangle([60, 175, IMG_W - 60, 178], fill=TEAL_LIGHT_C)
    labels = [("논리성", 0.85), ("표현력", 0.72), ("직무 적합", 0.91)]
    for i, (label, score) in enumerate(labels):
        y = 210 + i * 150
        draw.text((80, y + 10), label, fill=DARK_C, anchor="lm", font=fonts["sm"])
        bar_w = int((IMG_W - 130) * score)
        draw.rounded_rectangle([80, y + 40, 80 + bar_w, y + 80], radius=6, fill=TEAL_C)
        draw.rounded_rectangle([80, y + 40, IMG_W - 50, y + 80], radius=6,
                                fill=TEAL_LIGHT_C, outline=TEAL_C, width=1)
        draw.rounded_rectangle([80, y + 40, 80 + bar_w, y + 80], radius=6, fill=TEAL_C)
        draw.text((IMG_W - 45, y + 60), f"{int(score*100)}점", fill=TEAL_DARK_C,
                  anchor="mm", font=fonts["sm"])


def _slide_05(draw, fonts):
    """시장규모: TAM/SAM/SOM 피라미드"""
    items = [
        ("TAM  약 100만명", 480, TEAL_LIGHT_C, TEAL_C),
        ("SAM  약 40만명",  340, TEAL_C,       WHITE_C),
        ("SOM  25,000명",   200, TEAL_DARK_C,  WHITE_C),
    ]
    y_start = 120
    for i, (label, width, fill, fg) in enumerate(items):
        y = y_start + i * 175
        x_left = (IMG_W - width) // 2
        draw.rectangle([x_left, y, x_left + width, y + 140], fill=fill)
        draw.text((IMG_W // 2, y + 70), label, fill=fg, anchor="mm", font=fonts["sm"])


def _slide_06(draw, fonts):
    """경쟁사: 2×2 포지셔닝 매트릭스 (X: AI 에이전트, Y: 양면 플랫폼)"""
    cx, cy = IMG_W // 2, IMG_H // 2 + 30
    half = 210
    # 십자선
    draw.rectangle([cx - half, cy - 2, cx + half, cy + 2], fill=GREY_C)
    draw.rectangle([cx - 2, cy - half, cx + 2, cy + half], fill=GREY_C)
    # 축 레이블
    draw.text((cx, cy - half - 20), "양면 플랫폼 ↑", fill=GREY_C, anchor="mm", font=fonts["xs"])
    draw.text((cx + half + 5, cy), "AI 에이전트 →", fill=GREY_C, anchor="lm", font=fonts["xs"])
    # 경쟁사 포지셔닝
    comps = [
        ("사람인", cx + 100, cy + 100),   # AI ✓, 단면 → 우하단
        ("블라인드", cx - 100, cy + 100),  # AI ✗, 단면 → 좌하단
        ("링크드인", cx - 100, cy - 100),  # AI ✗, 양면 → 좌상단
    ]
    for name, x, y in comps:
        draw.text((x, y), name, fill=GREY_C, anchor="mm", font=fonts["xs"])
    # Fint 마커 (우상단 — 유일)
    fx, fy = cx + 120, cy - 130
    draw.ellipse([fx - 45, fy - 22, fx + 45, fy + 22], fill=TEAL_C)
    draw.text((fx, fy), "Fint ★", fill=WHITE_C, anchor="mm", font=fonts["sm"])


def _slide_07(draw, fonts):
    """차별점: 3개 카드 수직 나열"""
    items = [
        ("① 크레딧·콘텐츠", "재밌고 부담 없는 서비스"),
        ("② SNS 통합",       "구직자·현직자·AI 연결"),
        ("③ 수익화",         "멘토링·채용 매칭"),
    ]
    for i, (title, desc) in enumerate(items):
        y = 120 + i * 185
        # 카드
        draw.rounded_rectangle([30, y, IMG_W - 30, y + 155], radius=10,
                                fill=WHITE_C, outline=TEAL_LIGHT_C, width=2)
        # 좌측 Teal 강조 바
        draw.rounded_rectangle([30, y, 58, y + 155], radius=10, fill=TEAL_C)
        draw.text((IMG_W // 2 + 15, y + 50), title, fill=DARK_C, anchor="mm", font=fonts["md"])
        draw.text((IMG_W // 2 + 15, y + 100), desc, fill=GREY_C, anchor="mm", font=fonts["sm"])


def _slide_08(draw, fonts):
    """AI 전략: 선순환 사이클"""
    import math
    cx, cy = IMG_W // 2, IMG_H // 2 + 30
    r = 160
    nodes = [
        ("AI\n페르소나", 270),
        ("콘텐츠\n성장", 30),
        ("사용자\n증가", 150),
    ]
    # 연결선 (원 사이)
    positions = []
    for label, angle in nodes:
        x = cx + int(r * math.cos(math.radians(angle)))
        y = cy + int(r * math.sin(math.radians(angle)))
        positions.append((x, y))
    for i in range(3):
        x1, y1 = positions[i]
        x2, y2 = positions[(i + 1) % 3]
        draw.line([(x1, y1), (x2, y2)], fill=TEAL_LIGHT_C, width=3)
    # 노드 원
    for i, (label, angle) in enumerate(nodes):
        x, y = positions[i]
        draw.ellipse([x - 55, y - 45, x + 55, y + 45], fill=TEAL_C, outline=WHITE_C, width=2)
        draw.text((x, y), label, fill=WHITE_C, anchor="mm", font=fonts["xs"])
    draw.text((cx, cy), "선순환", fill=TEAL_DARK_C, anchor="mm", font=fonts["sm"])


def _slide_09(draw, fonts):
    """수익모델: 3단 레이어 박스"""
    layers = [
        ("현금 과금", "멘토링·채용 매칭 수수료", TEAL_DARK_C, WHITE_C, 180),
        ("광고 수익", "채용공고·스폰서드 (B2B)", TEAL_C,      WHITE_C, 240),
        ("크레딧 경제", "크레딧 구매·획득·소비",  TEAL_LIGHT_C, DARK_C, 300),
    ]
    for i, (title, desc, bg, fg, width) in enumerate(layers):
        y = 120 + i * 185
        x = (IMG_W - width) // 2
        draw.rounded_rectangle([x, y, x + width, y + 150], radius=10, fill=bg)
        draw.text((IMG_W // 2, y + 55), title, fill=fg, anchor="mm", font=fonts["md"])
        draw.text((IMG_W // 2, y + 105), desc, fill=fg if bg != TEAL_LIGHT_C else GREY_C,
                  anchor="mm", font=fonts["xs"])


def _slide_10(draw, fonts):
    """로드맵: 수평 타임라인"""
    y_line = IMG_H // 2 + 60
    x_start, x_end = 60, IMG_W - 60
    # 타임라인 선
    draw.rectangle([x_start, y_line - 3, x_end, y_line + 3], fill=TEAL_C)
    milestones = [
        ("MVP", "3/22", x_start),
        ("Phase 1", "3/27", (x_start + x_end) // 2),
        ("Phase 2", "4/1", x_end),
    ]
    for label, date, x in milestones:
        # 원 마커
        draw.ellipse([x - 18, y_line - 18, x + 18, y_line + 18], fill=TEAL_C, outline=WHITE_C, width=2)
        # 레이블 위
        draw.text((x, y_line - 45), label, fill=DARK_C, anchor="mm", font=fonts["sm"])
        # 날짜 아래
        draw.text((x, y_line + 45), date, fill=TEAL_C, anchor="mm", font=fonts["xs"])


def _slide_11(draw, fonts):
    """비전: 커리어 여정 4단계 플로우"""
    stages = ["취준생", "합격", "현직자", "멘토"]
    box_w, box_h = 105, 80
    total_w = len(stages) * box_w + (len(stages) - 1) * 30
    x_start = (IMG_W - total_w) // 2
    y = IMG_H // 2 + 20

    for i, stage in enumerate(stages):
        x = x_start + i * (box_w + 30)
        alpha = (i + 1) / len(stages)
        r = int(13 + (5 - 13) * (1 - alpha))
        g = int(148 + (100 - 148) * (1 - alpha))
        b = int(136 + (90 - 136) * (1 - alpha))
        color = (max(0, r), max(0, g), max(0, b))
        draw.rounded_rectangle([x, y - box_h // 2, x + box_w, y + box_h // 2],
                                radius=10, fill=color)
        draw.text((x + box_w // 2, y), stage, fill=WHITE_C, anchor="mm", font=fonts["sm"])
        # 화살표 (마지막 제외)
        if i < len(stages) - 1:
            ax = x + box_w + 5
            draw.polygon([(ax, y - 8), (ax + 18, y), (ax, y + 8)], fill=TEAL_C)

    draw.text((IMG_W // 2, y - 120), "커리어 전 생애와 함께", fill=TEAL_C,
              anchor="mm", font=fonts["md"])


_SLIDE_DISPATCHER = {
    2: _slide_02,
    3: _slide_03,
    4: _slide_04,
    5: _slide_05,
    6: _slide_06,
    7: _slide_07,
    8: _slide_08,
    9: _slide_09,
    10: _slide_10,
    11: _slide_11,
}


def generate_placeholder(output_path: Path, slide_num: int, title: str):
    """Pillow로 슬라이드별 맞춤 시각화 이미지 생성"""
    try:
        from PIL import Image, ImageDraw

        img = Image.new("RGB", (IMG_W, IMG_H), WHITE_C)
        draw = ImageDraw.Draw(img)
        fonts = _fonts()

        # 공통 상단/하단 바
        _draw_common(draw)

        # 슬라이드별 맞춤 시각화
        if slide_num in _SLIDE_DISPATCHER:
            _SLIDE_DISPATCHER[slide_num](draw, fonts)
        else:
            # 기본 placeholder (slide 1, 12 등)
            cx, cy = IMG_W // 2, IMG_H // 2
            r = 160
            draw.ellipse([cx - r, cy - r, cx + r, cy + r],
                         fill=TEAL_LIGHT_C, outline=TEAL_C, width=3)
            draw.text((cx, cy - 30), f"Slide {slide_num:02d}", fill=TEAL_C,
                      anchor="mm", font=fonts["lg"])
            draw.text((cx, cy + 40), title, fill=TEAL_C,
                      anchor="mm", font=fonts["md"])

        img.save(str(output_path), "PNG", optimize=True)
        return True

    except ImportError:
        # Pillow 없으면 최소 PNG 생성 (기존 코드 유지)
        import struct, zlib
        def make_png(width=600, height=800, r=13, g=148, b=136):
            def chunk(name, data):
                c = struct.pack(">I", len(data)) + name + data
                return c + struct.pack(">I", zlib.crc32(name + data) & 0xFFFFFFFF)
            header = b"\x89PNG\r\n\x1a\n"
            ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            raw = b"".join(b"\x00" + bytes([r, g, b] * width) for _ in range(height))
            idat = chunk(b"IDAT", zlib.compress(raw))
            iend = chunk(b"IEND", b"")
            return header + ihdr + idat + iend
        output_path.write_bytes(make_png())
        return True


def generate_with_openrouter(prompt: str, output_path: Path, api_key: str) -> bool:
    """OpenRouter Gemini 3.1 Flash Image로 이미지 생성"""
    try:
        import requests, base64, re
        from io import BytesIO
        from PIL import Image

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "google/gemini-3.1-flash-image-preview",
                "messages": [{"role": "user", "content": prompt}],
                "modalities": ["image", "text"],
                "image_config": {
                    "aspect_ratio": "3:4",
                    "image_size": "1K",
                },
            },
            timeout=120,
        )
        if response.status_code != 200:
            print(f"  OpenRouter 실패: {response.status_code} {response.text[:300]}")
            return False

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            print("  OpenRouter: choices 없음")
            return False

        message = choices[0].get("message", {})

        def _save_from_url(url_data):
            """원본 비율 그대로 저장 (PPTX가 width만 고정하므로 왜곡 없음)"""
            def _write(img_bytes):
                img = Image.open(BytesIO(img_bytes)).convert("RGB")
                img.save(str(output_path), "PNG")
                return True

            if url_data.startswith("data:"):
                return _write(base64.b64decode(url_data.split(",", 1)[1]))
            elif url_data.startswith("http"):
                img_resp = requests.get(url_data, timeout=60)
                if img_resp.status_code == 200:
                    return _write(img_resp.content)
            return False

        # 1순위: message.images 필드 (Gemini 3.1 Flash Image 응답 형식)
        for img_item in message.get("images", []):
            url_data = img_item.get("image_url", {}).get("url", "")
            if url_data and _save_from_url(url_data):
                return True

        # 2순위: content 리스트 파트
        content = message.get("content", "")
        if isinstance(content, list):
            for part in content:
                if isinstance(part, dict):
                    url_data = part.get("image_url", {}).get("url", "")
                    if url_data and _save_from_url(url_data):
                        return True
                    b64 = part.get("data", "") or part.get("inline_data", {}).get("data", "")
                    if b64:
                        img = Image.open(BytesIO(base64.b64decode(b64))).convert("RGB")
                        img = img.resize((IMG_W, IMG_H), Image.LANCZOS)
                        img.save(str(output_path), "PNG")
                        return True

        # 3순위: content 문자열에서 URL 추출
        if isinstance(content, str) and content:
            urls = re.findall(r'https?://\S+\.(?:png|jpg|jpeg|webp)', content, re.I)
            if urls and _save_from_url(urls[0]):
                return True

        print("  OpenRouter: 이미지 데이터 없음")
        return False
    except Exception as e:
        print(f"  OpenRouter 실패: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="슬라이드 삽화 생성")
    parser.add_argument("--data", required=True)
    parser.add_argument("--prompts", required=False, help="image-prompts.md 경로")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--placeholder-only", action="store_true")
    args = parser.parse_args()

    data_path = Path(args.data)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    openrouter_key = os.environ.get("OPENROUTER_API_KEY", "")
    provider = "placeholder" if args.placeholder_only or not openrouter_key else "openrouter"

    print(f"이미지 생성 제공자: {provider}")

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 프롬프트 파일 로드 (있으면)
    prompts = {}
    if args.prompts and Path(args.prompts).exists():
        content = Path(args.prompts).read_text(encoding="utf-8")
        import re
        blocks = re.findall(r'## Slide (\d+)[^\n]*\n```\n(.*?)\n```', content, re.S)
        for num, prompt_text in blocks:
            prompts[int(num)] = prompt_text.strip()

    for slide in data["slides"]:
        slide_id = slide["id"]
        filename = f"slide-{slide_id:02d}.png"
        output_path = output_dir / filename

        print(f"  슬라이드 {slide_id:02d}: {filename}")

        if output_path.exists():
            print(f"    → 이미 존재, 건너뜀")
            continue

        success = False
        if provider == "openrouter" and slide_id in AI_IMAGE_SLIDES:
            # 인라인 프롬프트 우선, 없으면 prompts 파일
            prompt = AI_PROMPTS.get(slide_id) or prompts.get(slide_id, "")
            if prompt:
                print(f"    → AI 이미지 생성 (OpenRouter DALL-E 3)")
                success = generate_with_openrouter(prompt, output_path, openrouter_key)
        elif provider == "openrouter" and slide_id in prompts:
            success = generate_with_openrouter(prompts[slide_id], output_path, openrouter_key)

        if not success:
            print(f"    → Placeholder 생성")
            generate_placeholder(output_path, slide_id, slide["title"])

    print(f"\n✅ 이미지 생성 완료: {output_dir}")
    count = len(list(output_dir.glob("*.png")))
    print(f"   파일 수: {count}/13")


if __name__ == "__main__":
    main()
