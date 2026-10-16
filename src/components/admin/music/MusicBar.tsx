"use client";

import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/ui/Panel";
import { adminRpc } from "@/hooks/useAdminData";
import { friendlyError } from "@/lib/errors";
import { useMusic } from "./MusicProvider";

const ctl = "min-h-11 min-w-11 rounded-xl border border-line bg-bg px-3 text-sm hover:border-muted disabled:opacity-40";

/** Compact player on the game console: transport, volume and the "Pause opens scan window" switch (T-603). */
export function MusicBar({ autoOpen }: { autoOpen: boolean }) {
  const m = useMusic();
  const [toggleError, setToggleError] = useState<string | null>(null);
  const ready = m.status === "ready" && Boolean(m.deviceId);

  const setAutoOpen = async (on: boolean) => {
    const err = await adminRpc("update_game_settings", { p_auto_open_on_pause: on });
    setToggleError(err ? friendlyError(err) : null);
  };

  return (
    <Panel className="flex flex-wrap items-center gap-3" aria-label="Music">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {m.nowPlaying?.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art, already allowed by img-src
          <img src={m.nowPlaying.image} alt="" width={44} height={44} className="rounded-lg" />
        ) : (
          <div className="grid size-11 place-items-center rounded-lg border border-line text-cyan" aria-hidden="true">
            ♪
          </div>
        )}
        <div className="min-w-0">
          {m.status === "unconfigured" ? (
            <p className="text-sm text-muted">Spotify isn&apos;t set up. Use the Music stopped button.</p>
          ) : !ready ? (
            <p className="text-sm text-muted">
              {m.status === "connecting" ? "Connecting Spotify…" : "Spotify not connected."}{" "}
              <Link href="/admin/music" className="text-cyan underline">
                Music
              </Link>
            </p>
          ) : m.nowPlaying ? (
            <>
              <p className="truncate font-medium" title={m.nowPlaying.name}>
                {m.nowPlaying.name}
              </p>
              <p className="truncate text-xs text-muted" title={m.nowPlaying.artists}>
                {m.nowPlaying.paused ? "Paused · " : ""}
                {m.nowPlaying.artists}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">
              Ready. Pick music in{" "}
              <Link href="/admin/music" className="text-cyan underline">
                Music
              </Link>
              .
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button type="button" className={ctl} disabled={!ready} onClick={() => void m.previous()} aria-label="Previous track">
          ⏮
        </button>
        <button type="button" className={`${ctl} min-w-20 font-bold`} disabled={!ready} onClick={() => void m.togglePlay()}>
          {m.nowPlaying && !m.nowPlaying.paused ? "Pause" : "Play"}
        </button>
        <button type="button" className={ctl} disabled={!ready} onClick={() => void m.next()} aria-label="Next track">
          ⏭
        </button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <span className="sr-only">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={m.volume}
            disabled={!ready}
            onChange={(e) => void m.setVolume(Number(e.target.value))}
            className="w-24 accent-cyan"
          />
        </label>
      </div>

      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={autoOpen} onChange={(e) => void setAutoOpen(e.target.checked)} />
        Pause opens scan window
      </label>

      {(m.error || toggleError) && (
        <p role="alert" className="w-full text-sm text-red">
          {toggleError ?? m.error}
        </p>
      )}
      {m.notice && !m.error && (
        <p role="status" className="w-full text-sm text-amber">
          {m.notice}
        </p>
      )}
    </Panel>
  );
}
