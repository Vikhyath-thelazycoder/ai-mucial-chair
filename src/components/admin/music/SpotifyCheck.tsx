"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { SpotifyApiError, type Device, type Playback } from "@/lib/spotify/api";
import { overall, playTestSong, spotifyChecks, type CheckStatus } from "@/lib/spotify/diagnostics";
import { useMusic } from "./MusicProvider";

const ICON: Record<CheckStatus, { mark: string; tone: string; word: string }> = {
  pass: { mark: "✓", tone: "text-lime", word: "OK" },
  warn: { mark: "!", tone: "text-amber", word: "Check" },
  fail: { mark: "✕", tone: "text-red", word: "Problem" },
  skip: { mark: "–", tone: "text-muted", word: "Skipped" },
};

const VERDICT = {
  ready: { text: "Spotify is ready for the game.", tone: "text-lime" },
  attention: { text: "Spotify works, but check the items marked below.", tone: "text-amber" },
  broken: { text: "Spotify isn't ready. Fix the problems below, or run the game with the Music stopped button.", tone: "text-red" },
} as const;

/** Settings › Spotify check: is Spotify connected, which devices it sees, and is music really playing here. */
export function SpotifyCheck() {
  const m = useMusic();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const connected = m.status === "connecting" || m.status === "ready" || Boolean(m.account);

  const check = useCallback(async () => {
    if (!m.api || !connected) return;
    setChecking(true);
    try {
      const [d, p] = await Promise.all([m.api.devices(), m.api.playback()]);
      setDevices(d);
      setPlayback(p);
      setApiError(null);
    } catch (e) {
      setDevices(null);
      setApiError(e instanceof SpotifyApiError ? e.message : "Couldn't reach Spotify.");
    } finally {
      setChecking(false);
      setCheckedAt(new Date().toLocaleTimeString());
    }
  }, [m.api, connected]);

  // Re-check when the player connects and whenever the song or play/pause changes.
  const songKey = `${m.deviceId}|${m.nowPlaying?.name}|${m.nowPlaying?.paused}`;
  useEffect(() => {
    void check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songKey]);

  const checks = spotifyChecks({
    configured: m.status !== "unconfigured",
    redirectUri: m.redirectUri,
    connected,
    account: m.account,
    deviceId: m.deviceId,
    devices,
    playback,
    apiError,
  });
  const verdict = VERDICT[overall(checks)];

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    await m.attempt(async (api, deviceId) => setTestResult(await playTestSong(api, deviceId)));
    setTesting(false);
    await check();
  };

  const playingHere = Boolean(m.nowPlaying && !m.nowPlaying.paused);

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">Spotify check</h2>
          <p className={`mt-1 text-sm ${verdict.tone}`} role="status">
            {verdict.text}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status === "unconfigured" ? null : !connected ? (
            <Button onClick={() => void m.connect()}>Connect Spotify</Button>
          ) : (
            <>
              <Button variant="ghost" disabled={checking} onClick={() => void check()}>
                {checking ? "Checking…" : "Check again"}
              </Button>
              {playingHere ? (
                <Button variant="ghost" onClick={() => void m.pauseQuietly()}>
                  Stop test song
                </Button>
              ) : (
                <Button disabled={testing || !m.deviceId} onClick={() => void runTest()}>
                  {testing ? "Starting…" : "Play test song"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3 text-sm">
            <span className={`mt-0.5 w-5 shrink-0 text-center font-bold ${ICON[c.status].tone}`} aria-hidden="true">
              {ICON[c.status].mark}
            </span>
            <div className="min-w-0">
              <p className="font-medium">
                {c.label} <span className="sr-only">: {ICON[c.status].word}</span>
              </p>
              <p className="break-words text-muted">{c.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {devices && devices.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs tracking-[0.08em] text-muted uppercase">Devices on this Spotify account</h3>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {devices.map((d, i) => {
              const ours = Boolean(d.id && d.id === m.deviceId);
              const here = playback?.deviceId === d.id && d.id;
              return (
                <li key={d.id ?? `${d.name}-${i}`} className={`rounded-xl border p-3 text-sm ${d.active ? "border-cyan" : "border-line"}`}>
                  <p className="truncate font-medium" title={d.name}>
                    {d.name}
                    {ours && <span className="text-cyan"> · this laptop</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {d.type}
                    {d.active ? " · active" : ""}
                    {d.volume !== null ? ` · volume ${d.volume}%` : ""}
                  </p>
                  {here && playback?.track && (
                    <p className="mt-1 truncate text-xs" title={playback.track.name}>
                      {playback.playing ? "▶ Playing" : "❚❚ Paused"}: {playback.track.name}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {testResult && (
        <p role="alert" className={`mt-4 rounded-xl p-3 text-sm ${testResult.ok ? "bg-lime/10 text-lime" : "bg-red/10 text-red"}`}>
          {testResult.detail}
        </p>
      )}
      {m.error && !testResult && (
        <p role="alert" className="mt-4 rounded-xl bg-red/10 p-3 text-sm text-red">
          {m.error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        The test never opens the scan window, even mid-round. {checkedAt ? `Last checked ${checkedAt}.` : ""}
      </p>
    </Panel>
  );
}
