export type DemoScene = {
  id: string;
  screenshotIndex: number;
  startSeconds: number;
  durationSeconds: number;
  title: string;
  narration: string;
  caption: string;
  animation: "static" | "zoom-in" | "pan";
  focus: { x: number; y: number; scale: number };
};

export type DemoScript = {
  version: "1";
  visualStyle: "aurora" | "editorial" | "minimal" | "neon";
  totalDurationSeconds: number;
  scenes: DemoScene[];
};

export type RenderRequest = {
  imageUrls: string[];
  script: DemoScript;
};

export type DemoCompositionProps = RenderRequest & {
  musicTrack: string;
  designVariation: number;
};
