import { describe, expect, it } from "vitest";
import type { MyStatus, PublicState } from "@/lib/game/types";
import { playerView } from "./view";

const ps = (over: Partial<PublicState> = {}): PublicState => ({
  session: { number: 1, startedAt: "" },
  game: { name: "AI Musical Chair", status: "in_round", registrationOpen: true, finalChairCount: 3, timerSeconds: 30, autoOpenOnPause: true },
  round: { number: 2, difficulty: 2, isFinal: false, status: "active", timerSeconds: 30 },
  spin: { number: 1, phase: "music", scanOpenedAt: null },
  chairs: [],
  playersRemaining: 10,
  playersTotal: 15,
  winners: [],
  event: null,
  ...over,
});

type Registered = Extract<MyStatus, { registered: true }>;
const me = (over: Partial<Registered> = {}): Registered => ({
  registered: true,
  player: { name: "Karthik S", usn: "4SU22EC034", branch: "ECE", status: "active", eliminatedInRound: null, finalRank: null },
  gameStatus: "in_round",
  roundNumber: 2,
  phase: "music",
  lockedThisRound: false,
  attempt: null,
  serverNow: "",
  ...over,
});

const pendingAttempt = {
  id: "a1",
  chairNumber: 4,
  deadline: "2026-10-20T10:00:30Z",
  answered: false,
  question: { id: "q1", text: "Q?", type: "mcq" as const, options: ["a", "b"] },
};

describe("playerView", () => {
  it("asks to register when not in this game, saying so if they played before", () => {
    expect(playerView({ registered: false, playedBefore: false, registrationOpen: true, serverNow: "" }, ps())).toEqual({ kind: "register", rejoin: false });
    expect(playerView({ registered: false, playedBefore: true, registrationOpen: true, serverNow: "" }, ps())).toEqual({ kind: "register", rejoin: true });
    expect(playerView({ registered: false, playedBefore: false, registrationOpen: false, serverNow: "" }, ps()).kind).toBe("registration_closed");
  });

  it("final outcomes win over everything else", () => {
    expect(playerView(me({ player: { ...me().player, status: "eliminated", eliminatedInRound: 2 } }), ps()).kind).toBe("eliminated");
    expect(playerView(me({ player: { ...me().player, status: "winner", finalRank: 1 } }), ps()).kind).toBe("winner");
    expect(playerView(me({ player: { ...me().player, status: "spectator" } }), ps()).kind).toBe("spectator");
    expect(playerView(me({ player: { ...me().player, status: "kicked" } }), ps()).kind).toBe("removed");
  });

  it("lobby and between rounds", () => {
    expect(playerView(me({ gameStatus: "lobby" }), ps({ game: { ...ps().game, status: "lobby" }, round: null, spin: null })).kind).toBe("lobby");
    expect(playerView(me({ gameStatus: "round_complete" }), ps({ game: { ...ps().game, status: "round_complete" } })).kind).toBe("round_cleared");
  });

  it("music: walk, unless already holding a chair", () => {
    expect(playerView(me(), ps()).kind).toBe("walk");
    expect(playerView(me({ lockedThisRound: true }), ps()).kind).toBe("stay_seated");
  });

  it("scan window: scan now, or answer the question already claimed", () => {
    const open = ps({ spin: { number: 1, phase: "scan_open", scanOpenedAt: "x" } });
    expect(playerView(me({ phase: "scan_open" }), open).kind).toBe("scan");
    expect(playerView(me({ phase: "scan_open", attempt: pendingAttempt }), open)).toMatchObject({ kind: "question" });
    expect(playerView(me({ phase: "scan_open", attempt: { ...pendingAttempt, answered: true, question: null } }), open).kind).toBe("answered");
    expect(playerView(me({ phase: "scan_open", lockedThisRound: true }), open).kind).toBe("stay_seated");
  });

  it("judging: answered-and-not-locked means stand up; never says right or wrong", () => {
    const judging = ps({ spin: { number: 1, phase: "judging", scanOpenedAt: "x" } });
    expect(playerView(me({ phase: "judging", attempt: { ...pendingAttempt, answered: true, question: null } }), judging).kind).toBe("stand_up");
    expect(playerView(me({ phase: "judging", lockedThisRound: true }), judging).kind).toBe("stay_seated");
    expect(playerView(me({ phase: "judging" }), judging).kind).toBe("wait_next_spin");
  });
});
