import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface AnimatedTextProps {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  children,
  delay = 0,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const opacity = interpolate(frame - delay, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = spring({
    frame: frame - delay,
    fps,
    config: { damping: 20, stiffness: 80 },
    from: 30,
    to: 0,
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
