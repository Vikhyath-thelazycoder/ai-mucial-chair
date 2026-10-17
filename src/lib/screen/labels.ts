// Name-tag layout for the projector: tags are drawn where their seats are on screen, and any tag that would
// overlap one closer to the camera moves to the nearest clear spot (up, down or sideways); a thin line points
// back to its seat. Tags stay inside the stage band, so none hide under the header or the SCAN NOW band.

export type LabelBox = {
  id: string;
  /** Screen rectangle of the tag at its natural position (px), without any shift. */
  left: number;
  right: number;
  top: number;
  bottom: number;
  /** Distance from the camera; nearer tags keep their place, farther ones move. */
  depth: number;
};

export type Bounds = { top: number; bottom: number; left?: number; right?: number };
/** dx: px to the right; dy: px UP (positive lifts the tag). */
export type Shift = { dx: number; dy: number };

const GAP = 4; // px of air between tags
type Rect = { left: number; right: number; top: number; bottom: number };

const overlaps = (a: Rect, b: Rect) => a.left < b.right + GAP && b.left < a.right + GAP && a.top < b.bottom + GAP && b.top < a.bottom + GAP;

/** Candidate moves for one tag, nearest first: vertical half-height steps, combined with sideways nudges. */
function candidates(w: number, h: number, maxShift: number): Shift[] {
  const step = Math.max(6, h * 0.5);
  const out: Shift[] = [];
  for (let k = -Math.ceil(maxShift / step); k <= Math.ceil(maxShift / step); k++) {
    for (const f of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2]) out.push({ dx: f * w, dy: k * step });
  }
  // Moving sideways reads worse than moving up/down, so it costs a little more.
  return out.sort((a, b) => Math.abs(a.dy) + 1.4 * Math.abs(a.dx) - (Math.abs(b.dy) + 1.4 * Math.abs(b.dx)));
}

/**
 * Returns how far to move each tag. Greedy, nearest first: each tag keeps last frame's spot while that is still
 * clear (no flicker), otherwise takes the nearest candidate that clears every tag already placed and stays in
 * `bounds`. If nothing is clear, it takes the in-bounds spot with the fewest overlaps.
 */
export function placeLabels(
  boxes: readonly LabelBox[],
  bounds: Bounds = { top: -Infinity, bottom: Infinity },
  maxShift = 320,
  previous?: ReadonlyMap<string, Shift>,
): Map<string, Shift> {
  const out = new Map<string, Shift>();
  const placed: Rect[] = [];
  const left = bounds.left ?? -Infinity;
  const right = bounds.right ?? Infinity;
  for (const b of [...boxes].sort((x, y) => x.depth - y.depth)) {
    const w = b.right - b.left;
    const h = b.bottom - b.top;
    // Start from the natural spot pulled inside the band.
    const base: Shift = {
      dx: b.left < left ? left - b.left : b.right > right ? right - b.right : 0,
      dy: b.top < bounds.top ? b.top - bounds.top : b.bottom > bounds.bottom ? b.bottom - bounds.bottom : 0,
    };
    const at = (s: Shift): Rect => ({ left: b.left + s.dx, right: b.right + s.dx, top: b.top - s.dy, bottom: b.bottom - s.dy });
    const inBounds = (r: Rect) => r.top >= bounds.top && r.bottom <= bounds.bottom && r.left >= left && r.right <= right;
    const clear = (r: Rect) => !placed.some((p) => overlaps(r, p));

    let chosen: Shift | null = null;
    const kept = previous?.get(b.id);
    if (kept && inBounds(at(kept)) && clear(at(kept))) chosen = kept;
    if (!chosen) {
      let fewest = Infinity;
      for (const c of candidates(w, h, maxShift)) {
        const s = { dx: base.dx + c.dx, dy: base.dy + c.dy };
        const r = at(s);
        if (!inBounds(r)) continue;
        const hits = placed.filter((p) => overlaps(r, p)).length;
        if (hits < fewest) {
          chosen = s;
          fewest = hits;
        }
        if (hits === 0) break;
      }
    }
    chosen ??= base;
    out.set(b.id, chosen);
    placed.push(at(chosen));
  }
  return out;
}
