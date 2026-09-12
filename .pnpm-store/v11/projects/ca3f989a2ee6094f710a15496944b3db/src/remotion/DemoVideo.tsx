import { AbsoluteFill, Audio, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { DemoCompositionProps, DemoScene } from "../types";

const fps = 30;
const transitionFrames = 12;

const designPalettes = {
  aurora: ["#8b5cf6", "#22d3ee", "#070b18", "rgba(100,115,255,.33)"],
  editorial: ["#d97706", "#fb7185", "#faf7f2", "rgba(251,191,36,.30)"],
  minimal: ["#111827", "#64748b", "#f8fafc", "rgba(148,163,184,.28)"],
  neon: ["#ec4899", "#a3e635", "#080511", "rgba(236,72,153,.34)"],
} as const;

function Scene({ scene, imageUrl, index, sceneCount, isLast, visualStyle, designVariation }: { scene: DemoScene; imageUrl: string; index: number; sceneCount: number; isLast: boolean; visualStyle: DemoCompositionProps["script"]["visualStyle"]; designVariation: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const sceneFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
  const motionProgress = interpolate(frame, [0, sceneFrames], [0, 1], { easing: Easing.inOut(Easing.cubic), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const entrance = spring({ frame, fps, config: { damping: 18, stiffness: 105, mass: 0.7 } });
  const exit = isLast ? 1 : interpolate(frame, [sceneFrames, sceneFrames + transitionFrames], [1, 0], { easing: Easing.inOut(Easing.quad), extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) * exit;
  const targetScale = scene.animation === "zoom-in" ? scene.focus.scale : scene.animation === "pan" ? 1.08 : 1.025;
  const scale = interpolate(motionProgress, [0, 1], [1.005, targetScale]);
  const motionStrength = scene.animation === "pan" ? 0.2 : 0.055;
  const x = interpolate(motionProgress, [0, 1], [0, (0.5 - scene.focus.x) * width * motionStrength]);
  const y = interpolate(motionProgress, [0, 1], [0, (0.5 - scene.focus.y) * height * motionStrength]);
  const clickFrame = Math.round(sceneFrames * 0.42);
  const click = interpolate(frame, [clickFrame - 5, clickFrame, clickFrame + 13], [0, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const [accentA, accentB, background, glow] = designPalettes[visualStyle];
  const isEditorial = visualStyle === "editorial";
  const isMinimal = visualStyle === "minimal";
  const framePlacement = isEditorial
    ? { left: "40%", right: "5%", top: "16%", bottom: "16%" }
    : isMinimal
      ? { left: "9%", right: "9%", top: "19%", bottom: "18%" }
      : { left: "6%", right: "6%", top: "17%", bottom: "16%" };
  const captionPlacement = isEditorial
    ? { left: 54, right: "66%", bottom: 112, color: "#172033", fontFamily: "Arial, sans-serif" }
    : { left: 54, right: 54, bottom: isMinimal ? 30 : 42, color: "white", fontFamily: "Arial, sans-serif" };

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: background, overflow: "hidden" }}>
      {!isEditorial && <Img src={imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover", filter: `blur(32px) brightness(${isMinimal ? ".78" : ".38"}) saturate(1.35)`, opacity: isMinimal ? 0.15 : 0.72, transform: "scale(1.13)" }} />}
      <AbsoluteFill style={{ background: isEditorial ? "linear-gradient(130deg, #fff7e8 0%, #f6ede3 55%, #f1d6d8 100%)" : `radial-gradient(circle at ${designVariation === 0 ? "12% 0%" : designVariation === 1 ? "86% 16%" : "50% 0%"}, ${glow}, transparent 38%), linear-gradient(135deg, ${background}, ${isMinimal ? "rgba(226,232,240,.92)" : "rgba(9,4,32,.76)"})` }} />
      <div style={{ position: "absolute", top: 38, left: 54, right: 54, display: "flex", justifyContent: "space-between", alignItems: "center", color: isEditorial || isMinimal ? "#172033" : "white", fontFamily: "Arial, sans-serif", fontSize: 17, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" }}>
        <span style={{ padding: "10px 15px", border: `1px solid ${isEditorial || isMinimal ? "rgba(23,32,51,.2)" : "rgba(255,255,255,.24)"}`, borderRadius: 999, background: isEditorial || isMinimal ? "rgba(255,255,255,.62)" : "rgba(8,11,25,.48)", backdropFilter: "blur(12px)" }}>{isEditorial ? "Product story" : "Product tour"}</span>
        <span style={{ opacity: 0.82 }}>{String(index + 1).padStart(2, "0")} / {String(sceneCount).padStart(2, "0")}</span>
      </div>
      <div style={{ position: "absolute", top: 93, left: 54, right: 54, height: 3, borderRadius: 9, background: isEditorial || isMinimal ? "rgba(23,32,51,.18)" : "rgba(255,255,255,.18)" }}><div style={{ width: `${((index + motionProgress) / sceneCount) * 100}%`, height: "100%", borderRadius: 9, background: `linear-gradient(90deg, ${accentA}, ${accentB})` }} /></div>
      <div style={{ position: "absolute", ...framePlacement, borderRadius: isMinimal ? 12 : 24, overflow: "hidden", background: isMinimal ? "white" : "#0e1528", border: `1px solid ${isMinimal || isEditorial ? "rgba(23,32,51,.18)" : "rgba(255,255,255,.22)"}`, boxShadow: isMinimal ? "0 24px 70px rgba(15,23,42,.16)" : "0 38px 90px rgba(0,0,0,.55)", transform: `translate(${x}px, ${interpolate(entrance, [0, 1], [38, 0]) + y}px) scale(${interpolate(entrance, [0, 1], [0.96, 1])})` }}>
        {!isMinimal && <div style={{ height: 34, background: `linear-gradient(90deg, ${accentA}, ${background})`, display: "flex", alignItems: "center", gap: 8, paddingLeft: 16 }}>{["#fb7185", "#fbbf24", "#4ade80"].map((color) => <div key={color} style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />)}<div style={{ marginLeft: 12, width: "36%", height: 12, borderRadius: 99, background: "rgba(255,255,255,.18)" }} /></div>}
        <Img src={imageUrl} style={{ width: "100%", height: isMinimal ? "100%" : "calc(100% - 34px)", objectFit: "contain", backgroundColor: "#fff", transform: `translate(${x * 0.35}px, ${y * 0.35}px) scale(${scale})`, transformOrigin: `${scene.focus.x * 100}% ${scene.focus.y * 100}%` }} />
      </div>
      <div style={{ position: "absolute", left: `${scene.focus.x * 88 + 6}%`, top: `${scene.focus.y * 67 + 17}%`, opacity: click, transform: "translate(-4px, -2px)", pointerEvents: "none" }}><div style={{ width: 24, height: 31, background: "white", clipPath: "polygon(0 0, 0 100%, 28% 72%, 47% 100%, 61% 91%, 42% 63%, 78% 62%)", filter: "drop-shadow(0 3px 4px rgba(0,0,0,.65))" }} /><div style={{ position: "absolute", width: 46, height: 46, border: "2px solid rgba(34,211,238,.95)", borderRadius: "50%", left: -12, top: -10, transform: `scale(${1 + (1 - click) * 1.1})` }} /></div>
      <div style={{ position: "absolute", ...captionPlacement, transform: `translateY(${interpolate(entrance, [0, 1], [24, 0])}px)`, opacity: entrance }}><div style={{ display: "inline-block", maxWidth: "100%", padding: "17px 24px", borderRadius: isEditorial ? 0 : 18, background: isEditorial ? "transparent" : isMinimal ? "rgba(255,255,255,.82)" : "rgba(7,11,24,.72)", border: isEditorial ? "none" : `1px solid ${isMinimal ? "rgba(23,32,51,.16)" : "rgba(255,255,255,.2)"}`, boxShadow: isEditorial ? "none" : "0 12px 32px rgba(0,0,0,.28)", backdropFilter: "blur(16px)", fontSize: isEditorial ? 43 : 35, lineHeight: 1.16, fontWeight: 700 }}>{scene.caption || scene.title}</div></div>
    </AbsoluteFill>
  );
}

export function DemoVideo({ imageUrls, script, musicTrack, designVariation }: DemoCompositionProps) {
  return <AbsoluteFill><Audio src={staticFile(`music/${musicTrack}`)} volume={0.16} loop />{script.scenes.map((scene, index) => {
    const isLast = index === script.scenes.length - 1;
    return <Sequence key={scene.id} from={Math.round(scene.startSeconds * fps)} durationInFrames={Math.round(scene.durationSeconds * fps) + (isLast ? 0 : transitionFrames)}><Scene scene={scene} imageUrl={imageUrls[scene.screenshotIndex]} index={index} sceneCount={script.scenes.length} isLast={isLast} visualStyle={script.visualStyle} designVariation={designVariation} /></Sequence>;
  })}</AbsoluteFill>;
}
