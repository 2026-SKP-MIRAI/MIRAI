import React from "react";
import { Composition } from "remotion";
import { LwwPresentation, getTotalFrames } from "./compositions/LwwPresentation";

export const RemotionRoot: React.FC = () => {
  const totalFrames = getTotalFrames();

  return (
    <Composition
      id="LwwPresentation"
      component={LwwPresentation}
      durationInFrames={totalFrames}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
