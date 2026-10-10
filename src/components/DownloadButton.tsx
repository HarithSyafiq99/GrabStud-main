"use client";

import { useState } from "react";
import { beginLoading } from "@/lib/loading";
import { Icon } from "./Icon";

export function DownloadButton({
  url,
  filename,
  children,
}: {
  url: string;
  filename: string;
  children: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    if (busy) return;
    setBusy(true);
    setError("");
    const finish = beginLoading(
      filename.toLowerCase().endsWith(".pdf")
        ? "Preparing your PDF report…"
        : "Preparing your CSV download…",
    );
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error ?? "Could not download this report. Try again.",
        );
      }
      const file = await response.blob();
      const objectUrl = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download =
        response.headers
          .get("content-disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ?? filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      finish();
      setBusy(false);
    }
  }
  return (
    <div className="download-action">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={busy}
        onClick={download}
      >
        <Icon name="file" size={15} />
        {busy ? "Preparing…" : children}
      </button>
      {error ? (
        <p role="alert" className="text-xs text-rose-600 mt-2">
          {error}
        </p>
      ) : null}
    </div>
  );
}
