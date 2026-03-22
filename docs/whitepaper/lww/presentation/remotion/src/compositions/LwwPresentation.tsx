import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { CTASlide } from "../slides/CTASlide";
import { CoverSlide } from "../slides/CoverSlide";
import { GenericSlide, SlideData } from "../slides/GenericSlide";
import slidesDataRaw from "../data/slides-data.json";

const slidesData = slidesDataRaw as { slides: SlideData[] };

const SHOW_SUBTITLES = true;

export const LwwPresentation: React.FC = () => {
  let frameOffset = 0;

  return (
    <>
      {slidesData.slides.map((slide) => {
        const durationInFrames =
          slide.durationInFrames ?? slide.targetSeconds * 30 + 30;

        const audioFile = `audio/${slide.audio}`;

        let SlideComponent: React.FC<{ slide: SlideData; showSubtitles?: boolean }>;
        if (slide.id === 1) {
          SlideComponent = CoverSlide;
        } else if (slide.id === 12) {
          SlideComponent = CTASlide;
        } else {
          SlideComponent = GenericSlide;
        }

        const currentOffset = frameOffset;
        frameOffset += durationInFrames;

        return (
          <Sequence
            key={slide.id}
            from={currentOffset}
            durationInFrames={durationInFrames}
            name={`Slide ${String(slide.id).padStart(2, "0")} — ${slide.title}`}
          >
            <SlideComponent slide={slide} showSubtitles={SHOW_SUBTITLES} />
            <Audio src={staticFile(audioFile)} />
          </Sequence>
        );
      })}
    </>
  );
};

// 총 프레임 수 계산 (Root.tsx에서 사용)
export const getTotalFrames = (): number => {
  return (slidesData.slides as SlideData[]).reduce((sum, slide) => {
    return sum + (slide.durationInFrames ?? slide.targetSeconds * 30 + 30);
  }, 0);
};
