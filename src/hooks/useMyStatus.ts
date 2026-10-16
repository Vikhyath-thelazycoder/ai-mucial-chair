"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MyStatus } from "@/lib/game/types";
import { fetchMyStatus } from "@/lib/player/auth";
import { clockOffset } from "@/lib/player/countdown";
import { getBrowserSupabase } from "@/lib/supabase/client";

/** The signed-in player's own status; refetched whenever the public state changes or the page regains focus. */
export function useMyStatus(publicVersion: number, enabled: boolean) {
  const [me, setMe] = useState<MyStatus | null>(null);
  const [offsetMs, setOffsetMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++inflight.current;
    const sentAt = Date.now();
    try {
      const status = await fetchMyStatus(getBrowserSupabase());
      if (ticket !== inflight.current) return; // a newer request already won
      const halfTrip = (Date.now() - sentAt) / 2;
      setOffsetMs(clockOffset(status.serverNow, sentAt + halfTrip));
      setMe(status);
      setError(null);
    } catch (e) {
      if (ticket === inflight.current) setError(e instanceof Error ? e.message : "network");
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
    else setMe(null);
  }, [enabled, publicVersion, refresh]);

  useEffect(() => {
    if (!enabled) return;
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [enabled, refresh]);

  return { me, offsetMs, error, refresh };
}
