#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "requests>=2.31.0",
#     "pillow>=10.0.0",
# ]
# ///
"""
Generate images using OpenRouter API (Gemini 3 Pro Image via chat completions).

Usage:
    uv run generate_image_openrouter.py --prompt "your image description" --filename "output.png"
    uv run generate_image_openrouter.py --prompt "..." --filename "output.png" --model "google/gemini-3-pro-image-preview"
    uv run generate_image_openrouter.py --prompt "..." --filename "output.png" --resolution mobile

Supported models (OpenRouter multimodal image-generating models):
    google/gemini-3-pro-image-preview     (default, best quality)
    google/gemini-3.1-flash-image-preview (faster)
    google/gemini-2.5-flash-image         (cost-efficient)
    openai/gpt-5-image                    (GPT-5 image)
    openai/gpt-5-image-mini               (GPT-5 image mini)

API key resolution order:
    1. --api-key argument
    2. OPENROUTER_API_KEY environment variable
"""

import argparse
import base64
import os
import sys
from io import BytesIO
from pathlib import Path


RESOLUTION_HINT = {
    "1K": "1024x1024 square",
    "2K": "2048x2048 large square",
    "4K": "4096x4096 ultra high resolution",
    "mobile": "375x812 mobile portrait phone screen",
}

DEFAULT_MODEL = "google/gemini-3-pro-image-preview"
OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"


def get_api_key(provided_key: str | None) -> str | None:
    if provided_key:
        return provided_key
    return os.environ.get("OPENROUTER_API_KEY")


def generate_image(
    prompt: str,
    api_key: str,
    model: str,
    resolution: str,
) -> bytes:
    import requests

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/2026-SKP-MIRAI/MIRAI",
        "X-Title": "Fint Design Generator",
    }

    res_hint = RESOLUTION_HINT.get(resolution, "")
    full_prompt = f"{prompt}" + (f" Resolution: {res_hint}." if res_hint else "")

    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": [{"type": "text", "text": full_prompt}],
            }
        ],
        "modalities": ["text", "image"],
    }

    print(f"Calling OpenRouter ({model}), resolution hint: {resolution}...")
    response = requests.post(OPENROUTER_CHAT_URL, headers=headers, json=payload, timeout=180)

    if not response.ok:
        raise RuntimeError(
            f"OpenRouter API error {response.status_code}: {response.text[:500]}"
        )

    data = response.json()
    message = data["choices"][0]["message"]

    # Extract from message.images (OpenRouter-specific field)
    images = message.get("images", [])
    if images:
        img_obj = images[0]
        url = img_obj.get("image_url", "")
        if isinstance(url, dict):
            url = url.get("url", "")
        if url.startswith("data:"):
            # data:image/png;base64,<b64>
            b64 = url.split(",", 1)[1]
            return base64.b64decode(b64)
        if url:
            img_response = requests.get(url, timeout=60)
            img_response.raise_for_status()
            return img_response.content

    # Fallback: check content list for image_url items
    content = message.get("content", [])
    if isinstance(content, list):
        for item in content:
            if item.get("type") == "image_url":
                url = item.get("image_url", {})
                if isinstance(url, dict):
                    url = url.get("url", "")
                if url.startswith("data:"):
                    b64 = url.split(",", 1)[1]
                    return base64.b64decode(b64)
                if url:
                    img_response = requests.get(url, timeout=60)
                    img_response.raise_for_status()
                    return img_response.content

    raise RuntimeError("No image data found in response")


def main():
    parser = argparse.ArgumentParser(
        description="Generate images via OpenRouter (Gemini 3 Pro Image)"
    )
    parser.add_argument("--prompt", "-p", required=True, help="Image description")
    parser.add_argument("--filename", "-f", required=True, help="Output path (e.g. output.png)")
    parser.add_argument(
        "--resolution", "-r",
        choices=["1K", "2K", "4K", "mobile"],
        default="1K",
        help="Resolution hint: 1K (1024x1024), 2K, 4K, mobile (375x812). Default: 1K",
    )
    parser.add_argument(
        "--model", "-m",
        default=DEFAULT_MODEL,
        help=f"OpenRouter image model (default: {DEFAULT_MODEL})",
    )
    parser.add_argument("--api-key", "-k", help="OpenRouter API key")

    args = parser.parse_args()

    api_key = get_api_key(args.api_key)
    if not api_key:
        print("Error: No API key provided.", file=sys.stderr)
        print("  1. Provide --api-key argument", file=sys.stderr)
        print("  2. Set OPENROUTER_API_KEY environment variable", file=sys.stderr)
        sys.exit(1)

    output_path = Path(args.filename)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        image_bytes = generate_image(
            prompt=args.prompt,
            api_key=api_key,
            model=args.model,
            resolution=args.resolution,
        )
    except Exception as e:
        print(f"Error generating image: {e}", file=sys.stderr)
        sys.exit(1)

    # Save as PNG
    from PIL import Image as PILImage

    img = PILImage.open(BytesIO(image_bytes))
    if img.mode == "RGBA":
        bg = PILImage.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        bg.save(str(output_path), "PNG")
    else:
        img.convert("RGB").save(str(output_path), "PNG")

    full_path = output_path.resolve()
    print(f"\nImage saved: {full_path}")
    print(f"MEDIA: {full_path}")


if __name__ == "__main__":
    main()
