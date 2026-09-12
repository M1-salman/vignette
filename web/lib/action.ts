"use server";

import { uploadScreenshot } from "./cloudinary";
import { analyzeScreenshots } from "./gemini";

export async function generateVideoScript(formData: FormData) {
  const files = formData.getAll("screenshots") as File[];
  const prompt = formData.get("prompt") as string;

  const imageUrls = await Promise.all(files.map((file) => uploadScreenshot(file)));

  const structuredJson = await analyzeScreenshots(imageUrls, prompt);

  // The render server resolves screenshotIndex into imageUrls and randomly
  // selects a local copyright-free track during the render job.
  return { imageUrls, script: structuredJson };
}
