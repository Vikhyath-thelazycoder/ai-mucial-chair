import { describe, expect, it, vi } from "vitest";
import type { Playback, Track } from "./api";
import { overall, playTestSong, spotifyChecks, type Observed } from "./diagnostics";

const track: Track = { uri: "spotify:track:1", name: "Song", artists: "Band", image: null, durationMs: 1000 };
const here = (playing = true): Playback => ({ playing, deviceId: "dev", deviceName: "AI Musical Chair", track, progressMs: 5 });

const base: Observed = {
  configured: true,
  redirectUri: "http://127.0.0.1:3000/admin/spotify/callback",
  connected: true,
  account: { name: "Host", premium: true },
  deviceId: "dev",
  devices: [
    { id: "dev", name: "AI Musical Chair", type: "Computer", active: true, volume: 70 },
    { id: "phone", name: "Host's phone", type: "Smartphone", active: false, volume: 50 },
  ],
  playback: here(),
  apiError: null,
};
const status = (o: Observed) => Object.fromEntries(spotifyChecks(o).map((c) => [c.id, c.status]));

describe("spotifyChecks", () => {
  it("is ready only when everything passes and music is playing on this laptop", () => {
    expect(status(base)).toEqual({ config: "pass", login: "pass", premium: "pass", player: "pass", devices: "pass", playing: "pass" });
    expect(overall(spotifyChecks(base))).toBe("ready");
    expect(spotifyChecks(base).find((c) => c.id === "devices")!.detail).toMatch(/AI Musical Chair \(active\), Host's phone/);
  });

  it("explains a missing client id and skips the rest", () => {
    const s = status({ ...base, configured: false, connected: false });
    expect(s.config).toBe("fail");
    expect(Object.values(s).filter((v) => v === "skip")).toHaveLength(5);
    expect(overall(spotifyChecks({ ...base, configured: false, connected: false }))).toBe("broken");
  });

  it("asks to connect when not signed in", () => {
    expect(status({ ...base, connected: false }).login).toBe("fail");
  });

  it("fails a non-Premium account and a missing browser player", () => {
    expect(status({ ...base, account: { name: "x", premium: false } }).premium).toBe("fail");
    expect(status({ ...base, deviceId: null }).player).toBe("fail");
  });

  it("warns when the music is on another device, paused, or nothing plays", () => {
    const elsewhere = spotifyChecks({ ...base, playback: { ...here(), deviceId: "phone", deviceName: "Host's phone" } });
    expect(elsewhere.find((c) => c.id === "playing")).toMatchObject({ status: "warn", detail: expect.stringMatching(/on Host's phone, not this laptop/) });
    expect(status({ ...base, playback: here(false) }).playing).toBe("warn");
    expect(status({ ...base, playback: null }).playing).toBe("warn");
    expect(overall(spotifyChecks({ ...base, playback: null }))).toBe("attention");
  });

  it("warns when Spotify doesn't list this browser yet, and fails when the API is unreachable", () => {
    expect(status({ ...base, devices: [base.devices![1]] }).devices).toBe("warn");
    const down = spotifyChecks({ ...base, devices: null, apiError: "Spotify didn't respond." });
    expect(down.find((c) => c.id === "devices")).toMatchObject({ status: "fail", detail: "Spotify didn't respond." });
  });
});

function fakeApi(playbacks: (Playback | null)[], { playlists = [{ uri: "spotify:playlist:1", name: "P", owner: "", image: null }], tracks = [track] } = {}) {
  const queue = [...playbacks];
  return {
    transfer: vi.fn(async () => null),
    playback: vi.fn(async () => (queue.length > 1 ? queue.shift()! : queue[0] ?? null)),
    myPlaylists: vi.fn(async () => playlists),
    search: vi.fn(async () => ({ tracks, playlists: [] })),
    playContext: vi.fn(async () => null),
    playTracks: vi.fn(async () => null),
  };
}
const fast = { sleep: async () => undefined, attempts: 3 };

describe("playTestSong", () => {
  it("resumes on this laptop and confirms with Spotify", async () => {
    const api = fakeApi([null, here()]);
    expect(await playTestSong(api, "dev", fast)).toEqual({ ok: true, detail: 'Playing "Song" by Band on this laptop.' });
    expect(api.transfer).toHaveBeenCalledWith("dev", true);
    expect(api.playContext).not.toHaveBeenCalled();
  });

  it("falls back to the first playlist when nothing resumes", async () => {
    const api = fakeApi([null, null, null, here()]);
    expect((await playTestSong(api, "dev", fast)).ok).toBe(true);
    expect(api.playContext).toHaveBeenCalledWith("dev", "spotify:playlist:1");
  });

  it("falls back to a search result when there are no playlists", async () => {
    const api = fakeApi([null, null, null, here()], { playlists: [] });
    expect((await playTestSong(api, "dev", fast)).ok).toBe(true);
    expect(api.playTracks).toHaveBeenCalledWith("dev", ["spotify:track:1"]);
  });

  it("doesn't count music playing on another device as success", async () => {
    const api = fakeApi([{ ...here(), deviceId: "phone" }]);
    const res = await playTestSong(api, "dev", fast);
    expect(res.ok).toBe(false);
    expect(res.detail).toMatch(/nothing is playing here/);
  });

  it("reports when there's nothing to play", async () => {
    const api = fakeApi([null], { playlists: [], tracks: [] });
    expect(await playTestSong(api, "dev", fast)).toMatchObject({ ok: false, detail: expect.stringMatching(/Music page/) });
  });
});
