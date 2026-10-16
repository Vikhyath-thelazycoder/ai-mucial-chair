// Stage sequences are keyed by public_state.event.seq so each plays exactly once and a reload never
// replays one (DESIGN.md › Motion). Durations are the "Stage sequences 1.5–6 s" budget.
import type { PublicState } from "@/lib/game/types";

export type Sequence =
  | { kind: "round_start"; seq: number; round: number; isFinal: boolean; durationMs: number }
  | { kind: "round_over"; seq: number; round: number; eliminated: string[]; durationMs: number }
  | { kind: "podium"; seq: number; durationMs: number }
  | { kind: "new_game"; seq: number; durationMs: number };

export function toSequence(event: PublicState["event"]): Sequence | null {
  if (!event) return null;
  const { seq } = event;
  switch (event.kind) {
    case "round_start":
      return event.isFinal
        ? { kind: "round_start", seq, round: event.round ?? 0, isFinal: true, durationMs: 4000 }
        : { kind: "round_start", seq, round: event.round ?? 0, isFinal: false, durationMs: 2000 };
    case "round_over":
      return {
        kind: "round_over",
        seq,
        round: event.round ?? 0,
        eliminated: event.eliminated ?? [],
        // Longer when there are more names to read, capped at the 6 s stage budget.
        durationMs: Math.min(6000, 2500 + (event.eliminated?.length ?? 0) * 400),
      };
    case "podium":
      return { kind: "podium", seq, durationMs: 6000 };
    case "new_game":
    case "reset":
      return { kind: "new_game", seq, durationMs: 1500 };
    default:
      return null;
  }
}

/**
 * Decides whether a state update should start a sequence. The first state a page sees only records the
 * current seq (so a reload or a late-opened tab doesn't replay the last event); afterwards only a strictly
 * newer seq plays.
 */
export function nextSequence(lastSeen: number | null, event: PublicState["event"]): { play: Sequence | null; lastSeen: number } {
  const seq = event?.seq ?? 0;
  if (lastSeen === null) return { play: null, lastSeen: seq };
  if (seq <= lastSeen) return { play: null, lastSeen };
  return { play: toSequence(event), lastSeen: seq };
}

export type PresentChair = { number: number; leaving: boolean };

/**
 * Chairs the admin removed stay on stage for one sinking animation instead of vanishing.
 * Returns the chairs to render (current ones plus those still sinking).
 */
export function mergePresence(prev: readonly PresentChair[], current: readonly number[]): PresentChair[] {
  const now = new Set(current);
  const leaving = prev.filter((c) => !now.has(c.number)).map((c) => ({ number: c.number, leaving: true }));
  return [...current.map((number) => ({ number, leaving: false })), ...leaving].sort((a, b) => a.number - b.number);
}
