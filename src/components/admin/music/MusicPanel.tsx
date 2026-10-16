"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { adminRpc, useAdminData } from "@/hooks/useAdminData";
import type { Playlist, Track } from "@/lib/spotify/api";
import { MusicBar } from "./MusicBar";
import { useMusic } from "./MusicProvider";

/** The Music page (F14): connect Spotify, search, playlists and the queue. */
export function MusicPanel() {
  const m = useMusic();
  const { data } = useAdminData();
  const ready = m.status === "ready" && Boolean(m.deviceId);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Music</h1>
        <Connection />
      </div>

      <MusicBar autoOpen={data.game?.auto_open_on_pause ?? true} />

      <Panel className="flex flex-wrap items-center justify-between gap-3 border-amber/40">
        <p className="text-sm text-muted">If Spotify fails, the game still runs: stop the music any way you like and press the button.</p>
        <Button variant="attention" disabled={data.spin?.phase !== "music"} onClick={() => void adminRpc("open_scan_window")}>
          Music stopped · open scan
        </Button>
      </Panel>

      {ready && m.api && (
        <div className="flex flex-wrap gap-5">
          <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-5">
            <Search />
            <Playlists />
          </div>
          <div className="min-w-0 flex-[1_1_300px]">
            <Queue />
          </div>
        </div>
      )}
    </div>
  );
}

function Connection() {
  const m = useMusic();
  if (m.status === "unconfigured") {
    return (
      <Panel className="w-full border-amber/40 text-sm">
        <p className="font-medium text-amber">Spotify isn&apos;t set up on this deployment.</p>
        <p className="mt-1 text-muted">
          Add <code className="font-mono">NEXT_PUBLIC_SPOTIFY_CLIENT_ID</code> in the hosting dashboard and redeploy. In the Spotify developer dashboard, add the redirect URI{" "}
          <code className="font-mono break-all text-text">{m.redirectUri}</code> and your Spotify account under Users and access.
        </p>
      </Panel>
    );
  }
  if (m.status === "disconnected" || (m.status === "error" && !m.account)) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button onClick={() => void m.connect()}>Connect Spotify</Button>
        <p className="text-xs text-muted">Needs Premium and desktop Chrome. Redirect URI: <span className="font-mono">{m.redirectUri}</span></p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm text-muted">
      <span>
        {m.status === "ready" ? "Connected" : m.status === "connecting" ? "Connecting" : "Problem"}
        {m.account ? ` as ${m.account.name}` : ""}
      </span>
      <Button variant="ghost" onClick={m.disconnect}>
        Disconnect
      </Button>
    </div>
  );
}

function TrackRow({ track, children }: { track: Track; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-xl p-2 hover:bg-bg">
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN art
        <img src={track.image} alt="" width={40} height={40} className="rounded-md" />
      ) : (
        <div className="size-10 rounded-md border border-line" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm" title={track.name}>
          {track.name}
        </p>
        <p className="truncate text-xs text-muted" title={track.artists}>
          {track.artists}
        </p>
      </div>
      <div className="flex shrink-0 gap-1">{children}</div>
    </li>
  );
}

const small = "min-h-9 rounded-lg border border-line px-2 text-xs hover:border-muted";

function Search() {
  const m = useMusic();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ tracks: Track[]; playlists: Playlist[] } | null>(null);

  const run = async () => {
    setBusy(true);
    await m.attempt(async (api) => setRes(await api.search(q)));
    setBusy(false);
  };

  return (
    <Panel>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label className="sr-only" htmlFor="music-search">
          Search Spotify
        </label>
        <input
          id="music-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search songs or playlists"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3"
        />
        <Button type="submit" disabled={busy || !q.trim()}>
          Search
        </Button>
      </form>
      {res && (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Songs</h2>
            {res.tracks.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No songs found.</p>
            ) : (
              <ul className="mt-1">
                {res.tracks.map((t) => (
                  <TrackRow key={t.uri} track={t}>
                    <button type="button" className={small} onClick={() => void m.attempt((api, d) => api.playTracks(d, [t.uri]))}>
                      Play
                    </button>
                    <button type="button" className={small} onClick={() => void m.attempt((api, d) => api.addToQueue(d, t.uri))}>
                      Queue
                    </button>
                  </TrackRow>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Playlists</h2>
            <PlaylistList playlists={res.playlists} />
          </div>
        </div>
      )}
    </Panel>
  );
}

function PlaylistList({ playlists }: { playlists: Playlist[] }) {
  const m = useMusic();
  if (playlists.length === 0) return <p className="mt-2 text-sm text-muted">No playlists found.</p>;
  return (
    <ul className="mt-1">
      {playlists.map((p) => (
        <TrackRow key={p.uri} track={{ uri: p.uri, name: p.name, artists: p.owner, image: p.image, durationMs: 0 }}>
          <button type="button" className={small} onClick={() => void m.attempt((api, d) => api.playContext(d, p.uri))}>
            Play
          </button>
        </TrackRow>
      ))}
    </ul>
  );
}

function Playlists() {
  const m = useMusic();
  const [list, setList] = useState<Playlist[] | null>(null);
  useEffect(() => {
    void m.attempt(async (api) => setList(await api.myPlaylists()));
    // Load once per connection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.deviceId]);
  return (
    <Panel>
      <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Your playlists</h2>
      {list === null ? <p className="mt-2 text-sm text-muted motion-safe:animate-pulse">Loading…</p> : <PlaylistList playlists={list} />}
    </Panel>
  );
}

function Queue() {
  const m = useMusic();
  const [queue, setQueue] = useState<{ current: Track | null; next: Track[] } | null>(null);
  const load = useCallback(() => m.attempt(async (api) => setQueue(await api.queue())), [m]);
  const trackName = m.nowPlaying?.name;
  useEffect(() => {
    void load();
    // Refresh whenever the song changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackName, m.deviceId]);

  return (
    <Panel>
      <div className="flex items-center justify-between">
        <h2 className="text-xs tracking-[0.08em] text-muted uppercase">Up next</h2>
        <button type="button" className="text-sm text-cyan" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      {!queue || queue.next.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing queued.</p>
      ) : (
        <ol className="mt-1">
          {queue.next.slice(0, 20).map((t, i) => (
            <TrackRow key={`${t.uri}-${i}`} track={t}>
              {null}
            </TrackRow>
          ))}
        </ol>
      )}
    </Panel>
  );
}
