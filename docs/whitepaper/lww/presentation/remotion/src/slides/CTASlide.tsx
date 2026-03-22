import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND, FONT } from "../components/BrandColors";
import { SubtitleOverlay } from "../components/SubtitleOverlay";
import { SlideData } from "./GenericSlide";

interface CTASlideProps {
  slide: SlideData;
  showSubtitles?: boolean;
}

export const CTASlide: React.FC<CTASlideProps> = ({
  slide,
  showSubtitles = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({ frame, fps, config: { damping: 18 }, from: 0.85, to: 1 });
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const subOpacity = interpolate(frame, [12, 25], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: BRAND.teal, fontFamily: FONT.primary }}>
      {/* 배경 장식 */}
      <div style={{
        position: "absolute", right: -150, bottom: -150,
        width: 600, height: 600, borderRadius: "50%",
        background: "rgba(255,255,255,0.07)",
      }} />

      {/* 메인 카드 */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: `translate(-50%, -50%) scale(${scale})`,
        textAlign: "center",
        opacity,
      }}>
        <div style={{
          fontSize: 72, fontWeight: 900, color: BRAND.white,
          marginBottom: 24, lineHeight: 1.2,
        }}>
          {slide.headline}
        </div>

        <div style={{
          fontSize: 32, color: "rgba(255,255,255,0.85)",
          marginBottom: 60, opacity: subOpacity,
        }}>
          {slide.subheadline}
        </div>

        {/* URL 박스 */}
        <div style={{
          display: "inline-block",
          background: "rgba(255,255,255,0.15)",
          border: "2px solid rgba(255,255,255,0.4)",
          borderRadius: 16,
          padding: "20px 60px",
          opacity: subOpacity,
        }}>
          <div style={{
            fontSize: 36, fontWeight: 600, color: BRAND.white,
            letterSpacing: 2,
          }}>
            {slide.body?.split("\n")[1] || "lww.vercel.app"}
          </div>
        </div>
      </div>

      {/* 슬로건 */}
      <div style={{
        position: "absolute", bottom: 80, left: "50%",
        transform: "translateX(-50%)",
        fontSize: 24, color: "rgba(255,255,255,0.65)",
        opacity: subOpacity,
        textAlign: "center",
        letterSpacing: 1,
      }}>
        취업준비부터 직장생활까지, 재밌게
      </div>

      {showSubtitles && <SubtitleOverlay text={slide.narration} />}
    </AbsoluteFill>
  );
};
