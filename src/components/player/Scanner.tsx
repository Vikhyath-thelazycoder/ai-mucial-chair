"use client";

import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { useEffect, useRef, useState } from "react";

export type ScannerProblem = "insecure" | "denied" | "unavailable";

/** Rear-camera QR reader. Calls onCode once per mount; remount (change `key`) to scan again. */
export default function Scanner({
  onCode,
  onProblem,
}: {
  onCode: (text: string) => void;
  onProblem: (p: ScannerProblem) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const handlers = useRef({ onCode, onProblem });
  handlers.current = { onCode, onProblem };

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices) {
      handlers.current.onProblem("insecure");
      return;
    }
    let done = false;
    let controls: IScannerControls | undefined;
    const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 120 });
    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: "environment" } } }, video.current!, (result, _err, c) => {
        if (result && !done) {
          done = true;
          c.stop();
          handlers.current.onCode(result.getText());
        }
      })
      .then((c) => {
        controls = c;
        setReady(true);
        if (done) c.stop();
      })
      .catch((e: { name?: string }) => handlers.current.onProblem(e?.name === "NotAllowedError" ? "denied" : "unavailable"));
    return () => {
      done = true;
      controls?.stop();
    };
  }, []);

  return (
    <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-3xl bg-surface">
      <video ref={video} muted playsInline className="h-full w-full object-cover" aria-label="Camera view for scanning the chair QR code" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-4 rounded-2xl border-4 border-amber/80" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-4 top-1/2 h-0.5 bg-amber shadow-[0_0_18px_#FFB020] motion-safe:animate-pulse" />
      {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-muted">Starting camera…</p>}
    </div>
  );
}
