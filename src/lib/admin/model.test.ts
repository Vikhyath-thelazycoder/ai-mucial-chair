import { describe, expect, it } from "vitest";
import { adminAccess, buildRoster, chairTiles, controlState, shortcutAction, startBlocker, type AdminAttempt, type AdminChair, type AdminPlayer } from "./model";

const chair = (n: number, over: Partial<AdminChair> = {}): AdminChair => ({
  id: `c${n}`,
  number: n,
  secret: "s",
  is_active: true,
  deleted_at: null,
  ...over,
});

const att = (over: Partial<AdminAttempt>): AdminAttempt => ({
  id: "a",
  spin_id: "s3",
  chair_id: "c1",
  player_id: "p1",
  result: "pending",
  time_ms: null,
  answer: null,
  scanned_at: "2026-10-20T10:00:00Z",
  overridden: false,
  players: { name: "Ananya R", usn: "4SU22CS011", phone: "9876543210" },
  questions: { text: "Q?", type: "mcq", options: ["a", "b"], answer: "b" },
  ...over,
});

describe("chairTiles", () => {
  const chairs = [chair(1), chair(2), chair(3), chair(4), chair(5, { is_active: false }), chair(6, { deleted_at: "x" })];
  const attempts = [
    att({ id: "a1", chair_id: "c1", spin_id: "s1", result: "correct", time_ms: 3420 }), // locked earlier
    att({ id: "a2", chair_id: "c2", spin_id: "s3", result: "pending", player_id: "p2", players: { name: "Karthik S", usn: "4SU22EC034", phone: "9" } }),
    att({ id: "a3", chair_id: "c3", spin_id: "s3", result: "wrong", answer: "0", time_ms: 6950, player_id: "p3" }),
    att({ id: "a0", chair_id: "c3", spin_id: "s1", result: "wrong", player_id: "p9" }), // an older spin: ignored
  ];
  const tiles = chairTiles(chairs, attempts, "s3", new Set(["a2"]));

  it("shows active chairs only, in number order", () => {
    expect(tiles.map((t) => t.number)).toEqual([1, 2, 3, 4]);
  });

  it("marks who is sitting where with name, USN and phone", () => {
    expect(tiles[1]).toMatchObject({ state: "answering", blocked: true, player: { name: "Karthik S", usn: "4SU22EC034" } });
  });

  it("keeps a chair locked by an earlier correct answer blocked for the round", () => {
    expect(tiles[0]).toMatchObject({ state: "locked", blocked: true, timeMs: 3420 });
  });

  it("shows wrong answers from this spin and frees chairs with no scan", () => {
    expect(tiles[2]).toMatchObject({ state: "wrong", blocked: true, answerLabel: "a" });
    expect(tiles[3]).toMatchObject({ state: "free", blocked: false, player: null });
  });

  it("flags open anti-cheat alerts on the chair", () => {
    expect(tiles[1].alert).toBe(true);
    expect(tiles[2].alert).toBe(false);
  });
});

describe("buildRoster", () => {
  const players: AdminPlayer[] = [
    { id: "p1", name: "A", usn: "U1", phone: "1", branch: "CSE", status: "active", eliminated_in_round: null, final_rank: null, created_at: "1" },
    { id: "p2", name: "B", usn: "U2", phone: "2", branch: "CSE", status: "active", eliminated_in_round: null, final_rank: null, created_at: "2" },
    { id: "p3", name: "C", usn: "U3", phone: "3", branch: "CSE", status: "eliminated", eliminated_in_round: 1, final_rank: null, created_at: "3" },
    { id: "p4", name: "D", usn: "U4", phone: "4", branch: "CSE", status: "winner", eliminated_in_round: null, final_rank: 1, created_at: "4" },
  ];
  const roster = buildRoster(players, new Set(["p1", "p3", "p4"]), new Set(["p1"]));

  it("separates registered-only, in play, locked and out", () => {
    expect(roster.registered.map((p) => p.id)).toEqual(["p2"]);
    expect(roster.inPlay.map((p) => p.id)).toEqual(["p1"]);
    expect(roster.locked.map((p) => p.id)).toEqual(["p1"]);
    expect(roster.out.map((p) => p.id)).toEqual(["p3"]);
    expect(roster.winners.map((p) => p.id)).toEqual(["p4"]);
  });
});

describe("controlState", () => {
  it("derives the engine state from the admin's data", () => {
    const s = controlState({
      gameStatus: "in_round",
      phase: "judging",
      chairs: [chair(1), chair(2), chair(3, { is_active: false })],
      lockedChairIds: new Set(["c1", "c2"]),
      activePlayers: 5,
    });
    expect(s).toEqual({ status: "in_round", phase: "judging", activeChairCount: 2, lockedChairCount: 2, activePlayerCount: 5, revealed: false });
  });
});

describe("shortcutAction", () => {
  const allowed = new Set(["open_scan_window", "next_spin"] as const);
  it("maps keys to actions only when the action is allowed", () => {
    expect(shortcutAction(" ", allowed)).toBe("open_scan_window");
    expect(shortcutAction("n", allowed)).toBe("next_spin");
    expect(shortcutAction("N", allowed)).toBe("next_spin");
    expect(shortcutAction("j", allowed)).toBeNull();
    expect(shortcutAction("x", allowed)).toBeNull();
  });
});

describe("startBlocker", () => {
  const lobby = { status: "lobby" as const, phase: null, activeChairCount: 10, lockedChairCount: 0, activePlayerCount: 0 };
  it("explains why a fresh game can't start yet instead of hiding the button", () => {
    expect(startBlocker(lobby)).toBe("NO_PLAYERS");
    expect(startBlocker({ ...lobby, activeChairCount: 0 })).toBe("NO_CHAIRS");
    expect(startBlocker({ ...lobby, activePlayerCount: 3 })).toBeNull();
    expect(startBlocker({ ...lobby, status: "in_round" })).toBeNull();
  });
});

describe("adminAccess", () => {
  it("sends signed-out visitors to login and blocks non-admins", () => {
    expect(adminAccess({ signedIn: false, admin: false })).toBe("login");
    expect(adminAccess({ signedIn: true, admin: false })).toBe("denied");
    expect(adminAccess({ signedIn: true, admin: true })).toBe("allow");
  });
});
