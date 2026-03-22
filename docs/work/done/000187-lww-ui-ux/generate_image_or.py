#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = ["httpx", "pillow"]
# ///
"""
OpenRouter Gemini Image Generator
Usage: uv run generate_image_or.py --prompt "..." --filename "output.png"
"""

import argparse
import base64
import json
import os
import sys
from pathlib import Path

import httpx
from PIL import Image
import io

OUTPUT_DIR = Path(__file__).parent / "designs"
OUTPUT_DIR.mkdir(exist_ok=True)

MODEL = "google/gemini-2.0-flash-exp:free"
# Paid image model: "google/gemini-3.1-flash-image-preview"

def get_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OR_API_KEY")
    if not key:
        # Try reading from engine .env
        env_path = Path(__file__).parent.parent.parent.parent.parent / "engine" / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("OPENROUTER_API_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    if not key:
        print("ERROR: OPENROUTER_API_KEY not found. Set env var or add to engine/.env", file=sys.stderr)
        sys.exit(1)
    return key


def generate_image(prompt: str, filename: str) -> Path:
    api_key = get_api_key()

    output_path = OUTPUT_DIR / filename

    payload = {
        "model": "google/gemini-2.0-flash-thinking-exp:free",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }

    # Use image generation model
    image_payload = {
        "model": "google/gemini-3.1-flash-image-preview",
        "messages": [
            {
                "role": "user",
                "content": prompt
            }
        ]
    }

    print(f"Generating image: {filename}")
    print(f"Prompt: {prompt[:100]}...")

    response = httpx.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/2026-SKP-MIRAI/MIRAI",
            "X-Title": "MIRAI lww UI Design"
        },
        json=image_payload,
        timeout=120.0
    )

    if response.status_code != 200:
        print(f"ERROR: HTTP {response.status_code}", file=sys.stderr)
        print(response.text[:500], file=sys.stderr)
        sys.exit(1)

    data = response.json()

    # Debug: show response structure
    if "--debug" in sys.argv:
        print("Response keys:", list(data.keys()))
        if "choices" in data:
            msg = data["choices"][0]["message"]
            print("Message keys:", list(msg.keys()))

    # Extract image: OpenRouter Gemini puts images in message['images'] field
    image_data = None
    choices = data.get("choices", [])
    if not choices:
        print("ERROR: No choices in response", file=sys.stderr)
        print(json.dumps(data, indent=2)[:1000], file=sys.stderr)
        sys.exit(1)

    message = choices[0].get("message", {})

    # Primary: message['images'] field (OpenRouter Gemini specific)
    # Structure: [{"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}]
    images = message.get("images", [])
    if images:
        img_item = images[0]
        if isinstance(img_item, dict):
            url = img_item.get("image_url", {}).get("url", "")
            if url.startswith("data:image"):
                image_data = url.split(",", 1)[1]
            else:
                image_data = url
        else:
            image_data = img_item
        print(f"Found image in message['images'] ({len(images)} image(s))")

    # Fallback: content list with image_url type
    if not image_data:
        content = message.get("content", [])
        if isinstance(content, list):
            for item in content:
                if isinstance(item, dict) and item.get("type") == "image_url":
                    url = item.get("image_url", {}).get("url", "")
                    if url.startswith("data:image"):
                        image_data = url.split(",", 1)[1]
                        print("Found image in content[].image_url")
                        break

    if not image_data:
        print("ERROR: No image found in response", file=sys.stderr)
        print("Full response:", json.dumps(data, indent=2)[:2000], file=sys.stderr)
        sys.exit(1)

    # Decode and save
    if isinstance(image_data, str):
        # May be base64 string or data URL
        if image_data.startswith("data:image"):
            image_data = image_data.split(",", 1)[1]
        img_bytes = base64.b64decode(image_data)
    else:
        img_bytes = image_data

    img = Image.open(io.BytesIO(img_bytes))
    img.save(output_path)
    print(f"Saved: {output_path}")
    print(f"MEDIA: {output_path}")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Generate UI design images via OpenRouter Gemini")
    parser.add_argument("--prompt", "-p", required=True, help="Image generation prompt")
    parser.add_argument("--filename", "-f", required=True, help="Output filename (e.g. v2_01_onboarding.png)")
    parser.add_argument("--debug", action="store_true", help="Show response structure")
    args = parser.parse_args()

    if args.debug:
        sys.argv.append("--debug")

    generate_image(args.prompt, args.filename)


if __name__ == "__main__":
    main()
