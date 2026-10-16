"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StateWord } from "@/components/ui/StateWord";
import { friendlyError } from "@/lib/errors";
import { parseChairQr } from "@/lib/qr";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { ScannerProblem } from "./Scanner";

const Scanner = dynamic(() => import("./Scanner"), { ssr: false });

const problems: Record<ScannerProblem, string> = {
  insecure: "The camera only works over a secure (https) link. Open the game from the official link.",
  denied: "Camera access is blocked. Allow the camera for this site in your browser settings, then tap Try again.",
  unavailable: "Couldn't start the camera. Close other apps using it and tap Try again.",
};

function allowedHosts(): string[] {
  const hosts = [window.location.host];
  try {
    hosts.push(new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").host);
  } catch {}
  return hosts;
}

export function ScanPanel({ onClaimed }: { onClaimed: () => void }) {
  const [scanning, setScanning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = () => {
    setMessage(null);
    setScanning(true);
    setAttempt((n) => n + 1);
    // Fullscreen needs a tap; it keeps players inside the game while they answer. Not all phones support it.
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const onCode = useCallback(
    async (text: string) => {
      const chair = parseChairQr(text, allowedHosts());
      if (!chair) {
        setMessage("That's not a game chair QR. Scan the code on your chair.");
        setAttempt((n) => n + 1);
        return;
      }
      setBusy(true);
      const { error } = await getBrowserSupabase().rpc("claim_chair", { p_chair_id: chair.chairId, p_secret: chair.secret });
      setBusy(false);
      if (error) {
        setMessage(friendlyError(error.message));
        setScanning(false);
        return;
      }
      navigator.vibrate?.(80);
      onClaimed();
    },
    [onClaimed],
  );

  return (
    <section className="flex flex-col items-center gap-5 text-center">
      <StateWord tone="amber">SCAN NOW</StateWord>
      <p className="text-text/80">Sit down and scan the QR code on your chair.</p>
      {scanning ? (
        <Scanner
          key={attempt}
          onCode={onCode}
          onProblem={(p) => {
            setScanning(false);
            setMessage(problems[p]);
          }}
        />
      ) : (
        <Button variant="attention" size="lg" className="w-full max-w-xs" onClick={start}>
          {message ? "Try again" : "Open scanner"}
        </Button>
      )}
      {busy && <p className="text-sm text-muted">Claiming your chair…</p>}
      {message && (
        <p role="alert" className="max-w-sm rounded-xl bg-red/10 p-3 text-sm text-red">
          {message}
        </p>
      )}
    </section>
  );
}
