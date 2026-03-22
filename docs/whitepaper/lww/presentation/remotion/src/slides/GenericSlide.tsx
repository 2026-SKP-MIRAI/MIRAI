import React from "react";
import { staticFile } from "remotion";
import { AnimatedText } from "../components/AnimatedText";
import { BRAND, FONT } from "../components/BrandColors";
import { SlideWrapper } from "../components/SlideWrapper";
import { SubtitleOverlay } from "../components/SubtitleOverlay";

export interface SlideData {
  id: number;
  title: string;
  headline: string;
  subheadline?: string;
  body?: string;
  image: string;
  audio: string;
  targetSeconds: number;
  durationInFrames: number | null;
  narration: string;
}

interface GenericSlideProps {
  slide: SlideData;
  showSubtitles?: boolean;
}

export const GenericSlide: React.FC<GenericSlideProps> = ({
  slide,
  showSubtitles = true,
}) => {
  const imgPath = `images/${slide.image}`;

  return (
    <SlideWrapper>
      {/* 슬라이드 번호 */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: 60,
          fontSize: 16,
          color: BRAND.teal,
          fontFamily: FONT.primary,
          fontWeight: 600,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {String(slide.id).padStart(2, "0")} / 12 &nbsp;&nbsp; {slide.title}
      </div>

      {/* 헤드라인 */}
      <AnimatedText delay={5} style={{ position: "absolute", top: 100, left: 60, right: 720 }}>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: BRAND.dark,
            fontFamily: FONT.primary,
            lineHeight: 1.2,
          }}
        >
          {slide.headline}
        </div>
      </AnimatedText>

      {/* 서브헤드라인 */}
      {slide.subheadline && (
        <AnimatedText delay={12} style={{ position: "absolute", top: 280, left: 60, right: 720 }}>
          <div
            style={{
              fontSize: 26,
              fontWeight: 400,
              color: BRAND.grey,
              fontFamily: FONT.primary,
            }}
          >
            {slide.subheadline}
          </div>
        </AnimatedText>
      )}

      {/* 바디 */}
      {slide.body && (
        <AnimatedText delay={18} style={{ position: "absolute", top: 360, left: 60, right: 720 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {slide.body.split("\n").map((line, i) => {
              const hasBullet = !/^[①②③④⑤⑥⑦⑧⑨\[\d]/.test(line.trim());
              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    fontSize: 28,
                    fontWeight: 400,
                    color: BRAND.dark,
                    fontFamily: FONT.primary,
                    lineHeight: 1.5,
                  }}
                >
                  {hasBullet && (
                    <span style={{ color: BRAND.teal, fontWeight: 700, flexShrink: 0, marginTop: 2 }}>•</span>
                  )}
                  <span>{line}</span>
                </div>
              );
            })}
          </div>
        </AnimatedText>
      )}

      {/* 이미지 */}
      <AnimatedText delay={8} style={{ position: "absolute", top: 60, right: 60, width: 620, height: 660 }}>
        <img
          src={staticFile(imgPath)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            borderRadius: 16,
          }}
          alt={slide.title}
        />
      </AnimatedText>

      {/* 자막 */}
      {showSubtitles && <SubtitleOverlay text={slide.narration} />}
    </SlideWrapper>
  );
};
