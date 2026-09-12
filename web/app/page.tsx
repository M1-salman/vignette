"use client";

import { useState } from "react";
import { generateVideoScript } from "@/lib/action";

type RenderResult = {
  status: "completed";
  videoUrl: string;
  durationSeconds: number;
};

const renderApiUrl = process.env.NEXT_PUBLIC_RENDER_API_URL || "http://localhost:4000";

export default function UploadPage() {
  const [result, setResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const videoScript = await generateVideoScript(formData);
      const renderResponse = await fetch(`${renderApiUrl}/api/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoScript),
      });
      const renderResult = await renderResponse.json();
      if (!renderResponse.ok) throw new Error(renderResult.error || "Video rendering failed.");
      setResult(renderResult as RenderResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <form action={handleSubmit} className="space-y-4">
        <input
          type="file"
          name="screenshots"
          multiple
          accept="image/*"
          required
          className="block"
        />
        <textarea
          name="prompt"
          placeholder="Describe the demo you want..."
          required
          className="w-full border p-2 rounded"
          rows={4}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? "Generating and rendering..." : "Generate video"}
        </button>
      </form>

      {error && <p className="text-red-600 mt-4">{error}</p>}

      {result && <div className="mt-6 space-y-3 rounded border p-4">
        <p>Video ready ({result.durationSeconds} seconds).</p>
        <video src={result.videoUrl} controls className="w-full rounded" />
        <a href={result.videoUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open or download video</a>
      </div>}
    </div>
  );
}
