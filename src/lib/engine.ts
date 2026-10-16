// Pure model of the game rules (PRD › Game rules). The Postgres RPCs are the authority;
// the UI uses this to decide which controls to enable, and both are tested against the same cases.

export type GameStatus = "lobby" | "in_round" | "round_complete" | "finished";
export type SpinPhase = "music" | "scan_open" | "judging" | "closed";
export type PlayerStatus = "active" | "eliminated" | "winner" | "spectator" | "kicked";
export type AttemptResult = "pending" | "correct" | "wrong" | "timed_out";

export type AdminAction =
  | "start_round"
  | "open_scan_window"
  | "close_scan_window"
  | "reveal_results"
  | "next_spin"
  | "end_round"
  | "edit_chairs";

export type EngineState = {
  status: GameStatus;
  phase: SpinPhase | null;
  activeChairCount: number;
  lockedChairCount: number;
  activePlayerCount: number;
  /** This spin's results are already shown on the projector (0011). */
  revealed?: boolean;
};

export function isRoundComplete(lockedChairCount: number, activeChairCount: number): boolean {
  return activeChairCount > 0 && lockedChairCount >= activeChairCount;
}

export function allowedActions(s: EngineState): Set<AdminAction> {
  const actions = new Set<AdminAction>();
  if (s.status === "finished") return actions;
  if (s.status === "lobby" || s.status === "round_complete") {
    actions.add("edit_chairs");
    if (s.activeChairCount > 0 && s.activePlayerCount > 0) actions.add("start_round");
    return actions;
  }
  // in_round
  if (s.phase === "scan_open") {
    actions.add("close_scan_window");
    return actions;
  }
  actions.add("edit_chairs");
  if (s.phase === "music") actions.add("open_scan_window");
  if (s.phase === "judging") {
    if (!s.revealed) actions.add("reveal_results");
    actions.add(isRoundComplete(s.lockedChairCount, s.activeChairCount) ? "end_round" : "next_spin");
  }
  return actions;
}

export function freeChairs<T>(activeChairs: readonly T[], locked: ReadonlySet<T>): T[] {
  return activeChairs.filter((c) => !locked.has(c));
}

export function eliminations<T>(activePlayers: readonly T[], lockedPlayers: ReadonlySet<T>): T[] {
  return activePlayers.filter((p) => !lockedPlayers.has(p));
}

export function nextDifficulty(roundNumber: number, override?: number): number {
  return override ?? Math.min(5, Math.max(1, roundNumber));
}

export function isFinalRound(activeChairCount: number, finalChairCount: number, markedFinal: boolean): boolean {
  return markedFinal || activeChairCount <= finalChairCount;
}

export type ScanError =
  | "SCAN_WINDOW_CLOSED"
  | "NOT_ACTIVE"
  | "ALREADY_LOCKED"
  | "ALREADY_SCANNED_THIS_SPIN"
  | "CHAIR_INACTIVE"
  | "CHAIR_LOCKED"
  | "CHAIR_TAKEN";

export function scanBlocker(c: {
  phase: SpinPhase | null;
  playerStatus: PlayerStatus;
  playerLockedThisRound: boolean;
  playerScannedThisSpin: boolean;
  chairActive: boolean;
  chairLocked: boolean;
  chairClaimedThisSpin: boolean;
}): ScanError | null {
  if (c.phase !== "scan_open") return "SCAN_WINDOW_CLOSED";
  if (c.playerStatus !== "active") return "NOT_ACTIVE";
  if (c.playerLockedThisRound) return "ALREADY_LOCKED";
  if (c.playerScannedThisSpin) return "ALREADY_SCANNED_THIS_SPIN";
  if (!c.chairActive) return "CHAIR_INACTIVE";
  if (c.chairLocked) return "CHAIR_LOCKED";
  if (c.chairClaimedThisSpin) return "CHAIR_TAKEN";
  return null;
}

export type WinnerTime = { playerId: string; timeMs: number; answeredAt: string };

export function podiumOrder(winners: readonly WinnerTime[]): (WinnerTime & { rank: number })[] {
  return [...winners]
    .sort((a, b) => a.timeMs - b.timeMs || Date.parse(a.answeredAt) - Date.parse(b.answeredAt))
    .map((w, i) => ({ ...w, rank: i + 1 }));
}
