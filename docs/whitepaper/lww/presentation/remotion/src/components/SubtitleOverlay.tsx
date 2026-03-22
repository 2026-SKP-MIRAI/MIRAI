import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { FONT } from "./BrandColors";

interface SubtitleOverlayProps {
  text: string;
  startFrame?: number;
  endFrame?: number;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  text,
  startFrame = 5,
  endFrame = 9999,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 8, endFrame - 8, endFrame],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (!text) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 48,
        left: 80,
        right: 80,
        textAlign: "center",
        opacity,
      }}
    >
      <div
        style={{
          display: "inline-block",
          background: "rgba(0,0,0,0.72)",
          color: "#FFFFFF",
          fontSize: 32,
          fontFamily: FONT.primary,
          fontWeight: 400,
          padding: "10px 24px",
          borderRadius: 8,
          lineHeight: 1.5,
          maxWidth: "80%",
        }}
      >
        {text}
      </div>
    </div>
  );
};
