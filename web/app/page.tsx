"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Instrument_Serif, Hanken_Grotesk } from "next/font/google";
import { generateVideoScript } from "@/lib/action";

const display = Instrument_Serif({ subsets: ["latin"], weight: "400" });
const body = Hanken_Grotesk({ subsets: ["latin"] });

type RenderResult = {
  status: "completed";
  videoUrl: string;
  durationSeconds: number;
};

type Stage = "script" | "render";

type ErrorReport = {
  source: string; // which part of the system failed
  title: string;
  message: string;
  status?: number;
  endpoint?: string;
  digest?: string;
  raw?: string; // full server response / stack, for debugging
  time: string;
};

const renderApiUrl =
  process.env.NEXT_PUBLIC_RENDER_API_URL || "http://localhost:4000";
const renderEndpoint = `${renderApiUrl}/api/render`;

const steps: { key: Stage; label: string; where: string }[] = [
  { key: "script", label: "Writing the script", where: "Next.js server action" },
  { key: "render", label: "Rendering the video", where: renderApiUrl },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function scriptErrorReport(err: unknown): ErrorReport {
  const e = err as (Error & { digest?: string }) | undefined;
  const message = e?.message || String(err);
  const masked = /Server Components render|omitted in production/i.test(message);
  return {
    source: "Script generation (server action)",
    title: "Couldn't generate the script",
    message: masked
      ? "Next.js hid the real error message because this is a production build. Check the server logs and search for the digest below."
      : message,
    digest: e?.digest,
    raw: e?.stack || message,
    time: new Date().toISOString(),
  };
}

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<RenderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<ErrorReport | null>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  );
  useEffect(() => {
    return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
  }, [previews]);

  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}-${f.size}-${f.lastModified}`));
      return [
        ...prev,
        ...incoming.filter((f) => !seen.has(`${f.name}-${f.size}-${f.lastModified}`)),
      ];
    });
  }

  function onDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragging(false);
    if (!loading) addFiles(e.dataTransfer.files);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (files.length === 0) {
      setError({
        source: "Form",
        title: "No screenshots added",
        message: "Add at least one screenshot before generating.",
        time: new Date().toISOString(),
      });
      return;
    }

    const formData = new FormData();
    files.forEach((f) => formData.append("screenshots", f));
    formData.append("prompt", prompt);

    setLoading(true);
    try {
      // Stage 1: script (server action)
      setStage("script");
      let videoScript: unknown;
      try {
        videoScript = await generateVideoScript(formData);
      } catch (err) {
        setError(scriptErrorReport(err));
        return;
      }

      // Stage 2: render server
      setStage("render");
      let response: Response;
      try {
        response = await fetch(renderEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(videoScript),
        });
      } catch (err) {
        setError({
          source: "Render server",
          title: "Render server is unreachable",
          message: `The browser could not connect to ${renderEndpoint}. Check that the render server is running and that CORS allows this origin.`,
          endpoint: renderEndpoint,
          raw: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
          time: new Date().toISOString(),
        });
        return;
      }

      const text = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* response wasn't JSON */
      }

      if (!response.ok) {
        setError({
          source: "Render server",
          title: "Render server returned an error",
          message:
            json?.error ||
            json?.message ||
            text.slice(0, 300) ||
            response.statusText ||
            "No error message in the response.",
          status: response.status,
          endpoint: renderEndpoint,
          raw: text || "(empty response body)",
          time: new Date().toISOString(),
        });
        return;
      }

      if (!json?.videoUrl) {
        setError({
          source: "Render server",
          title: "Unexpected response from render server",
          message: "The request succeeded but the response has no videoUrl.",
          status: response.status,
          endpoint: renderEndpoint,
          raw: text,
          time: new Date().toISOString(),
        });
        return;
      }

      setResult(json as RenderResult);
    } finally {
      setLoading(false);
      setStage(null);
    }
  }

  async function copyError() {
    if (!error) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(error, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  }

  const activeIndex = stage ? steps.findIndex((s) => s.key === stage) : -1;

  return (
    <main
      className={`${body.className} relative min-h-screen bg-[#ECEEEF] text-[#1C2229] antialiased`}
    >
      {/* The vignette: soft darkening toward the page edges */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(28,34,41,0.17)_100%)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-10 lg:grid-cols-[5fr_7fr] lg:gap-20 lg:py-20">
        <header className="lg:sticky lg:top-20 lg:self-start">
          <p className="text-lg font-semibold tracking-tight">Vignette</p>
          <h1
            className={`${display.className} mt-10 text-5xl leading-[1.02] tracking-tight sm:text-6xl`}
          >
            Screenshots in, demo video out.
          </h1>
          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-[#5B6570]">
            Upload the screens of your product and describe the story to tell.
            Vignette writes the script and renders the video.
          </p>
        </header>

        <section>
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border border-[#1C2229]/10 bg-[#F8F9F9] p-6 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset,0_18px_40px_-24px_rgba(28,34,41,0.35)] sm:p-8"
          >
            {/* Screenshots */}
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Screenshots</span>
                {files.length > 0 && (
                  <span className="text-xs text-[#5B6570]">
                    {files.length} added ·{" "}
                    {formatBytes(files.reduce((n, f) => n + f.size, 0))}
                  </span>
                )}
              </div>

              <label
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-10 text-center transition-colors focus-within:ring-2 focus-within:ring-[#3B4F7A] focus-within:ring-offset-2 focus-within:ring-offset-[#F8F9F9] ${
                  dragging
                    ? "border-[#3B4F7A] bg-[#3B4F7A]/6"
                    : "border-[#1C2229]/25 hover:border-[#1C2229]/50"
                } ${loading ? "pointer-events-none opacity-50" : ""}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={loading}
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="text-[15px] font-medium">
                  Drop screenshots here, or browse
                </span>
                <span className="mt-1 text-xs text-[#5B6570]">
                  PNG, JPG or WebP
                </span>
              </label>

              {previews.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {previews.map(({ file, url }, i) => (
                    <li key={`${file.name}-${file.lastModified}-${i}`} className="group relative">
                      <div className="aspect-4/3 overflow-hidden rounded border border-[#1C2229]/10 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={file.name}
                          className="size-full object-cover object-top"
                        />
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#5B6570]" title={file.name}>
                        {file.name}
                      </p>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${file.name}`}
                        className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-[#1C2229]/80 text-sm leading-none text-white opacity-100 transition-opacity hover:bg-[#1C2229] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4F7A] sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Prompt */}
            <div className="mt-8">
              <label htmlFor="prompt" className="text-sm font-medium">
                What should the demo show?
              </label>
              <textarea
                id="prompt"
                name="prompt"
                required
                rows={4}
                value={prompt}
                disabled={loading}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Walk through signing up, creating an invoice, and sending it to a client."
                className="mt-3 w-full resize-y rounded-md border border-[#1C2229]/20 bg-white px-3.5 py-3 text-[15px] leading-relaxed placeholder:text-[#8A939C] focus:border-[#3B4F7A] focus:outline-none focus:ring-2 focus:ring-[#3B4F7A]/30 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-8 inline-flex w-full items-center justify-center rounded-md bg-[#1C2229] px-5 py-3 text-[15px] font-medium text-[#F8F9F9] transition-colors hover:bg-[#2C3542] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B4F7A] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Working…" : "Generate video"}
            </button>

            {/* Progress */}
            {loading && (
              <ol className="mt-6 space-y-3 border-t border-[#1C2229]/10 pt-5" aria-live="polite">
                {steps.map((s, i) => {
                  const state = i < activeIndex ? "done" : i === activeIndex ? "active" : "pending";
                  return (
                    <li key={s.key} className="flex items-center gap-3 text-sm">
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${
                          state === "done"
                            ? "bg-[#3B4F7A]"
                            : state === "active"
                            ? "animate-pulse bg-[#3B4F7A]"
                            : "border border-[#1C2229]/30"
                        }`}
                      />
                      <span className={state === "pending" ? "text-[#8A939C]" : ""}>
                        {s.label}
                      </span>
                      <span className="ml-auto truncate text-xs text-[#8A939C]">{s.where}</span>
                    </li>
                  );
                })}
                <li className="pl-5.5 text-xs text-[#5B6570]">
                  {elapsed}s elapsed. Rendering can take a few minutes; keep this tab open.
                </li>
              </ol>
            )}
          </form>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="mt-6 overflow-hidden rounded-lg border border-[#A23B2E]/30 bg-[#FBF3F1]"
            >
              <div className="border-l-4 border-[#A23B2E] p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[#A23B2E]">
                      {error.source}
                      {error.status ? ` · HTTP ${error.status}` : ""}
                    </p>
                    <h2 className="mt-1 text-base font-semibold">{error.title}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setError(null)}
                    aria-label="Dismiss error"
                    className="-mr-1 -mt-1 rounded p-1 text-[#5B6570] hover:text-[#1C2229] focus-visible:outline-2 focus-visible:outline-[#A23B2E]"
                  >
                    ×
                  </button>
                </div>

                <p className="mt-3 whitespace-pre-wrap wrap-break-word rounded bg-white/70 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-[#1C2229]">
                  {error.message}
                </p>

                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 text-xs">
                  {error.endpoint && (
                    <>
                      <dt className="text-[#5B6570]">Endpoint</dt>
                      <dd className="break-all font-mono">{error.endpoint}</dd>
                    </>
                  )}
                  {error.status && (
                    <>
                      <dt className="text-[#5B6570]">Status</dt>
                      <dd className="font-mono">{error.status}</dd>
                    </>
                  )}
                  {error.digest && (
                    <>
                      <dt className="text-[#5B6570]">Digest</dt>
                      <dd className="break-all font-mono">{error.digest}</dd>
                    </>
                  )}
                  <dt className="text-[#5B6570]">Time</dt>
                  <dd className="font-mono">{error.time}</dd>
                </dl>

                {error.raw && (
                  <details className="mt-4 group">
                    <summary className="cursor-pointer text-xs font-medium text-[#A23B2E] hover:underline">
                      Raw server response
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto rounded bg-[#1C2229] p-3 font-mono text-[12px] leading-relaxed text-[#E6E9EC]">
                      {error.raw}
                    </pre>
                  </details>
                )}

                <button
                  type="button"
                  onClick={copyError}
                  className="mt-4 rounded border border-[#A23B2E]/40 px-3 py-1.5 text-xs font-medium text-[#A23B2E] transition-colors hover:bg-[#A23B2E]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#A23B2E]"
                >
                  {copied ? "Copied" : "Copy error details"}
                </button>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="mt-6 rounded-lg border border-[#1C2229]/10 bg-[#F8F9F9] p-5 sm:p-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">Your video is ready</h2>
                <span className="text-xs text-[#5B6570]">{result.durationSeconds} seconds</span>
              </div>
              <video
                src={result.videoUrl}
                controls
                className="mt-4 w-full rounded bg-black"
              />
              <a
                href={result.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-block text-sm font-medium text-[#3B4F7A] underline underline-offset-4 hover:text-[#1C2229]"
              >
                Open video in a new tab
              </a>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}