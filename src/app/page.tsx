"use client";

import { useState, useRef, useCallback } from "react";

type State = "idle" | "translating" | "done" | "error";

export default function Home() {
  const [state, setState] = useState<State>("idle");
  const [fileName, setFileName] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [downloadName, setDownloadName] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".srt")) {
      setErrorMsg("Please upload a .srt file");
      setState("error");
      return;
    }

    setFileName(file.name);
    setState("translating");
    setErrorMsg("");

    // Clean up previous download URL
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/translate", { method: "POST", body: form });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") || "";
      const nameMatch = disposition.match(/filename="([^"]+)"/);
      const outName = nameMatch ? nameMatch[1] : file.name.replace(/\.srt$/i, "_al.srt");

      setDownloadUrl(url);
      setDownloadName(outName);
      setState("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Translation failed");
      setState("error");
    }
  }, [downloadUrl]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl("");
    setDownloadName("");
    setFileName("");
    setState("idle");
    setErrorMsg("");
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Header */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">SRT Translator</h1>
          <p className="text-neutral-400 text-sm">English subtitles → Albanian (Shqip)</p>
        </div>

        {/* Drop zone */}
        {(state === "idle" || state === "error") && (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
              ${isDragging
                ? "border-sky-500 bg-sky-500/5"
                : "border-neutral-700 hover:border-neutral-500 bg-neutral-900/50"
              }
            `}
          >
            <div className="space-y-3">
              <div className="text-4xl">🎬</div>
              <p className="text-sm text-neutral-300">
                Drop your <span className="font-mono text-sky-400">.srt</span> file here
              </p>
              <p className="text-xs text-neutral-500">or click to browse</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".srt"
              className="hidden"
              onChange={onInputChange}
            />
          </div>
        )}

        {/* Translating */}
        {state === "translating" && (
          <div className="border border-neutral-800 rounded-xl p-10 text-center space-y-4 bg-neutral-900/50">
            <div className="flex justify-center">
              <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-300">Translating via Claude AI…</p>
              <p className="text-xs text-neutral-500 font-mono truncate">{fileName}</p>
            </div>
          </div>
        )}

        {/* Done */}
        {state === "done" && (
          <div className="border border-emerald-800/50 rounded-xl p-8 text-center space-y-5 bg-emerald-950/20">
            <div className="text-3xl">✅</div>
            <div className="space-y-1">
              <p className="text-sm text-neutral-300">Translation complete</p>
              <p className="text-xs text-neutral-500 font-mono truncate">{fileName}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={downloadUrl}
                download={downloadName}
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
              >
                Download {downloadName}
              </a>
              <button
                onClick={reset}
                className="px-5 py-2 rounded-lg border border-neutral-700 hover:border-neutral-500 text-sm text-neutral-300 transition-colors"
              >
                Translate another
              </button>
            </div>
          </div>
        )}

        {/* Error */}
        {state === "error" && (
          <div className="border border-red-800/50 rounded-xl p-6 space-y-3 bg-red-950/20">
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-sm text-neutral-300">{errorMsg}</p>
            <button
              onClick={reset}
              className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Try again →
            </button>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-neutral-600">
          Powered by Claude AI · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
}
