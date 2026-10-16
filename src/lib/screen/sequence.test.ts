import { describe, expect, it } from "vitest";
import { mergePresence, nextSequence, toSequence } from "./sequence";

const ev = (seq: number, kind = "round_over", extra: Record<string, unknown> = {}) => ({ kind, seq, ...extra });

describe("nextSequence (event_seq dedupe)", () => {
  it("does not replay the current event on first load or reload", () => {
    expect(nextSequence(null, ev(7, "podium"))).toEqual({ play: null, lastSeen: 7 });
    expect(nextSequence(null, null)).toEqual({ play: null, lastSeen: 0 });
  });

  it("plays each newer event exactly once", () => {
    let last: number | null = null;
    const played: string[] = [];
    for (const e of [ev(3), ev(4, "round_start", { round: 2 }), ev(4, "round_start", { round: 2 }), ev(4), ev(5, "podium")]) {
      const r = nextSequence(last, e);
      last = r.lastSeen;
      if (r.play) played.push(`${r.play.kind}#${r.play.seq}`);
    }
    expect(played).toEqual(["round_start#4", "podium#5"]);
  });

  it("ignores stale or out-of-order updates", () => {
    expect(nextSequence(9, ev(8)).play).toBeNull();
    expect(nextSequence(9, ev(8)).lastSeen).toBe(9);
  });
});

describe("toSequence", () => {
  it("gives the final round a longer sting", () => {
    expect(toSequence(ev(1, "round_start", { round: 4, isFinal: true }))).toMatchObject({ isFinal: true, durationMs: 4000 });
    expect(toSequence(ev(1, "round_start", { round: 2 }))).toMatchObject({ isFinal: false, durationMs: 2000 });
  });

  it("keeps round-over within the 6 s stage budget however many are eliminated", () => {
    expect(toSequence(ev(1, "round_over", { round: 1, eliminated: ["A"] }))).toMatchObject({ eliminated: ["A"], durationMs: 2900 });
    expect(toSequence(ev(1, "round_over", { round: 1, eliminated: Array(40).fill("x") }))!.durationMs).toBe(6000);
  });

  it("maps reset and new_game to the same short sting and ignores unknown kinds", () => {
    expect(toSequence(ev(1, "reset"))?.kind).toBe("new_game");
    expect(toSequence(ev(1, "new_game"))?.kind).toBe("new_game");
    expect(toSequence(ev(1, "something_else"))).toBeNull();
  });
});

describe("mergePresence (chairs sink when removed)", () => {
  it("keeps removed chairs on stage, marked leaving, and adds new ones", () => {
    const prev = [1, 2, 3, 4].map((number) => ({ number, leaving: false }));
    expect(mergePresence(prev, [1, 3, 5])).toEqual([
      { number: 1, leaving: false },
      { number: 2, leaving: true },
      { number: 3, leaving: false },
      { number: 4, leaving: true },
      { number: 5, leaving: false },
    ]);
  });

  it("a chair that comes back is no longer leaving", () => {
    expect(mergePresence([{ number: 2, leaving: true }], [2])).toEqual([{ number: 2, leaving: false }]);
  });
});
