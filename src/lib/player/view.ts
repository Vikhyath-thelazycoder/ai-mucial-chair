import type { MyAttempt, MyStatus, PublicState } from "@/lib/game/types";

// Which single screen the player sees (DESIGN.md › Component principles: one state per screen).
// Never derives "correct" or "wrong": after judging, players only learn stay seated / stand up.
export type PlayerView =
  | { kind: "loading" }
  | { kind: "register"; rejoin: boolean }
  | { kind: "registration_closed" }
  | { kind: "spectator" }
  | { kind: "removed" }
  | { kind: "eliminated"; round: number | null }
  | { kind: "missed" }
  | { kind: "winner"; rank: number | null }
  | { kind: "lobby" }
  | { kind: "round_cleared"; round: number | null }
  | { kind: "walk" }
  | { kind: "scan" }
  | { kind: "question"; attempt: MyAttempt }
  | { kind: "answered" }
  | { kind: "stay_seated" }
  | { kind: "stand_up" }
  | { kind: "wait_next_spin" };

export function playerView(me: MyStatus | null, pub: PublicState | null): PlayerView {
  if (!me || !pub) return { kind: "loading" };
  if (!me.registered) {
    return me.registrationOpen ? { kind: "register", rejoin: me.playedBefore } : { kind: "registration_closed" };
  }

  const { player } = me;
  switch (player.status) {
    case "winner":
      return { kind: "winner", rank: player.finalRank };
    case "eliminated":
      // Registered but never sat down: they didn't lose, they just didn't play (D-016).
      return me.playedThisGame ? { kind: "eliminated", round: player.eliminatedInRound } : { kind: "missed" };
    case "spectator":
      return { kind: "spectator" };
    case "kicked":
      return { kind: "removed" };
  }

  if (me.gameStatus === "lobby") return { kind: "lobby" };
  if (me.gameStatus === "round_complete" || me.gameStatus === "finished") return { kind: "round_cleared", round: me.roundNumber };

  if (me.attempt && !me.attempt.answered && me.attempt.question) return { kind: "question", attempt: me.attempt };
  if (me.lockedThisRound) return { kind: "stay_seated" };

  switch (me.phase) {
    case "scan_open":
      return me.attempt ? { kind: "answered" } : { kind: "scan" };
    case "judging":
    case "closed":
      return me.attempt ? { kind: "stand_up" } : { kind: "wait_next_spin" };
    default:
      return { kind: "walk" };
  }
}
