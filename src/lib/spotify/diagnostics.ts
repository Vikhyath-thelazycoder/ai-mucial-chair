// The Settings "Spotify check": turns what we can observe into pass/fail steps with a fix for each failure.
import type { Account, Device, Playback, SpotifyApi } from "./api";

export type CheckStatus = "pass" | "fail" | "warn" | "skip";
export type Check = { id: string; label: string; status: CheckStatus; detail: string };

export type Observed = {
  configured: boolean;
  redirectUri: string;
  connected: boolean;
  account: Account | null;
  /** Our in-browser device id once the Web Playback SDK reports ready. */
  deviceId: string | null;
  /** Null when the Web API couldn't be reached. */
  devices: Device[] | null;
  playback: Playback | null;
  apiError: string | null;
};

export function spotifyChecks(o: Observed): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) => checks.push({ id, label, status, detail });

  if (!o.configured) {
    add("config", "Spotify app set up", "fail", "Add NEXT_PUBLIC_SPOTIFY_CLIENT_ID in the hosting dashboard and redeploy.");
  } else {
    add("config", "Spotify app set up", "pass", `Redirect URI to register: ${o.redirectUri}`);
  }

  if (!o.configured || !o.connected) {
    add("login", "Signed in to Spotify", o.configured ? "fail" : "skip", o.configured ? "Press Connect Spotify." : "Set up the Spotify app first.");
    for (const [id, label] of [
      ["premium", "Premium account"],
      ["player", "Player in this browser"],
      ["devices", "Spotify devices"],
      ["playing", "Music playing here"],
    ] as const) {
      add(id, label, "skip", "Sign in first.");
    }
    return checks;
  }

  add("login", "Signed in to Spotify", "pass", o.account ? `As ${o.account.name}.` : "Signed in.");

  if (!o.account) {
    add("premium", "Premium account", o.apiError ? "fail" : "skip", o.apiError ?? "Checking…");
  } else if (o.account.premium) {
    add("premium", "Premium account", "pass", "Premium: the browser can play music.");
  } else {
    add("premium", "Premium account", "fail", "This account isn't Premium. Spotify only plays in the browser for Premium accounts.");
  }

  add(
    "player",
    "Player in this browser",
    o.deviceId ? "pass" : "fail",
    o.deviceId ? `"AI Musical Chair" is ready in this tab.` : "The in-browser player isn't ready. Use desktop Chrome, keep this tab open, or Disconnect and connect again.",
  );

  if (o.devices === null) {
    add("devices", "Spotify devices", "fail", o.apiError ?? "Couldn't list devices.");
  } else {
    const ours = o.devices.some((d) => d.id && d.id === o.deviceId);
    const names = o.devices.map((d) => `${d.name}${d.active ? " (active)" : ""}`).join(", ");
    add(
      "devices",
      "Spotify devices",
      ours ? "pass" : o.devices.length ? "warn" : "fail",
      o.devices.length === 0
        ? "Spotify sees no devices on this account."
        : ours
          ? `${o.devices.length} device(s): ${names}.`
          : `Spotify doesn't list this browser yet: ${names}. Wait a few seconds and check again.`,
    );
  }

  const p = o.playback;
  if (!p || !p.track) {
    add("playing", "Music playing here", "warn", "Nothing is playing. Press Play test song.");
  } else if (p.deviceId !== o.deviceId) {
    add("playing", "Music playing here", "warn", `"${p.track.name}" is ${p.playing ? "playing" : "paused"} on ${p.deviceName ?? "another device"}, not this laptop. Press Play test song to move it here.`);
  } else if (!p.playing) {
    add("playing", "Music playing here", "warn", `"${p.track.name}" is paused on this laptop.`);
  } else {
    add("playing", "Music playing here", "pass", `"${p.track.name}" by ${p.track.artists} is playing on this laptop.`);
  }
  return checks;
}

/** Overall verdict: ready for the game only when nothing failed and music is actually playing here. */
export function overall(checks: readonly Check[]): "ready" | "attention" | "broken" {
  if (checks.some((c) => c.status === "fail")) return "broken";
  return checks.every((c) => c.status === "pass") ? "ready" : "attention";
}

type TestApi = Pick<SpotifyApi, "transfer" | "playback" | "myPlaylists" | "search" | "playContext" | "playTracks">;

const playingHere = (p: Playback | null, deviceId: string) => Boolean(p?.playing && p.deviceId === deviceId && p.track);

/**
 * "Play test song": moves playback to this browser and resumes whatever was last playing; if nothing
 * resumes, plays the admin's first playlist, or else a search result. Success is confirmed by asking
 * Spotify what is playing where, not assumed from the commands succeeding.
 */
export async function playTestSong(
  api: TestApi,
  deviceId: string,
  { sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)), attempts = 6 }: { sleep?: (ms: number) => Promise<void>; attempts?: number } = {},
): Promise<{ ok: boolean; detail: string }> {
  const confirm = async () => {
    for (let i = 0; i < attempts; i++) {
      await sleep(1000);
      const p = await api.playback();
      if (playingHere(p, deviceId)) return p;
    }
    return null;
  };

  await api.transfer(deviceId, true);
  let p = await confirm();
  if (!p) {
    const playlists = await api.myPlaylists();
    if (playlists[0]) {
      await api.playContext(deviceId, playlists[0].uri);
    } else {
      const { tracks } = await api.search("party");
      if (!tracks[0]) return { ok: false, detail: "Couldn't find anything to play. Pick a song on the Music page." };
      await api.playTracks(deviceId, [tracks[0].uri]);
    }
    p = await confirm();
  }
  return p?.track
    ? { ok: true, detail: `Playing "${p.track.name}" by ${p.track.artists} on this laptop.` }
    : { ok: false, detail: "Spotify accepted the command but nothing is playing here. Check the laptop's sound, click anywhere on the page, and try again." };
}
