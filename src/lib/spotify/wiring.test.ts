import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("Spotify wiring", () => {
  it("admin logout clears the Spotify token before signing out", () => {
    const nav = src("components/admin/AdminNav.tsx");
    const clear = nav.indexOf("clearSpotifyToken()");
    expect(clear).toBeGreaterThan(-1);
    expect(clear).toBeLessThan(nav.indexOf("auth.signOut()"));
  });

  it("the token is kept in sessionStorage only, never localStorage or cookies", () => {
    const auth = src("lib/spotify/auth.ts");
    expect(auth).toMatch(/window\.sessionStorage/);
    for (const f of ["lib/spotify/auth.ts", "lib/spotify/api.ts", "components/admin/music/MusicProvider.tsx"]) {
      expect(src(f)).not.toMatch(/localStorage|document\.cookie/);
    }
  });

  it("the manual Music stopped button doesn't depend on Spotify", () => {
    const console = src("components/admin/GameConsole.tsx");
    // Rendered from the engine's allowed actions only.
    expect(console).toMatch(/btn\("open_scan_window", "Music stopped/);
    // Opens the window first; pausing Spotify is a follow-up that only runs when the RPC succeeded.
    expect(console).toMatch(/run\(action\)\.then\(\(err\) => \(!err && music\.nowPlaying/);
  });

  it("the music player lives in the console layout, so it keeps playing across admin pages", () => {
    expect(src("app/admin/(console)/layout.tsx")).toMatch(/<MusicProvider>/);
  });
});

describe("Spotify check wiring", () => {
  it("the Settings page has the Spotify check, and the nav shows music status on every admin page", () => {
    expect(src("components/admin/SettingsPanel.tsx")).toMatch(/<SpotifyCheck \/>/);
    expect(src("components/admin/AdminNav.tsx")).toMatch(/<MusicStatus \/>/);
  });

  it("the test song is stopped with a quiet pause that can't open the scan window", () => {
    const check = src("components/admin/music/SpotifyCheck.tsx");
    expect(check).toMatch(/m\.pauseQuietly\(\)/);
    expect(check).not.toMatch(/open_scan_window|m\.pause\(\)/);
    expect(src("components/admin/music/MusicProvider.tsx")).toMatch(/if \(!stopped \|\| Date\.now\(\) < quietUntil\.current\) return;/);
  });
});
