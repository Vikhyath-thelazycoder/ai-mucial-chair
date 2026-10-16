"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adminRpc } from "@/hooks/useAdminData";
import { publicEnv } from "@/lib/env";
import { friendlyError } from "@/lib/errors";
import type { PublicState } from "@/lib/game/types";
import { createSpotifyApi, SpotifyApiError, type Account, type SpotifyApi } from "@/lib/spotify/api";
import { beginLogin, clearSpotifyToken, getAccessToken, loadToken } from "@/lib/spotify/auth";
import { isMusicStop, shouldOpenScan, type PlaybackSnapshot } from "@/lib/spotify/autoOpen";
import { loadSpotifySdk, type SdkPlayer, type SdkState } from "@/lib/spotify/player";
import { redirectUri } from "@/lib/spotify/pkce";
import { getBrowserSupabase } from "@/lib/supabase/client";

export type NowPlaying = { name: string; artists: string; image: string | null; paused: boolean } | null;
type Status = "unconfigured" | "disconnected" | "connecting" | "ready" | "error";

type Music = {
  status: Status;
  error: string | null;
  notice: string | null;
  account: Account | null;
  deviceId: string | null;
  nowPlaying: NowPlaying;
  volume: number;
  redirectUri: string;
  api: SpotifyApi | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Re-reads the token (the callback page calls this after storing one). */
  refreshAuth: () => void;
  togglePlay: () => Promise<void>;
  pause: () => Promise<void>;
  /** Pause that never opens the scan window, for tests. */
  pauseQuietly: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  setVolume: (v: number) => Promise<void>;
  /** Runs a Web API call, turning failures into a visible message instead of a crash. */
  attempt: (fn: (api: SpotifyApi, deviceId: string) => Promise<unknown>) => Promise<void>;
};

const MusicContext = createContext<Music | null>(null);

export function useMusic(): Music {
  const ctx = useContext(MusicContext);
  if (!ctx) throw new Error("useMusic must be used inside MusicProvider");
  return ctx;
}

function clientId(): string | null {
  try {
    return publicEnv().NEXT_PUBLIC_SPOTIFY_CLIENT_ID ?? null;
  } catch {
    return null;
  }
}

const snapshot = (s: SdkState | null): PlaybackSnapshot | null =>
  s ? { paused: s.paused, trackUri: s.track_window.current_track?.uri ?? null, position: s.position, duration: s.duration } : null;

/**
 * Owns the Spotify connection for the whole admin console, so the in-browser device keeps playing while
 * the host moves between pages, and a pause can open the scan window from any of them (F14, D-007).
 */
