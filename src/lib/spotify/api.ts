// Thin Spotify Web API wrapper (browser fetch). Reflects the February 2026 Development Mode limits:
// search returns at most 10 per type, and playlist contents are only readable for playlists the admin owns,
// so playlists are played by context URI rather than listed track by track.

const BASE = "https://api.spotify.com/v1";
export const SEARCH_LIMIT = 10;

export type Track = { uri: string; name: string; artists: string; image: string | null; durationMs: number };
export type Playlist = { uri: string; name: string; owner: string; image: string | null };
export type Account = { name: string; premium: boolean };
export type Device = { id: string | null; name: string; type: string; active: boolean; volume: number | null };
export type Playback = { playing: boolean; deviceId: string | null; deviceName: string | null; track: Track | null; progressMs: number };
type RawDevice = { id: string | null; name: string; type: string; is_active: boolean; volume_percent: number | null };

export class SpotifyApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
  ) {
    super(spotifyErrorMessage(status, reason));
  }
}

/** What the admin should read. Spotify's own messages are never shown verbatim. */
export function spotifyErrorMessage(status: number, reason: string | null): string {
  if (reason === "PREMIUM_REQUIRED") return "Spotify Premium is required to play music here.";
  if (reason === "NO_ACTIVE_DEVICE" || status === 404) return "The AI Musical Chair player isn't ready yet. Wait a moment, or reconnect Spotify.";
  if (status === 401) return "Your Spotify session expired. Connect Spotify again.";
  if (status === 403) return "Spotify refused that. Check the account is Premium and added under the app's Users and access.";
  if (status === 429) return "Spotify is rate-limiting us. Wait a few seconds and try again.";
  return "Spotify didn't respond. Use the Music stopped button if needed.";
}

type Image = { url: string } | null | undefined;
type RawArtist = { name: string };
type RawTrack = { uri: string; name: string; artists?: RawArtist[]; album?: { images?: Image[] }; duration_ms?: number } | null;
type RawPlaylist = { uri: string; name: string; owner?: { display_name?: string | null }; images?: Image[] | null } | null;

const firstImage = (images: Image[] | null | undefined) => images?.find((i) => i?.url)?.url ?? null;

export function toTrack(t: NonNullable<RawTrack>): Track {
  return {
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(", "),
    image: firstImage(t.album?.images),
    durationMs: t.duration_ms ?? 0,
  };
}

function toPlaylist(p: NonNullable<RawPlaylist>): Playlist {
  return { uri: p.uri, name: p.name, owner: p.owner?.display_name ?? "", image: firstImage(p.images) };
}

// Spotify search can return null entries in its item arrays.
const present = <T,>(items: (T | null)[] | undefined): T[] => (items ?? []).filter((x): x is T => x !== null);

export type GetToken = (opts?: { force?: boolean }) => Promise<string | null>;

export function createSpotifyApi(getToken: GetToken, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  async function request<T>(
    method: "GET" | "PUT" | "POST",
    path: string,
    { query, body }: { query?: Record<string, string | number | undefined>; body?: unknown } = {},
  ): Promise<T | null> {
    const url = new URL(BASE + path);
    for (const [k, v] of Object.entries(query ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));

    const send = async (force: boolean) => {
      const token = await getToken({ force });
      if (!token) throw new SpotifyApiError(401, null);
      return fetchImpl(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };

    let res = await send(false);
    if (res.status === 401) res = await send(true); // expired early: refresh once and retry
    if (!res.ok) {
      let reason: string | null = null;
      try {
        reason = ((await res.json()) as { error?: { reason?: string } }).error?.reason ?? null;
      } catch {
        // empty or non-JSON error body
      }
      throw new SpotifyApiError(res.status, reason);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  const device = (deviceId: string) => ({ device_id: deviceId });

  return {
    async account(): Promise<Account> {
      const me = await request<{ display_name?: string | null; id: string; product?: string }>("GET", "/me");
      return { name: me?.display_name || me?.id || "", premium: me?.product === "premium" };
    },

    async search(q: string): Promise<{ tracks: Track[]; playlists: Playlist[] }> {
      const term = q.trim();
      if (!term) return { tracks: [], playlists: [] };
      const res = await request<{ tracks?: { items?: RawTrack[] }; playlists?: { items?: RawPlaylist[] } }>("GET", "/search", {
        query: { q: term, type: "track,playlist", limit: SEARCH_LIMIT },
      });
      return {
        tracks: present(res?.tracks?.items).map(toTrack),
        playlists: present(res?.playlists?.items).map(toPlaylist),
      };
    },

    async myPlaylists(): Promise<Playlist[]> {
      const res = await request<{ items?: RawPlaylist[] }>("GET", "/me/playlists", { query: { limit: 50 } });
      return present(res?.items).map(toPlaylist);
    },

    async queue(): Promise<{ current: Track | null; next: Track[] }> {
      const res = await request<{ currently_playing?: RawTrack; queue?: RawTrack[] }>("GET", "/me/player/queue");
      return {
        current: res?.currently_playing ? toTrack(res.currently_playing) : null,
        next: present(res?.queue).map(toTrack),
      };
    },

    /** Every Spotify Connect device on the account (this browser, phones, speakers…). */
    async devices(): Promise<Device[]> {
      const res = await request<{ devices?: RawDevice[] }>("GET", "/me/player/devices");
      return (res?.devices ?? []).map((d) => ({ id: d.id, name: d.name, type: d.type, active: d.is_active, volume: d.volume_percent }));
    },

    /** What's playing right now and where. Null when nothing has played recently (Spotify answers 204). */
    async playback(): Promise<Playback | null> {
      const res = await request<{ is_playing: boolean; device?: RawDevice; item?: RawTrack; progress_ms?: number | null }>("GET", "/me/player");
      if (!res) return null;
      return {
        playing: res.is_playing,
        deviceId: res.device?.id ?? null,
        deviceName: res.device?.name ?? null,
        track: res.item ? toTrack(res.item) : null,
        progressMs: res.progress_ms ?? 0,
      };
    },

    /** Moves playback to our in-browser device. */
    transfer: (deviceId: string, play = false) => request("PUT", "/me/player", { body: { device_ids: [deviceId], play } }),

    playTracks: (deviceId: string, uris: string[]) => request("PUT", "/me/player/play", { query: device(deviceId), body: { uris } }),

    playContext: (deviceId: string, contextUri: string) =>
      request("PUT", "/me/player/play", { query: device(deviceId), body: { context_uri: contextUri } }),

    addToQueue: (deviceId: string, uri: string) => request("POST", "/me/player/queue", { query: { uri, ...device(deviceId) } }),
  };
}

export type SpotifyApi = ReturnType<typeof createSpotifyApi>;
