"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** Renders a QR code as an <img> (data URL; allowed by the CSP's img-src). */
export function QrImage({ text, size = 200, label, className = "" }: { text: string; size?: number; label: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(text, { margin: 1, width: size * 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(
      (url) => !cancelled && setSrc(url),
    );
    return () => {
      cancelled = true;
    };
  }, [text, size]);
  if (!src) return <div style={{ width: size, height: size }} className={`animate-pulse rounded bg-line ${className}`} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt={label} className={className} />;
}
