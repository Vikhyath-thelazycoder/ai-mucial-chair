import { describe, expect, it } from "vitest";
import type { PublicState } from "@/lib/game/types";
import { screenStage, screenView, type StageSeat } from "./view";

function state(over: Partial<PublicState> = {}): PublicState {
  return {
    session: { number: 3, startedAt: "2026-10-17T10:00:00Z" },
    game: { name: "AI Musical Chair", status: "in_round", registrationOpen: false, finalChairCount: 3, timerSeconds: 20, autoOpenOnPause: true },
    round: { number: 2, difficulty: 2, isFinal: false, status: "active", timerSeconds: 20 },
    spin: { number: 2, phase: "music", scanOpenedAt: null, revealed: false },
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

const seats: StageSeat[] = [
  { number: 2, occupant: "Ravi", state: "wrong" },
  { number: 1, occupant: "Asha", state: "correct" },
  { number: 3, occupant: "Meera", state: "seated" },
];
const judging = (revealed: boolean) => state({ spin: { number: 2, phase: "judging", scanOpenedAt: "t", revealed } });

describe("screenStage", () => {
  it("maps game status and spin phase to one stage", () => {
    expect(screenStage(state({ game: { ...state().game, status: "lobby" }, round: null, spin: null }))).toBe("lobby");
    expect(screenStage(state())).toBe("music");
    expect(screenStage(state({ spin: { number: 2, phase: "scan_open", scanOpenedAt: "t" } }))).toBe("scan");
    expect(screenStage(judging(false))).toBe("judging");
    expect(screenStage(state({ game: { ...state().game, status: "round_complete" }, round: { ...state().round!, status: "complete" } }))).toBe("between");
    expect(screenStage(state({ game: { ...state().game, status: "finished" } }))).toBe("podium");
  });
});

describe("screenView", () => {
  it("shows one seat per chair, numbered and ordered like the admin panel", () => {
    const v = screenView(state(), seats);
    expect(v.seats.map((s) => s.number)).toEqual([1, 2, 3]);
    expect(v.chairCount).toBe(3);
    expect(v.roundNumber).toBe(2);
  });

  it("shows who sat down, but never red before the admin reveals", () => {
    for (const s of [state({ spin: { number: 2, phase: "scan_open", scanOpenedAt: "t" } }), judging(false)]) {
      const v = screenView(s, seats);
      expect(v.seats.find((x) => x.number === 2)).toEqual({ number: 2, occupant: "Ravi", state: "seated" });
      expect(v.wrong).toBe(0);
      expect(v.revealed).toBe(false);
    }
  });

  it("after the reveal shows green for right and red for wrong", () => {
    const v = screenView(judging(true), seats);
    expect(v.revealed).toBe(true);
    expect(v.seats.map((s) => s.state)).toEqual(["correct", "wrong", "seated"]);
    expect([v.correct, v.wrong]).toEqual([1, 1]);
  });

  it("carries no game number, answers or questions", () => {
    const text = JSON.stringify(screenView(judging(true), seats));
    expect(text).not.toMatch(/session|answer|question|attempt/i);
    expect(Object.keys(screenView(state(), seats))).not.toContain("title");
  });

  it("falls back to public_state holders (green) when the seat table isn't available", () => {
    const v = screenView(state(), null);
    expect(v.seats).toEqual([
      { number: 1, occupant: "Asha", state: "correct" },
      { number: 2, occupant: null, state: "empty" },
      { number: 3, occupant: null, state: "empty" },
    ]);
  });

  it("orders winners by rank", () => {
    const v = screenView(state({ game: { ...state().game, status: "finished" }, winners: [{ rank: 2, name: "B" }, { rank: 1, name: "A" }] }), seats);
    expect(v.winners.map((w) => w.name)).toEqual(["A", "B"]);
  });
});
