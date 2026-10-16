import { describe, expect, it } from "vitest";
import { isMusicStop, shouldOpenScan, type PlaybackSnapshot } from "./autoOpen";

const playing: PlaybackSnapshot = { paused: false, trackUri: "spotify:track:1", position: 40_000, duration: 200_000 };
const at = (over: Partial<PlaybackSnapshot>): PlaybackSnapshot => ({ ...playing, ...over });

describe("isMusicStop", () => {
  it("is true when the host pauses mid-song", () => {
    expect(isMusicStop(playing, at({ paused: true, position: 41_000 }))).toBe(true);
  });

  it("ignores repeated paused states and resumes", () => {
    expect(isMusicStop(at({ paused: true }), at({ paused: true }))).toBe(false);
    expect(isMusicStop(at({ paused: true }), playing)).toBe(false);
  });

  it("ignores the paused blip between tracks", () => {
    expect(isMusicStop(playing, at({ paused: true, trackUri: "spotify:track:2", position: 0 }))).toBe(false);
    expect(isMusicStop(playing, at({ paused: true, position: 0 }))).toBe(false);
  });

  it("ignores a track that simply ran out", () => {
    expect(isMusicStop(playing, at({ paused: true, position: 199_200 }))).toBe(false);
  });

  it("ignores the first state and a lost player", () => {
    expect(isMusicStop(null, at({ paused: true }))).toBe(false);
    expect(isMusicStop(playing, null)).toBe(false);
    expect(isMusicStop(playing, at({ paused: true, trackUri: null }))).toBe(false);
  });
});

describe("shouldOpenScan", () => {
  it("opens only when the setting is on and the spin is in the music phase", () => {
    expect(shouldOpenScan({ stopped: true, autoOpenOnPause: true, phase: "music" })).toBe(true);
    expect(shouldOpenScan({ stopped: true, autoOpenOnPause: false, phase: "music" })).toBe(false);
    expect(shouldOpenScan({ stopped: false, autoOpenOnPause: true, phase: "music" })).toBe(false);
    for (const phase of ["scan_open", "judging", "closed", null]) {
      expect(shouldOpenScan({ stopped: true, autoOpenOnPause: true, phase })).toBe(false);
    }
  });
});
