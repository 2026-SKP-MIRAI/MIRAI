import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT } from "../components/BrandColors";
import { SubtitleOverlay } from "../components/SubtitleOverlay";
import { SlideData } from "./GenericSlide";

interface CoverSlideProps {
  slide: SlideData;
  showSubtitles?: boolean;
}

export const CoverSlide: React.FC<CoverSlideProps> = ({
  slide,
  showSubtitles = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headlineScale = spring({ frame, fps, config: { damping: 20 }, from: 0.8, to: 1 });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BRAND.teal, fontFamily: FONT.primary }}>
      {/* 배경 장식 원 */}
      <div style={{
        position: "absolute", right: -200, top: -200,
        width: 800, height: 800,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.08)",
      }} />
      <div style={{
        position: "absolute", left: -100, bottom: -100,
        width: 500, height: 500,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.05)",
      }} />

      {/* 로고 */}
      <div style={{
        position: "absolute", top: 80, left: 80,
        fontSize: 36, fontWeight: 900, color: BRAND.white,
        letterSpacing: 4, opacity,
      }}>
        lww
      </div>

      {/* 메인 헤드라인 */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: `translate(-50%, -60%) scale(${headlineScale})`,
        textAlign: "center",
        opacity,
        width: 1400,
      }}>
        <div style={{
          fontSize: 80, fontWeight: 900, color: BRAND.white,
          lineHeight: 1.15, marginBottom: 32,
        }}>
          {slide.headline}
        </div>
        <div style={{
          fontSize: 36, fontWeight: 300, color: "rgba(255,255,255,0.85)",
          opacity: subOpacity,
        }}>
          {slide.subheadline}
        </div>
      </div>

      {/* 바디 */}
      <div style={{
        position: "absolute", bottom: 120, left: "50%",
        transform: "translateX(-50%)",
        fontSize: 28, color: "rgba(255,255,255,0.7)",
        opacity: subOpacity, textAlign: "center",
        letterSpacing: 2,
      }}>
        {slide.body}
      </div>

      {/* 하단 라인 */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 8, background: "rgba(255,255,255,0.3)",
      }} />

      {showSubtitles && <SubtitleOverlay text={slide.narration} />}
    </AbsoluteFill>
  );
};
