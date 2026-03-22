#!/usr/bin/env python3
"""
TTS 음성 파일의 실제 길이를 ffprobe로 측정해 slides-data.json의 durationInFrames를 갱신합니다.
Usage: python update_durations.py --data ../content/slides-data.json --audio-dir ../audio/
"""
import argparse
import json
import math
import subprocess
from pathlib import Path


def get_duration_frames(mp3_path: Path, fps: int = 30, padding: int = 30) -> int:
    """ffprobe로 MP3 길이를 측정해 프레임 수로 변환"""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(mp3_path)
            ],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            secs = float(result.stdout.strip())
            frames = math.ceil(secs * fps) + padding
            return frames
    except Exception as e:
        print(f"  ffprobe 실패 ({mp3_path.name}): {e}")
    return None


def main():
    parser = argparse.ArgumentParser(description="durationInFrames 갱신")
    parser.add_argument("--data", required=True, help="slides-data.json 경로")
    parser.add_argument("--audio-dir", required=True, help="MP3 파일 디렉토리")
    parser.add_argument("--fps", type=int, default=30, help="프레임레이트 (기본: 30)")
    parser.add_argument("--padding", type=int, default=30, help="패딩 프레임 수 (기본: 30 = 1초)")
    args = parser.parse_args()

    data_path = Path(args.data)
    audio_dir = Path(args.audio_dir)

    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    updated = 0
    for slide in data["slides"]:
        slide_id = slide["id"]
        mp3_name = f"slide-{slide_id:02d}-narration.mp3"
        mp3_path = audio_dir / mp3_name

        if not mp3_path.exists():
            print(f"  슬라이드 {slide_id:02d}: MP3 없음 — targetSeconds 폴백 사용")
            slide["durationInFrames"] = slide["targetSeconds"] * args.fps + args.padding
            continue

        frames = get_duration_frames(mp3_path, fps=args.fps, padding=args.padding)
        if frames:
            old = slide.get("durationInFrames")
            slide["durationInFrames"] = frames
            secs = (frames - args.padding) / args.fps
            print(f"  슬라이드 {slide_id:02d}: {secs:.1f}초 → {frames}프레임 (이전: {old})")
            updated += 1
        else:
            slide["durationInFrames"] = slide["targetSeconds"] * args.fps + args.padding
            print(f"  슬라이드 {slide_id:02d}: ffprobe 실패 → targetSeconds 폴백")

    with open(data_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ durationInFrames 갱신 완료: {updated}/{len(data['slides'])} 슬라이드")
    print(f"   파일 저장: {data_path}")

    # Remotion data 복사 (있으면)
    remotion_data_dir = data_path.parent.parent / "remotion" / "src" / "data"
    if remotion_data_dir.exists():
        import shutil
        dest = remotion_data_dir / "slides-data.json"
        shutil.copy2(str(data_path), str(dest))
        print(f"   Remotion 데이터 동기화: {dest}")


if __name__ == "__main__":
    main()
