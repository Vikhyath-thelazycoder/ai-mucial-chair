import { describe, expect, it } from "vitest";
import { placeLabels, type LabelBox, type Shift } from "./labels";

const box = (id: string, left: number, top: number, depth: number, w = 120, h = 40): LabelBox => ({ id, left, right: left + w, top, bottom: top + h, depth });

const rects = (boxes: LabelBox[], shifts: Map<string, Shift>) =>
  boxes.map((b) => {
    const s = shifts.get(b.id)!;
    return { left: b.left + s.dx, right: b.right + s.dx, top: b.top - s.dy, bottom: b.bottom - s.dy };
  });

const anyOverlap = (rs: { left: number; right: number; top: number; bottom: number }[]) =>
  rs.some((a, i) => rs.some((b, j) => i < j && a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));

describe("placeLabels", () => {
  it("leaves tags alone when nothing overlaps", () => {
    const shifts = placeLabels([box("a", 0, 100, 5), box("b", 300, 100, 6)]);
    expect([...shifts.values()]).toEqual([{ dx: 0, dy: 0 }, { dx: 0, dy: 0 }]);
  });

  it("keeps the nearer tag in place and moves the farther one clear", () => {
    const boxes = [box("far", 40, 100, 9), box("near", 0, 100, 3)];
    const shifts = placeLabels(boxes);
    expect(shifts.get("near")).toEqual({ dx: 0, dy: 0 });
    expect(anyOverlap(rects(boxes, shifts))).toBe(false);
  });

  it("untangles a crowded strip of 25 names (far side of a big ring) inside the stage", () => {
    const bounds = { top: 180, bottom: 875, left: 0, right: 1920 };
    // Far-side tags crowd one narrow strip, with little room above: the case vertical-only moves couldn't solve.
    const boxes = Array.from({ length: 25 }, (_, i) => box(`c${i}`, 1250 + (i % 6) * 40, 360 + Math.floor(i / 6) * 8, i, 135, 57));
    const shifts = placeLabels(boxes, bounds);
    const rs = rects(boxes, shifts);
    expect(anyOverlap(rs)).toBe(false);
    expect(rs.every((r) => r.top >= bounds.top && r.bottom <= bounds.bottom && r.left >= 0 && r.right <= 1920)).toBe(true);
  });

  it("moves a tag down instead of up when it's already at the top of the stage", () => {
    const bounds = { top: 100, bottom: 900 };
    const boxes = [box("near", 0, 105, 1), box("far", 30, 110, 9)];
    const shifts = placeLabels(boxes, bounds);
    expect(anyOverlap(rects(boxes, shifts))).toBe(false);
    expect(rects(boxes, shifts).every((r) => r.top >= bounds.top)).toBe(true);
  });

  it("pulls a tag that starts above the stage back inside it", () => {
    const s = placeLabels([box("a", 0, 60, 1)], { top: 100, bottom: 900 }).get("a")!;
    expect(60 - s.dy).toBeGreaterThanOrEqual(100);
  });

  it("keeps last frame's spot while it is still clear (no flicker)", () => {
    const boxes = [box("near", 0, 400, 1), box("far", 30, 405, 9)];
    const prev = new Map<string, Shift>([["far", { dx: 0, dy: -60 }]]);
    expect(placeLabels(boxes, { top: 0, bottom: 1000 }, 320, prev).get("far")).toEqual({ dx: 0, dy: -60 });
  });
});
