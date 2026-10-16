// Projector view-model (F15): what /screen shows comes from public_state and the public stage_seats table
// (0011). Seats show who sat down at once, but right/wrong only after the admin reveals the spin.
import type { PublicState } from "@/lib/game/types";

export type Stage = "lobby" | "music" | "scan" | "judging" | "between" | "podium";
export type SeatState = "empty" | "seated" | "correct" | "wrong";
export type StageSeat = { number: number; occupant: string | null; state: SeatState };

export type ScreenView = {
  stage: Stage;
  roundNumber: number | null;
  isFinal: boolean;
  chairCount: number;
  seats: StageSeat[];
  revealed: boolean;
  correct: number;
  wrong: number;
  winners: { rank: number; name: string }[];
  scanOpenedAt: string | null;
};

export function screenStage(s: PublicState): Stage {
  if (s.game.status === "finished") return "podium";
  if (s.game.status === "lobby" || !s.round) return "lobby";
  if (s.game.status === "round_complete" || s.round.status === "complete") return "between";
  switch (s.spin?.phase) {
    case "scan_open":
      return "scan";
    case "judging":
    case "closed":
      return "judging";
    default:
      return "music";
  }
}

/** Seats from public_state alone (before 0011 is deployed): judged holders are green, the rest empty. */
export function seatsFromPublicState(s: PublicState): StageSeat[] {
  return s.chairs.map((c) => ({ number: c.number, occupant: c.holder, state: c.holder ? "correct" : "empty" }));
}

export function screenView(s: PublicState, seats: StageSeat[] | null): ScreenView {
  const stage = screenStage(s);
  const list = [...(seats ?? seatsFromPublicState(s))].sort((a, b) => a.number - b.number);
  // Anything not yet revealed is shown as just "seated", whatever the table says (defence in depth).
  const revealed = stage !== "scan" && (Boolean(s.spin?.revealed) || stage !== "judging");
  const safe = list.map((x) => (!revealed && x.state === "wrong" ? { ...x, state: "seated" as const } : x));
  return {
    stage,
    roundNumber: s.round?.number ?? null,
    isFinal: Boolean(s.round?.isFinal),
    chairCount: safe.length,
    seats: safe,
    revealed: stage === "judging" && Boolean(s.spin?.revealed),
    correct: safe.filter((x) => x.state === "correct").length,
    wrong: safe.filter((x) => x.state === "wrong").length,
    winners: [...s.winners].sort((a, b) => a.rank - b.rank),
    scanOpenedAt: stage === "scan" ? (s.spin?.scanOpenedAt ?? null) : null,
  };
}
