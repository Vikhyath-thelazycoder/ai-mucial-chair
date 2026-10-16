import { describe, expect, it } from "vitest";
import type { PublicState } from "@/lib/game/types";
import { screenStage, screenView } from "./view";

function state(over: Partial<PublicState> = {}): PublicState {
  return {
    session: { number: 1, startedAt: "2026-10-17T10:00:00Z" },
    game: { name: "AI Musical Chair", status: "in_round", registrationOpen: false, finalChairCount: 3, timerSeconds: 20, autoOpenOnPause: true },
    round: { number: 1, difficulty: 1, isFinal: false, status: "active", timerSeconds: 20 },
    spin: { number: 2, phase: "music", scanOpenedAt: null },
    chairs: [
      { number: 3, holder: null },
      { number: 1, holder: "Asha" },
      { number: 2, holder: null },
    ],
    playersRemaining: 40,
    playersTotal: 42,
    playersInPlay: 9,
    winners: [],
    event: null,
    ...over,
  };
}

describe("screenStage", () => {
  it("maps game status and spin phase to one stage", () => {
    expect(screenStage(state({ game: { ...state().game, status: "lobby" }, round: null, spin: null }))).toBe("lobby");
    expect(screenStage(state())).toBe("music");
    expect(screenStage(state({ spin: { number: 2, phase: "scan_open", scanOpenedAt: "t" } }))).toBe("scan");
    expect(screenStage(state({ spin: { number: 2, phase: "judging", scanOpenedAt: "t" } }))).toBe("judging");
    expect(screenStage(state({ game: { ...state().game, status: "round_complete" }, round: { ...state().round!, status: "complete" } }))).toBe("between");
    expect(screenStage(state({ game: { ...state().game, status: "finished" } }))).toBe("podium");
  });
});

describe("screenView", () => {
  it("orders chairs and counts only judged holders as locked", () => {
    const v = screenView(state());
    expect(v.chairs.map((c) => c.number)).toEqual([1, 2, 3]);
    expect(v.locked).toBe(1);
  });

  it("never exposes anything beyond chair holders: no answers, results or pending claims", () => {
    const v = screenView(state({ spin: { number: 2, phase: "scan_open", scanOpenedAt: "2026-10-17T10:05:00Z" } }));
    const text = JSON.stringify(v);
    expect(text).not.toMatch(/correct|wrong|answer|pending|attempt/i);
    for (const c of v.chairs) expect(Object.keys(c).sort()).toEqual(["holder", "number"]);
    expect(v.scanOpenedAt).toBe("2026-10-17T10:05:00Z");
  });

  it("T-7.1: round 1 shows who actually scanned, not total registrations", () => {
    const v = screenView(state());
    expect(v.inPlay).toBe(9);
    expect(v.inPlayLabel).toBe("In play");
    expect(v.joined).toBe(42);
  });

  it("after round 1 shows players still in", () => {
    const v = screenView(state({ round: { number: 2, difficulty: 2, isFinal: false, status: "active", timerSeconds: 20 }, playersRemaining: 12 }));
    expect(v.inPlay).toBe(12);
    expect(v.inPlayLabel).toBe("Still in");
  });

  it("falls back to players remaining when the database hasn't sent playersInPlay yet", () => {
    expect(screenView(state({ playersInPlay: undefined })).inPlay).toBe(40);
  });

  it("shows nobody in play in the lobby and orders winners by rank", () => {
    expect(screenView(state({ game: { ...state().game, status: "lobby" }, round: null, spin: null })).inPlay).toBe(0);
    const v = screenView(state({ game: { ...state().game, status: "finished" }, winners: [{ rank: 2, name: "B" }, { rank: 1, name: "A" }] }));
    expect(v.winners.map((w) => w.name)).toEqual(["A", "B"]);
    expect(v.spinNumber).toBeNull();
  });
});
