"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { publicEnv } from "@/lib/env";
import { completeLogin } from "@/lib/spotify/auth";
import { useMusic } from "./MusicProvider";

/** Spotify redirects here with ?code&state after login; exchange it and return to where the host was. */
export function SpotifyCallback() {
  const router = useRouter();
  const { refreshAuth } = useMusic();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // the code is single-use; React dev mode runs effects twice
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    // Drop ?code from the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);
    void (async () => {
      try {
        const clientId = publicEnv().NEXT_PUBLIC_SPOTIFY_CLIENT_ID;
        if (!clientId) throw new Error("Spotify isn't set up on this deployment.");
        const next = await completeLogin({ params, clientId, origin: window.location.origin });
        refreshAuth();
        router.replace(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Spotify sign-in failed.");
      }
    })();
  }, [refreshAuth, router]);

  return error ? (
    <div className="flex flex-col gap-3">
      <p role="alert" className="text-red">
        {error}
      </p>
      <Link href="/admin/music" className="text-cyan underline">
        Back to Music
      </Link>
    </div>
  ) : (
    <p className="text-muted motion-safe:animate-pulse">Connecting Spotify…</p>
  );
}
