"use client";

import { useState } from "react";
import { generateVideoScript } from "@/lib/action";

export default function UploadPage() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    try {
      const json = await generateVideoScript(formData);
      setResult(json);
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
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && <p className="text-red-600 mt-4">{error}</p>}

      {result && (
        <pre className="mt-6 bg-gray-100 p-4 rounded text-sm overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
