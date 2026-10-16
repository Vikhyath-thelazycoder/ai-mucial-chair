import { describe, expect, it, vi } from "vitest";
import { createSpotifyApi, SEARCH_LIMIT, SpotifyApiError, spotifyErrorMessage } from "./api";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const empty = () => new Response(null, { status: 204 });

function setup(...responses: Response[]) {
  const fetchMock = vi.fn();
  for (const r of responses) fetchMock.mockResolvedValueOnce(r);
  const getToken = vi.fn(async ({ force = false } = {}) => (force ? "FRESH" : "TOKEN"));
  const api = createSpotifyApi(getToken, fetchMock as unknown as typeof fetch);
  const call = (i: number) => {
    const [url, init] = fetchMock.mock.calls[i];
    const u = new URL(url as string);
    return { path: u.pathname.replace("/v1", ""), query: Object.fromEntries(u.searchParams), init: init as RequestInit, body: init.body ? JSON.parse(init.body as string) : undefined };
  };
  return { api, fetchMock, getToken, call };
}

const rawTrack = { uri: "spotify:track:1", name: "Song", artists: [{ name: "A" }, { name: "B" }], album: { images: [{ url: "https://i.scdn.co/x" }] }, duration_ms: 1000 };

describe("Spotify Web API wrapper", () => {
  it("searches tracks and playlists with the Development Mode limit and drops null items", async () => {
    const { api, call } = setup(
      json({
        tracks: { items: [rawTrack, null] },
        playlists: { items: [null, { uri: "spotify:playlist:9", name: "Party", owner: { display_name: "Me" }, images: null }] },
      }),
    );
    const res = await api.search("  party  ");
    expect(call(0).path).toBe("/search");
    expect(call(0).query).toEqual({ q: "party", type: "track,playlist", limit: String(SEARCH_LIMIT) });
    expect(SEARCH_LIMIT).toBeLessThanOrEqual(10);
    expect(call(0).init.headers).toMatchObject({ Authorization: "Bearer TOKEN" });
    expect(res.tracks).toEqual([{ uri: "spotify:track:1", name: "Song", artists: "A, B", image: "https://i.scdn.co/x", durationMs: 1000 }]);
    expect(res.playlists).toEqual([{ uri: "spotify:playlist:9", name: "Party", owner: "Me", image: null }]);
  });

  it("skips the request for an empty search", async () => {
    const { api, fetchMock } = setup();
    expect(await api.search("   ")).toEqual({ tracks: [], playlists: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists the admin's playlists", async () => {
    const { api, call } = setup(json({ items: [{ uri: "spotify:playlist:1", name: "Mine", owner: { display_name: "Host" }, images: [{ url: "u" }] }] }));
    expect(await api.myPlaylists()).toEqual([{ uri: "spotify:playlist:1", name: "Mine", owner: "Host", image: "u" }]);
    expect(call(0).path).toBe("/me/playlists");
  });

  it("reads the account and whether it is Premium", async () => {
    const { api } = setup(json({ id: "u1", display_name: "Host", product: "premium" }));
    expect(await api.account()).toEqual({ name: "Host", premium: true });
  });

  it("sends player commands to our device and treats 204 as success", async () => {
    const { api, call } = setup(empty(), empty(), empty(), empty());
    await api.transfer("dev1");
    await api.playTracks("dev1", ["spotify:track:1"]);
    await api.playContext("dev1", "spotify:playlist:1");
    await api.addToQueue("dev1", "spotify:track:2");

    expect(call(0)).toMatchObject({ path: "/me/player", body: { device_ids: ["dev1"], play: false } });
    expect(call(0).init.method).toBe("PUT");
    expect(call(1)).toMatchObject({ path: "/me/player/play", query: { device_id: "dev1" }, body: { uris: ["spotify:track:1"] } });
    expect(call(2)).toMatchObject({ path: "/me/player/play", query: { device_id: "dev1" }, body: { context_uri: "spotify:playlist:1" } });
    expect(call(3)).toMatchObject({ path: "/me/player/queue", query: { uri: "spotify:track:2", device_id: "dev1" } });
    expect(call(3).init.method).toBe("POST");
  });

  it("reads the queue", async () => {
    const { api } = setup(json({ currently_playing: rawTrack, queue: [rawTrack, null] }));
    const q = await api.queue();
    expect(q.current?.name).toBe("Song");
    expect(q.next).toHaveLength(1);
  });

  it("refreshes the token once and retries on 401", async () => {
    const { api, getToken, call } = setup(json({ error: { status: 401 } }, 401), json({ items: [] }));
    expect(await api.myPlaylists()).toEqual([]);
    expect(getToken).toHaveBeenLastCalledWith({ force: true });
    expect(call(1).init.headers).toMatchObject({ Authorization: "Bearer FRESH" });
  });

  it("throws a friendly error with Spotify's reason, never its raw message", async () => {
    const { api } = setup(json({ error: { status: 403, message: "internal detail", reason: "PREMIUM_REQUIRED" } }, 403));
    const err = await api.playTracks("d", ["u"]).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SpotifyApiError);
    expect((err as Error).message).toBe("Spotify Premium is required to play music here.");
    expect((err as Error).message).not.toMatch(/internal detail/);
  });

  it("fails without calling Spotify when not connected", async () => {
    const fetchMock = vi.fn();
    const api = createSpotifyApi(async () => null, fetchMock as unknown as typeof fetch);
    await expect(api.myPlaylists()).rejects.toThrow(/expired/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps every status to a message that points at the fallback", () => {
    expect(spotifyErrorMessage(500, null)).toMatch(/Music stopped/);
    expect(spotifyErrorMessage(404, "NO_ACTIVE_DEVICE")).toMatch(/player isn't ready/);
    expect(spotifyErrorMessage(429, null)).toMatch(/rate-limiting/);
  });
});

describe("devices and playback", () => {
  it("lists every Spotify device on the account", async () => {
    const { api, call } = setup(json({ devices: [{ id: "d1", name: "AI Musical Chair", type: "Computer", is_active: true, volume_percent: 70 }] }));
    expect(await api.devices()).toEqual([{ id: "d1", name: "AI Musical Chair", type: "Computer", active: true, volume: 70 }]);
    expect(call(0).path).toBe("/me/player/devices");
  });

  it("reads what's playing where, and null when nothing has played (204)", async () => {
    const { api } = setup(
      json({ is_playing: true, device: { id: "d1", name: "Laptop", type: "Computer", is_active: true, volume_percent: 50 }, item: rawTrack, progress_ms: 1200 }),
      empty(),
    );
    expect(await api.playback()).toEqual({
      playing: true,
      deviceId: "d1",
      deviceName: "Laptop",
      track: { uri: "spotify:track:1", name: "Song", artists: "A, B", image: "https://i.scdn.co/x", durationMs: 1000 },
      progressMs: 1200,
    });
    expect(await api.playback()).toBeNull();
  });
});
