import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export type VisualStyle = "aurora" | "editorial" | "minimal" | "neon";

export type DemoScript = {
  version: "1";
  visualStyle: VisualStyle;
  totalDurationSeconds: number;
  scenes: Array<{
    id: string;
    screenshotIndex: number;
    startSeconds: number;
    durationSeconds: number;
    title: string;
    narration: string;
    caption: string;
    animation: "static" | "zoom-in" | "pan";
    focus: { x: number; y: number; scale: number };
  }>;
};

// Contract consumed by the Render/Remotion service. Gemini never chooses image
// URLs or music; the backend assigns those at render time.
const DEMO_SCRIPT_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["version", "visualStyle", "totalDurationSeconds", "scenes"],
  properties: {
    version: { type: "string", enum: ["1"] },
    visualStyle: { type: "string", enum: ["aurora", "editorial", "minimal", "neon"] },
    totalDurationSeconds: { type: "number", minimum: 1, maximum: 30 },
    scenes: {
      type: "array", minItems: 1, maxItems: 8,
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "screenshotIndex", "startSeconds", "durationSeconds", "title", "narration", "caption", "animation", "focus"],
        properties: {
          id: { type: "string" }, screenshotIndex: { type: "integer", minimum: 0 },
          startSeconds: { type: "number", minimum: 0, maximum: 29.9 },
          durationSeconds: { type: "number", exclusiveMinimum: 0, maximum: 15 },
          title: { type: "string", maxLength: 80 }, narration: { type: "string", maxLength: 240 }, caption: { type: "string", maxLength: 100 },
          animation: { type: "string", enum: ["static", "zoom-in", "pan"] },
          focus: {
            type: "object", additionalProperties: false, required: ["x", "y", "scale"],
            properties: {
              x: { type: "number", minimum: 0, maximum: 1 }, y: { type: "number", minimum: 0, maximum: 1 },
              scale: { type: "number", minimum: 1, maximum: 1.35 },
            },
          },
        },
      },
    },
  },
} as const;

async function urlToInlineData(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image from ${url}: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType: res.headers.get("content-type") || "image/jpeg" };
}

function assertDemoScript(value: unknown, screenshotCount: number): asserts value is DemoScript {
  const script = value as DemoScript;
  if (!script || script.version !== "1" || !["aurora", "editorial", "minimal", "neon"].includes(script.visualStyle) || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error("Gemini returned a video script with an invalid top-level structure.");
  }
  const end = script.scenes.reduce((latest, scene) => {
    if (!Number.isInteger(scene.screenshotIndex) || scene.screenshotIndex < 0 || scene.screenshotIndex >= screenshotCount) {
      throw new Error("Gemini referenced a screenshot that was not uploaded.");
    }
    if (!Number.isFinite(scene.startSeconds) || !Number.isFinite(scene.durationSeconds) || scene.startSeconds < 0 || scene.durationSeconds <= 0) {
      throw new Error("Gemini returned an invalid scene duration.");
    }
    return Math.max(latest, scene.startSeconds + scene.durationSeconds);
  }, 0);
  if (!Number.isFinite(script.totalDurationSeconds) || script.totalDurationSeconds < end || script.totalDurationSeconds > 30 || end > 30.001) {
    throw new Error("Gemini produced a script longer than the 30-second limit.");
  }
}

export async function analyzeScreenshots(imageUrls: string[], userPrompt: string): Promise<DemoScript> {
  const images = await Promise.all(imageUrls.map(urlToInlineData));
  const instruction = `You create short product-demo video scripts for Remotion.
The user request is: ${userPrompt}

The attached images are screenshots indexed from 0 to ${imageUrls.length - 1} in attachment order.
Return ONLY the schema-defined JSON. Create a coherent sequence using those screenshotIndex values.
The final scene must end at or before 30 seconds. Choose visualStyle to match the product: aurora for modern/SaaS, editorial for premium/professional, minimal for clean/productive, neon for bold/creator tools. Do not return image URLs, pixel coordinates, UI-element labels, music, markdown, or fields not in the schema. focus.x and focus.y are normalized 0..1 values.`;

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [{ role: "user", parts: [{ text: instruction }, ...images.map((img) => ({ inlineData: img }))] }],
    config: { responseMimeType: "application/json", responseJsonSchema: DEMO_SCRIPT_SCHEMA },
  });
  if (!response.text) throw new Error("Gemini returned no text in response.");
  const script: unknown = JSON.parse(response.text);
  assertDemoScript(script, imageUrls.length);
  return script;
}