export function MusicProvider({ children }: { children: React.ReactNode }) {
  const id = useMemo(clientId, []);
  const [hasToken, setHasToken] = useState(false);
  const [status, setStatus] = useState<Status>(id ? "disconnected" : "unconfigured");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying>(null);
  const [volume, setVolumeState] = useState(0.7);
  const [origin, setOrigin] = useState("");
  const player = useRef<SdkPlayer | null>(null);
  const prev = useRef<PlaybackSnapshot | null>(null);
  /** Pauses before this time never open the scan window (the Settings test pauses its own song). */
  const quietUntil = useRef(0);

  const api = useMemo(() => (id ? createSpotifyApi((opts) => getAccessToken(id, opts)) : null), [id]);

  const refreshAuth = useCallback(() => setHasToken(Boolean(loadToken())), []);
  useEffect(() => {
    setOrigin(window.location.origin);
    refreshAuth();
  }, [refreshAuth]);

  const onStateChange = useCallback(async (state: SdkState | null) => {
    const next = snapshot(state);
    const stopped = isMusicStop(prev.current, next);
    prev.current = next;
    const track = state?.track_window.current_track;
    setNowPlaying(
      track
        ? { name: track.name, artists: track.artists.map((a) => a.name).join(", "), image: track.album.images[0]?.url ?? null, paused: state!.paused }
        : null,
    );
    if (!stopped || Date.now() < quietUntil.current) return;
    // Read the live setting and phase at the moment of the pause, so a change made in another tab counts.
    const sb = getBrowserSupabase();
    const [{ data: game }, { data: pub }] = await Promise.all([
      sb.from("games").select("auto_open_on_pause").eq("id", 1).single(),
      sb.from("public_state").select("data").eq("id", 1).maybeSingle(),
    ]);
    const phase = (pub?.data as PublicState | undefined)?.spin?.phase ?? null;
    if (!shouldOpenScan({ stopped, autoOpenOnPause: Boolean(game?.auto_open_on_pause), phase })) return;
    const err = await adminRpc("open_scan_window");
    // INVALID_TRANSITION means the host already opened it with the button: nothing to report.
    if (err && err !== "INVALID_TRANSITION") setError(`Music paused, but the scan window didn't open: ${friendlyError(err)} Use the Music stopped button.`);
    else if (!err) setNotice(`Music paused · scan window opened at ${new Date().toLocaleTimeString()}`);
  }, []);

  // Create the in-browser device whenever we hold a token.
  useEffect(() => {
    if (!id || !hasToken || !api) return;
    let cancelled = false;
    setStatus("connecting");
    setError(null);
    void (async () => {
      try {
        const acct = await api.account();
        if (cancelled) return;
        setAccount(acct);
        if (!acct.premium) {
          setStatus("error");
          setError("This Spotify account isn't Premium, so it can't play in the browser. Use the Music stopped button, or log in with a Premium account.");
          return;
        }
        const Spotify = await loadSpotifySdk();
        if (cancelled) return;
        const p = new Spotify.Player({
          name: "AI Musical Chair",
          volume,
          getOAuthToken: (cb) => void getAccessToken(id).then((t) => t && cb(t)),
        });
        p.addListener("ready", ({ device_id }) => {
          setDeviceId(device_id);
          setStatus("ready");
          void api.transfer(device_id).catch(() => undefined);
        });
        p.addListener("not_ready", () => setDeviceId(null));
        p.addListener("player_state_changed", (s) => void onStateChange(s));
        p.addListener("initialization_error", () => {
          setStatus("error");
          setError("This browser can't play Spotify. Use desktop Chrome.");
        });
        p.addListener("authentication_error", () => {
          clearSpotifyToken();
          setHasToken(false);
          setStatus("error");
          setError("Spotify sign-in expired. Connect Spotify again.");
        });
        p.addListener("account_error", () => {
          setStatus("error");
          setError("Spotify Premium is required to play music here.");
        });
        p.addListener("playback_error", () => setError("Spotify couldn't play that track. Try another one."));
        player.current = p;
        if (!(await p.connect())) throw new Error("Couldn't start the Spotify player.");
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Couldn't reach Spotify.");
      }
    })();
    return () => {
      cancelled = true;
      player.current?.disconnect();
      player.current = null;
      prev.current = null;
      setDeviceId(null);
      setNowPlaying(null);
    };
    // Volume is applied live via setVolume; reconnecting on every change would stop the music.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, hasToken, api, onStateChange]);

  useEffect(() => {
    if (!hasToken && id) {
      setStatus((s) => (s === "error" ? s : "disconnected"));
      setAccount(null);
    }
  }, [hasToken, id]);

  const connect = useCallback(async () => {
    if (!id) return;
    const url = await beginLogin({ clientId: id, origin: window.location.origin, returnTo: window.location.pathname });
    window.location.assign(url);
  }, [id]);

  const disconnect = useCallback(() => {
    clearSpotifyToken();
    setHasToken(false);
    setError(null);
    setNotice(null);
    setStatus(id ? "disconnected" : "unconfigured");
  }, [id]);

  const withPlayer = useCallback(async (fn: (p: SdkPlayer) => Promise<void>) => {
    const p = player.current;
    if (!p) return;
    try {
      await p.activateElement(); // Chrome autoplay: this runs inside the click that called it
      await fn(p);
    } catch {
      setError("Spotify didn't respond. Use the Music stopped button if needed.");
    }
  }, []);

  const attempt = useCallback<Music["attempt"]>(
    async (fn) => {
      if (!api || !deviceId) {
        setError("Connect Spotify first.");
        return;
      }
      setError(null);
      try {
        await player.current?.activateElement();
        await fn(api, deviceId);
      } catch (e) {
        setError(e instanceof SpotifyApiError ? e.message : "Spotify didn't respond. Use the Music stopped button if needed.");
      }
    },
    [api, deviceId],
  );

  const value: Music = {
    status,
    error,
    notice,
    account,
    deviceId,
    nowPlaying,
    volume,
    redirectUri: origin ? redirectUri(origin) : "",
    api,
    connect,
    disconnect,
    refreshAuth,
    togglePlay: () => withPlayer((p) => p.togglePlay()),
    pause: () => withPlayer((p) => p.pause()),
    pauseQuietly: () => {
      quietUntil.current = Date.now() + 5000;
      return withPlayer((p) => p.pause());
    },
    next: () => withPlayer((p) => p.nextTrack()),
    previous: () => withPlayer((p) => p.previousTrack()),
    setVolume: async (v) => {
      setVolumeState(v);
      await withPlayer((p) => p.setVolume(v));
    },
    attempt,
  };

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}
