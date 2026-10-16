import { describe, expect, it } from "vitest";
import {
  allowedActions,
  eliminations,
  freeChairs,
  isFinalRound,
  isRoundComplete,
  nextDifficulty,
  podiumOrder,
  scanBlocker,
  type EngineState,
} from "./engine";

const base: EngineState = {
  status: "in_round",
  phase: "judging",
  activeChairCount: 10,
  lockedChairCount: 4,
  activePlayerCount: 15,
};

describe("allowedActions", () => {
  it("lobby: only start a round (and edit chairs)", () => {
    const a = allowedActions({ ...base, status: "lobby", phase: null, lockedChairCount: 0 });
    expect([...a].sort()).toEqual(["edit_chairs", "start_round"]);
  });

  it("cannot start a round without chairs or players", () => {
    expect(allowedActions({ ...base, status: "lobby", phase: null, activeChairCount: 0 }).has("start_round")).toBe(false);
    expect(allowedActions({ ...base, status: "lobby", phase: null, activePlayerCount: 0 }).has("start_round")).toBe(false);
  });

  it("music → open scan window only", () => {
    expect([...allowedActions({ ...base, phase: "music" })].sort()).toEqual(["edit_chairs", "open_scan_window"]);
  });

  it("scan_open → close only; chairs are frozen while players scan", () => {
    expect([...allowedActions({ ...base, phase: "scan_open" })]).toEqual(["close_scan_window"]);
  });

  it("judging with free chairs → next spin, not end round", () => {
    const a = allowedActions(base);
    expect(a.has("next_spin")).toBe(true);
    expect(a.has("end_round")).toBe(false);
  });

  it("judging with every chair locked → end round, not next spin", () => {
    const a = allowedActions({ ...base, lockedChairCount: 10 });
    expect(a.has("end_round")).toBe(true);
    expect(a.has("next_spin")).toBe(false);
  });

  it("judging → show results on the projector once, alongside next spin / end round", () => {
    expect(allowedActions(base).has("reveal_results")).toBe(true);
    expect(allowedActions({ ...base, revealed: true }).has("reveal_results")).toBe(false);
    expect(allowedActions({ ...base, revealed: true }).has("next_spin")).toBe(true);
    expect(allowedActions({ ...base, phase: "music" }).has("reveal_results")).toBe(false);
    expect(allowedActions({ ...base, phase: "scan_open" }).has("reveal_results")).toBe(false);
  });

  it("round complete → start the next round; finished → nothing", () => {
    expect(allowedActions({ ...base, status: "round_complete", phase: null }).has("start_round")).toBe(true);
    expect(allowedActions({ ...base, status: "finished", phase: null }).size).toBe(0);
  });
});

describe("round rules", () => {
  it("free chairs are the active chairs nobody has locked", () => {
    expect(freeChairs(["a", "b", "c", "d"], new Set(["b", "d"]))).toEqual(["a", "c"]);
  });

  it("a round is complete only when every active chair is locked (any admin-set count)", () => {
    expect(isRoundComplete(10, 10)).toBe(true);
    expect(isRoundComplete(9, 10)).toBe(false);
    expect(isRoundComplete(37, 37)).toBe(true);
    expect(isRoundComplete(0, 0)).toBe(false);
  });

  it("everyone active without a locked chair is eliminated at round end", () => {
    expect(eliminations(["p1", "p2", "p3", "p4"], new Set(["p2", "p4"]))).toEqual(["p1", "p3"]);
  });

  it("difficulty climbs with the round number, capped at 5, unless the admin overrides it", () => {
    expect(nextDifficulty(1)).toBe(1);
    expect(nextDifficulty(4)).toBe(4);
    expect(nextDifficulty(9)).toBe(5);
    expect(nextDifficulty(2, 5)).toBe(5);
  });

  it("final round: at or below the admin's final count, or marked final by the admin", () => {
    expect(isFinalRound(3, 3, false)).toBe(true);
    expect(isFinalRound(2, 3, false)).toBe(true);
    expect(isFinalRound(4, 3, false)).toBe(false);
    expect(isFinalRound(6, 3, true)).toBe(true);
    expect(isFinalRound(5, 5, false)).toBe(true);
  });
});

describe("scanBlocker", () => {
  const ok = {
    phase: "scan_open" as const,
    playerStatus: "active" as const,
    playerLockedThisRound: false,
    playerScannedThisSpin: false,
    chairActive: true,
    chairLocked: false,
    chairClaimedThisSpin: false,
  };

  it("allows an eligible scan", () => {
    expect(scanBlocker(ok)).toBeNull();
  });

  it.each([
    [{ phase: "music" as const }, "SCAN_WINDOW_CLOSED"],
    [{ playerStatus: "eliminated" as const }, "NOT_ACTIVE"],
    [{ playerLockedThisRound: true }, "ALREADY_LOCKED"],
    [{ playerScannedThisSpin: true }, "ALREADY_SCANNED_THIS_SPIN"],
    [{ chairActive: false }, "CHAIR_INACTIVE"],
    [{ chairLocked: true }, "CHAIR_LOCKED"],
    [{ chairClaimedThisSpin: true }, "CHAIR_TAKEN"],
  ])("blocks %o with %s", (override, code) => {
    expect(scanBlocker({ ...ok, ...override })).toBe(code);
  });
});

describe("podiumOrder", () => {
  it("ranks winners by final-round correct time, earlier answer breaking ties", () => {
    const ranked = podiumOrder([
      { playerId: "c", timeMs: 5870, answeredAt: "2026-10-20T10:00:03Z" },
      { playerId: "a", timeMs: 3420, answeredAt: "2026-10-20T10:00:05Z" },
      { playerId: "b", timeMs: 3420, answeredAt: "2026-10-20T10:00:01Z" },
    ]);
    expect(ranked.map((w) => [w.playerId, w.rank])).toEqual([
      ["b", 1],
      ["a", 2],
      ["c", 3],
    ]);
  });
});

describe("full spin loop (simulation)", () => {
  it("repeats spins until every chair is locked, then eliminates the standing players", () => {
    // 15 players, 10 chairs; each spin the seated players answer, some wrong.
    const players = Array.from({ length: 15 }, (_, i) => `p${i}`);
    const chairs = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const lockedChairs = new Set<string>();
    const lockedPlayers = new Set<string>();
    let spin = 0;
    while (!isRoundComplete(lockedChairs.size, chairs.length)) {
      spin++;
      const standing = players.filter((p) => !lockedPlayers.has(p));
      const open = freeChairs(chairs, lockedChairs);
      open.forEach((chair, i) => {
        const player = standing[i];
        const correct = (spin + i) % 3 !== 0; // deterministic mix of right and wrong
        if (player && correct) {
          lockedChairs.add(chair);
          lockedPlayers.add(player);
        }
      });
      expect(spin).toBeLessThan(50);
    }
    expect(lockedPlayers.size).toBe(10);
    expect(eliminations(players, lockedPlayers)).toHaveLength(5);
  });
});
