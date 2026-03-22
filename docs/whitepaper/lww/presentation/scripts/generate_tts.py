#!/usr/bin/env python3
"""
lww TTS 나레이션 생성 스크립트
Priority: OpenAI TTS → ElevenLabs → Silent (placeholder)
Usage: python generate_tts.py --data ../content/slides-data.json --output-dir ../audio/
"""
import argparse
import json
import os
import subprocess
import struct
import wave
from pathlib import Path


def generate_silent_mp3(output_path: Path, duration_seconds: float = 15.0):
    """무음 WAV → MP3 생성 (ffmpeg 사용)"""
    wav_path = output_path.with_suffix(".wav")
    sample_rate = 44100
    num_samples = int(sample_rate * duration_seconds)

    with wave.open(str(wav_path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(b"\x00\x00" * num_samples)

    # wav → mp3 (ffmpeg)
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", str(wav_path), "-q:a", "9", str(output_path)],
        capture_output=True
    )
    wav_path.unlink(missing_ok=True)
    if result.returncode != 0:
        # ffmpeg 없으면 wav를 mp3로 이름만 변경 (렌더링 폴백)
        wav_path_renamed = output_path.with_suffix(".wav")
        output_path.write_bytes(wav_path_renamed.read_bytes() if wav_path_renamed.exists() else b"")
    return output_path


def generate_with_openai(narration: str, output_path: Path, api_key: str):
    """OpenAI TTS API로 음성 생성"""
    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        response = client.audio.speech.create(
            model="tts-1-hd",
            voice="nova",
            input=narration,
        )
        response.stream_to_file(str(output_path))
        return True
    except Exception as e:
        print(f"  OpenAI TTS 실패: {e}")
        return False


def generate_with_elevenlabs(narration: str, output_path: Path, api_key: str):
    """ElevenLabs API로 음성 생성"""
    try:
        import requests
        voice_id = "21m00Tcm4TlvDq8ikWAM"  # Rachel — 한국어 지원
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": api_key,
        }
        data = {
            "text": narration,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.75},
        }
        response = requests.post(url, json=data, headers=headers, timeout=30)
        if response.status_code == 200:
            output_path.write_bytes(response.content)
            return True
        print(f"  ElevenLabs 실패: {response.status_code} {response.text[:100]}")
        return False
    except Exception as e:
        print(f"  ElevenLabs TTS 실패: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="lww TTS 나레이션 생성")
    parser.add_argument("--data", required=True, help="slides-data.json 경로")
    parser.add_argument("--output-dir", required=True, help="MP3 출력 디렉토리")
    args = parser.parse_args()

    data_path = Path(args.data)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    openai_key = os.environ.get("OPENAI_API_KEY", "")
    elevenlabs_key = os.environ.get("ELEVENLABS_API_KEY", "")

    if openai_key:
        tts_provider = "openai"
    elif elevenlabs_key:
        tts_provider = "elevenlabs"
    else:
        tts_provider = "silent"

    print(f"TTS 제공자: {tts_provider}")
    if tts_provider == "silent":
        print("  ⚠️  API 키 없음. 무음 플레이스홀더 생성.")

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for slide in data["slides"]:
        slide_id = slide["id"]
        narration = slide["narration"]
        target_secs = slide["targetSeconds"]
        filename = f"slide-{slide_id:02d}-narration.mp3"
        output_path = output_dir / filename

        print(f"  슬라이드 {slide_id:02d}: {filename}")

        if output_path.exists():
            print(f"    → 이미 존재, 건너뜀")
            continue

        success = False
        if tts_provider == "openai":
            success = generate_with_openai(narration, output_path, openai_key)
        elif tts_provider == "elevenlabs":
            success = generate_with_elevenlabs(narration, output_path, elevenlabs_key)

        if not success:
            print(f"    → 무음 플레이스홀더 생성 ({target_secs}초)")
            generate_silent_mp3(output_path, duration_seconds=target_secs)

    print(f"\n✅ TTS 생성 완료: {output_dir}")
    mp3_count = len(list(output_dir.glob("*.mp3")))
    print(f"   파일 수: {mp3_count}/13")


if __name__ == "__main__":
    main()
