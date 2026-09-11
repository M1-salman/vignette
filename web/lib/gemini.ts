import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function urlToInlineData(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${res.status}`);
  }
  const mimeType = res.headers.get("content-type") || "image/jpeg";
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString("base64"), mimeType };
}

export async function analyzeScreenshots(imageUrls: string[], prompt: string) {
  const images = await Promise.all(imageUrls.map(urlToInlineData));

  const response = await ai.models.generateContent({
    model: "gemini-3.5-flash-lite",
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          ...images.map((img) => ({
            inlineData: { data: img.data, mimeType: img.mimeType },
          })),
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned no text in response — check for content blocking or an empty response.");
  }

  return JSON.parse(response.text);
}