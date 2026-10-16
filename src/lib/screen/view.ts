// Projector view-model (F15): everything /screen shows is derived from public_state alone, which never
// carries answers or right/wrong. A chair's holder only appears once its spin has been judged (0005 SQL).
import type { PublicState } from "@/lib/game/types";

export type Stage = "lobby" | "music" | "scan" | "judging" | "between" | "podium";

export type ScreenChair = { number: number; holder: string | null };

export type ScreenView = {
  stage: Stage;
  title: string;
  roundNumber: number | null;
  isFinal: boolean;
  spinNumber: number | null;
  chairs: ScreenChair[];
  locked: number;
  /** "In play": round 1 counts players who actually scanned, later rounds the players still in (D-016, T-7.1). */
  inPlay: number;
  inPlayLabel: string;
  joined: number;
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

export function screenView(s: PublicState): ScreenView {
  const stage = screenStage(s);
  const chairs = [...s.chairs].sort((a, b) => a.number - b.number).map((c) => ({ number: c.number, holder: c.holder }));
  const roundOne = s.round?.number === 1 && s.round.status === "active";
  const inPlay = roundOne ? (s.playersInPlay ?? s.playersRemaining) : s.round ? s.playersRemaining : 0;
  return {
    stage,
    title: s.game.name,
    roundNumber: s.round?.number ?? null,
    isFinal: Boolean(s.round?.isFinal),
    spinNumber: stage === "lobby" || stage === "podium" ? null : (s.spin?.number ?? null),
    chairs,
    locked: chairs.filter((c) => c.holder).length,
    inPlay,
    inPlayLabel: roundOne ? "In play" : "Still in",
    joined: s.playersTotal,
    winners: [...s.winners].sort((a, b) => a.rank - b.rank),
    scanOpenedAt: stage === "scan" ? (s.spin?.scanOpenedAt ?? null) : null,
  };
}
