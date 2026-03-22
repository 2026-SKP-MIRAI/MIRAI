import React from "react";
import { AbsoluteFill } from "remotion";
import { BRAND, FONT, SLIDE } from "./BrandColors";

interface SlideWrapperProps {
  children: React.ReactNode;
  background?: string;
  showTopBar?: boolean;
}

export const SlideWrapper: React.FC<SlideWrapperProps> = ({
  children,
  background = BRAND.white,
  showTopBar = true,
}) => {
  return (
    <AbsoluteFill
      style={{
        background,
        fontFamily: FONT.primary,
        width: SLIDE.width,
        height: SLIDE.height,
        overflow: "hidden",
      }}
    >
      {showTopBar && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 8,
            background: BRAND.teal,
          }}
        />
      )}
      {children}
    </AbsoluteFill>
  );
};
