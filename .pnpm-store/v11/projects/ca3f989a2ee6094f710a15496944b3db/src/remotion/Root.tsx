import { Composition } from "remotion";
import { DemoVideo } from "./DemoVideo";
import type { DemoCompositionProps } from "../types";

export const DemoRoot = () => (
  <Composition<any, DemoCompositionProps>
    id="ProductDemo"
    component={DemoVideo}
    width={1280}
    height={720}
    fps={30}
    durationInFrames={30 * 30}
    defaultProps={{
      imageUrls: [],
      musicTrack: "music-1.mp3",
      designVariation: 0,
      script: { version: "1", visualStyle: "aurora", totalDurationSeconds: 1, scenes: [] },
    }}
  />
);
