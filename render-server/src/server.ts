import "dotenv/config";
import cors from "cors";
import express from "express";
import { v2 as cloudinary } from "cloudinary";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DemoCompositionProps, RenderRequest } from "./types.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(directory, "..");
const publicDirectory = path.join(rootDirectory, "public");
const tempDirectory = path.join(rootDirectory, "tmp");
const port = Number(process.env.PORT || 4000);
const app = express();
let serveUrlPromise: Promise<string> | undefined;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

app.use(cors({ origin: process.env.WEB_ORIGIN?.split(",") || true }));
app.use(express.json({ limit: "200kb" }));

function assertRenderRequest(value: unknown): asserts value is RenderRequest {
  const request = value as RenderRequest;
  if (!request || !Array.isArray(request.imageUrls) || request.imageUrls.length === 0 || !request.script || !Array.isArray(request.script.scenes)) {
    throw new Error("imageUrls and script.scenes are required.");
  }
  if (request.imageUrls.length > 8 || request.script.totalDurationSeconds <= 0 || request.script.totalDurationSeconds > 30) {
    throw new Error("A demo must use 1–8 screenshots and be at most 30 seconds.");
  }
  if (!['aurora', 'editorial', 'minimal', 'neon'].includes(request.script.visualStyle)) {
    throw new Error("The script must include a supported visualStyle.");
  }
  const lastEnd = request.script.scenes.reduce((latest, scene) => {
    if (!Number.isInteger(scene.screenshotIndex) || scene.screenshotIndex < 0 || scene.screenshotIndex >= request.imageUrls.length) {
      throw new Error("A scene references an invalid screenshotIndex.");
    }
    if (scene.startSeconds < 0 || scene.durationSeconds <= 0) throw new Error("A scene has invalid timing.");
    return Math.max(latest, scene.startSeconds + scene.durationSeconds);
  }, 0);
  if (lastEnd > 30.001 || request.script.totalDurationSeconds < lastEnd) throw new Error("Scenes exceed the video duration.");
}

async function chooseMusicTrack() {
  const tracks = (await readdir(path.join(publicDirectory, "music"))).filter((file) => /^music-\d+\.mp3$/i.test(file));
  if (tracks.length === 0) throw new Error("No music tracks were found in public/music.");
  return tracks[Math.floor(Math.random() * tracks.length)];
}

function getServeUrl() {
  // Bundling once per server process saves several seconds per render on a
  // constrained free Render instance.
  serveUrlPromise ??= bundle({
    entryPoint: path.join(rootDirectory, "src", "remotion", "index.ts"),
    publicDir: publicDirectory,
  });
  return serveUrlPromise;
}

app.get("/health", (_request, response) => response.json({ ok: true }));

// Synchronous for the first version. Keep this response shape when replacing it
// with POST /api/renders -> { jobId } and GET /api/renders/:jobId later.
app.post("/api/render", async (request, response) => {
  const renderId = crypto.randomUUID();
  const outputLocation = path.join(tempDirectory, `${renderId}.mp4`);
  try {
    assertRenderRequest(request.body);
    await mkdir(tempDirectory, { recursive: true });
    const musicTrack = await chooseMusicTrack();
    // Gemini chooses the design family, while the variation makes repeated
    // renders feel fresh even when the same prompt is submitted again.
    const inputProps: DemoCompositionProps = { ...request.body, musicTrack, designVariation: Math.floor(Math.random() * 3) };
    const serveUrl = await getServeUrl();
    const composition = await selectComposition({
      serveUrl,
      id: "ProductDemo",
      inputProps,
    });
    const durationInFrames = Math.ceil(inputProps.script.totalDurationSeconds * composition.fps);
    await renderMedia({
      composition: { ...composition, durationInFrames },
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      concurrency: 1,
    });
    const upload = await cloudinary.uploader.upload(outputLocation, {
      resource_type: "video",
      folder: "vignette/renders",
      public_id: `demo-${renderId}`,
      overwrite: false,
    });
    response.status(201).json({ status: "completed", videoUrl: upload.secure_url, durationSeconds: inputProps.script.totalDurationSeconds, visualStyle: inputProps.script.visualStyle });
  } catch (error) {
    console.error("Render failed", error);
    response.status(400).json({ status: "failed", error: error instanceof Error ? error.message : "Unable to render video." });
  } finally {
    await rm(outputLocation, { force: true });
  }
});

app.listen(port, () => console.log(`Render server listening on port ${port}`));
