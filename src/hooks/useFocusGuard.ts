"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FocusEventKind = "away_start" | "away_end";

const BLOCKED = ["copy", "cut", "paste", "contextmenu", "selectstart", "dragstart"] as const;

/**
 * Anti-cheat while a question is on screen (SECURITY.md T16): blocks copy/paste/context menu and reports
 * each time the player leaves the page (tab switch, app switch, notification shade) and comes back.
 * A browser can't stop screenshots or a second phone; this deters and reports instead.
 */
export function useFocusGuard({
  active,
  onReport,
}: {
  active: boolean;
  onReport: (kind: FocusEventKind, awayMs?: number) => void;
}) {
  const [warning, setWarning] = useState(false);
  const awaySince = useRef<number | null>(null);
  const report = useRef(onReport);
  report.current = onReport;

  useEffect(() => {
    if (!active) return;

    const leave = () => {
      if (awaySince.current !== null) return;
      awaySince.current = Date.now();
      setWarning(true);
      report.current("away_start", undefined);
    };
    const back = () => {
      if (awaySince.current === null || document.visibilityState === "hidden") return;
      const away = Date.now() - awaySince.current;
      awaySince.current = null;
      report.current("away_end", away);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? leave() : back());
    const block = (e: Event) => e.preventDefault();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", leave);
    window.addEventListener("focus", back);
    window.addEventListener("pagehide", leave);
    BLOCKED.forEach((t) => document.addEventListener(t, block));
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", leave);
      window.removeEventListener("focus", back);
      window.removeEventListener("pagehide", leave);
      BLOCKED.forEach((t) => document.removeEventListener(t, block));
      awaySince.current = null;
    };
  }, [active]);

  const dismiss = useCallback(() => setWarning(false), []);
  return { warning, dismiss };
}
