// Pure view-models for the admin console (FEATURES F8–F11, D-016). Data comes from admin-only RLS reads.
import type { AdminAction, EngineState, GameStatus, PlayerStatus, SpinPhase } from "@/lib/engine";

export type AdminChair = { id: string; number: number; secret: string; is_active: boolean; deleted_at: string | null };

export type AdminAttempt = {
  id: string;
  spin_id: string;
  chair_id: string;
  player_id: string;
  result: "pending" | "correct" | "wrong" | "timed_out";
  time_ms: number | null;
  answer: string | null;
  scanned_at: string;
  overridden: boolean;
  players: { name: string; usn: string; phone: string } | null;
  questions: { text: string; type: "mcq" | "one_word"; options: string[] | null; answer: string } | null;
};

export type AdminPlayer = {
  id: string;
  name: string;
  usn: string;
  phone: string;
  branch: string;
  status: PlayerStatus;
  eliminated_in_round: number | null;
  final_rank: number | null;
  created_at: string;
};

export type TileState = "free" | "answering" | "correct" | "wrong" | "locked";

export type ChairTile = {
  chairId: string;
  number: number;
  state: TileState;
  /** True once someone scanned it this spin, or it's locked for the round: nobody else can claim it. */
  blocked: boolean;
  player: { name: string; usn: string; phone: string } | null;
  attemptId: string | null;
  scannedAt: string | null;
  question: string | null;
  answerLabel: string | null;
  correctAnswer: string | null;
  timeMs: number | null;
  overridden: boolean;
  alert: boolean;
};

function answerLabel(a: AdminAttempt): string | null {
  if (a.answer === null) return null;
  const q = a.questions;
  if (q?.type === "mcq" && q.options && /^[0-9]$/.test(a.answer)) return q.options[Number(a.answer)] ?? a.answer;
  return a.answer;
}

/** One tile per active chair for the live chair map. `attempts` are the current round's. */
export function chairTiles(
  chairs: readonly AdminChair[],
  attempts: readonly AdminAttempt[],
  currentSpinId: string | null,
  openAlertAttemptIds: ReadonlySet<string>,
): ChairTile[] {
  return chairs
    .filter((c) => c.is_active && !c.deleted_at)
    .sort((a, b) => a.number - b.number)
    .map((c) => {
      const current = attempts.find((a) => a.chair_id === c.id && a.spin_id === currentSpinId) ?? null;
      const lock = attempts.find((a) => a.chair_id === c.id && a.result === "correct") ?? null;
      const shown = current ?? lock;
      let state: TileState = "free";
      if (current) {
        state = current.result === "pending" ? "answering" : current.result === "correct" ? "correct" : "wrong";
      } else if (lock) {
        state = "locked";
      }
      return {
        chairId: c.id,
        number: c.number,
        state,
        blocked: Boolean(current || lock),
        player: shown?.players ?? null,
        attemptId: shown?.id ?? null,
        scannedAt: shown?.scanned_at ?? null,
        question: shown?.questions?.text ?? null,
        answerLabel: shown ? answerLabel(shown) : null,
        correctAnswer: shown?.questions?.answer ?? null,
        timeMs: shown?.time_ms ?? null,
        overridden: shown?.overridden ?? false,
        alert: shown ? openAlertAttemptIds.has(shown.id) : false,
      };
    });
}

export type Roster = {
  registered: AdminPlayer[];
  inPlay: AdminPlayer[];
  locked: AdminPlayer[];
  out: AdminPlayer[];
  winners: AdminPlayer[];
  spectators: AdminPlayer[];
  removed: AdminPlayer[];
};

/** D-016: registering doesn't put someone in play; scanning does. */
export function buildRoster(
  players: readonly AdminPlayer[],
  scannedThisGame: ReadonlySet<string>,
  lockedThisRound: ReadonlySet<string>,
): Roster {
  const by = (pred: (p: AdminPlayer) => boolean) => players.filter(pred);
  return {
    registered: by((p) => p.status === "active" && !scannedThisGame.has(p.id)),
    inPlay: by((p) => p.status === "active" && scannedThisGame.has(p.id)),
    locked: by((p) => p.status === "active" && lockedThisRound.has(p.id)),
    out: by((p) => p.status === "eliminated"),
    winners: by((p) => p.status === "winner").sort((a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99)),
    spectators: by((p) => p.status === "spectator"),
    removed: by((p) => p.status === "kicked"),
  };
}

export function controlState(input: {
  gameStatus: GameStatus;
  phase: SpinPhase | null;
  chairs: readonly AdminChair[];
  lockedChairIds: ReadonlySet<string>;
  activePlayers: number;
  revealed?: boolean;
}): EngineState {
  const active = input.chairs.filter((c) => c.is_active && !c.deleted_at);
  return {
    status: input.gameStatus,
    phase: input.phase,
    activeChairCount: active.length,
    lockedChairCount: active.filter((c) => input.lockedChairIds.has(c.id)).length,
    activePlayerCount: input.activePlayers,
    revealed: input.revealed ?? false,
  };
}

const SHORTCUTS: Record<string, AdminAction> = {
  " ": "open_scan_window",
  j: "close_scan_window",
  r: "reveal_results",
  n: "next_spin",
  e: "end_round",
};

/** DESIGN.md › Interaction: Space = music stopped, J = judge, N = next spin, E = end round. */
export function shortcutAction(key: string, allowed: ReadonlySet<AdminAction>): AdminAction | null {
  const action = SHORTCUTS[key.toLowerCase()];
  return action && allowed.has(action) ? action : null;
}

/** Why "Start round" can't be pressed yet (shown on the greyed-out button), or null when it can. */
export function startBlocker(s: EngineState): "NO_CHAIRS" | "NO_PLAYERS" | null {
  if (s.status !== "lobby" && s.status !== "round_complete") return null;
  if (s.activeChairCount < 1) return "NO_CHAIRS";
  if (s.activePlayerCount < 1) return "NO_PLAYERS";
  return null;
}

export function adminAccess({ signedIn, admin }: { signedIn: boolean; admin: boolean }): "allow" | "login" | "denied" {
  if (!signedIn) return "login";
  return admin ? "allow" : "denied";
}
